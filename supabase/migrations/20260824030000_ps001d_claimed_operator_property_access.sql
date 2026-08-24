-- PS-001D claim-owned selected-property access. The authenticated controlled
-- owner invokes the existing workspace access command; no identity substitution,
-- direct assignment insertion, broad access, or invitation is introduced.

create table public.ps001d_verification_access_assignments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.ps001d_verification_claims(id),
  ledger_id uuid not null unique references public.ps001d_verification_resource_ledger(id),
  candidate_commit text not null,
  deployment_id text not null,
  tenant_id uuid not null,
  correlation_id text not null,
  operator_id uuid not null references public.profiles(id),
  membership_id uuid not null references public.workspace_memberships(id),
  property_id uuid not null,
  original_access_mode text not null check (original_access_mode in ('selected','none')),
  original_property_ids uuid[] not null,
  status text not null check (status in ('active','cleaned')),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  cleaned_at timestamptz,
  unique(claim_id,operator_id,property_id),
  foreign key(claim_id,tenant_id) references public.ps001d_verification_claims(id,tenant_id),
  foreign key(claim_id,correlation_id) references public.ps001d_verification_claims(id,correlation_id)
);

create or replace function public.can_access_workspace_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.properties property
    join public.workspace_memberships membership on membership.workspace_id=property.owner_id and membership.profile_id=auth.uid() and membership.status='active'
    where property.id=p_property_id and property.status<>'archived' and(
      membership.role in('owner','administrator') or membership.property_access_mode='all' or(
        membership.property_access_mode='selected' and exists(select 1 from public.workspace_member_property_access access where access.membership_id=membership.id and access.property_id=property.id)
      )
    )
  )
$$;

create or replace function public.workspace_property_ids(p_workspace_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select property.id from public.properties property
  join public.workspace_memberships membership on membership.workspace_id=property.owner_id and membership.profile_id=auth.uid() and membership.status='active'
  where property.owner_id=p_workspace_id and property.status<>'archived' and(
    membership.role in('owner','administrator') or membership.property_access_mode='all' or(
      membership.property_access_mode='selected' and exists(select 1 from public.workspace_member_property_access access where access.membership_id=membership.id and access.property_id=property.id)
    )
  )
$$;

create or replace function public.assign_ps001d_verification_operator_property(
  p_claim_operator_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_operator_id uuid,p_property_id uuid
) returns public.ps001d_verification_access_assignments language plpgsql security definer set search_path = '' as $$
declare
  v_actor_id uuid:=auth.uid(); v_claim public.ps001d_verification_claims; v_membership public.workspace_memberships;
  v_original_ids uuid[]; v_assignment public.ps001d_verification_access_assignments; v_ledger public.ps001d_verification_resource_ledger;
  v_command_id text; v_payload jsonb;
begin
  if auth.role()<>'authenticated' or v_actor_id is null then raise exception 'PS001D_WORKSPACE_AUTHENTICATION_REQUIRED'; end if;
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.operator_id<>p_claim_operator_id or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'consumed' or v_claim.expires_at<=now() then raise exception 'PS001D_FIXTURE_CLAIM_REQUIRED'; end if;
  if not exists(select 1 from public.ps001d_verification_identity_authorizations where scenario='authorized_owner' and user_id=v_actor_id and expected_role='owner' and tenant_id=p_tenant_id and candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and correlation_id=p_correlation_id and revoked_at is null and valid_from<=now() and expires_at>now()) then raise exception 'PS001D_ACCESS_ASSIGNER_UNAUTHORIZED'; end if;
  if not exists(select 1 from public.workspace_memberships where workspace_id=p_tenant_id and profile_id=v_actor_id and role='owner' and status='active') then raise exception 'PS001D_ACCESS_ASSIGNER_UNAUTHORIZED'; end if;
  select * into v_membership from public.workspace_memberships where workspace_id=p_tenant_id and profile_id=p_operator_id and role='operator' and status='active' for update;
  if not found or v_membership.property_access_mode not in('selected','none') then raise exception 'PS001D_OPERATOR_SCOPE_INVALID'; end if;
  if not exists(select 1 from public.ps001d_verification_identity_authorizations where scenario='authorized_operator' and user_id=p_operator_id and expected_role='operator' and tenant_id=p_tenant_id and candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and correlation_id=p_correlation_id and revoked_at is null and valid_from<=now() and expires_at>now()) then raise exception 'PS001D_OPERATOR_SCOPE_INVALID'; end if;
  if not exists(select 1 from public.properties where id=p_property_id and owner_id=p_tenant_id and ps001d_synthetic and ps001d_claim_id=p_claim_id and ps001d_correlation_id=p_correlation_id) or not exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id and resource_type='property' and canonical_resource_id=p_property_id::text and status='created') then raise exception 'PS001D_PROPERTY_SCOPE_MISMATCH'; end if;
  select * into v_assignment from public.ps001d_verification_access_assignments where claim_id=p_claim_id;
  if found then
    if v_assignment.operator_id<>p_operator_id or v_assignment.property_id<>p_property_id or v_assignment.tenant_id<>p_tenant_id or v_assignment.correlation_id<>p_correlation_id then raise exception 'PS001D_ACCESS_ASSIGNMENT_REPLAY_MISMATCH'; end if;
    return v_assignment;
  end if;
  select coalesce(array_agg(property_id order by property_id),'{}'::uuid[]) into v_original_ids from public.workspace_member_property_access where membership_id=v_membership.id;
  insert into public.ps001d_verification_resource_ledger(claim_id,correlation_id,tenant_id,resource_type,canonical_resource_id,creating_scenario,dependency_order,status)
  values(p_claim_id,p_correlation_id,p_tenant_id,'workspace_membership',gen_random_uuid()::text,'authorized_owner',15,'reserved') returning * into v_ledger;
  insert into public.ps001d_verification_access_assignments(claim_id,ledger_id,candidate_commit,deployment_id,tenant_id,correlation_id,operator_id,membership_id,property_id,original_access_mode,original_property_ids,status,assigned_by)
  values(p_claim_id,v_ledger.id,p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,p_operator_id,v_membership.id,p_property_id,v_membership.property_access_mode,v_original_ids,'active',v_actor_id) returning * into v_assignment;
  v_command_id:='ps001d-assign-'||v_assignment.id::text;
  v_payload:=jsonb_build_object('propertyAccessMode','selected','propertyIds',to_jsonb(array(select distinct value from unnest(v_original_ids||array[p_property_id]) value order by value)));
  perform public.apply_workspace_access_command(p_tenant_id,'change-access',v_membership.id,v_payload,v_command_id);
  if not exists(select 1 from public.workspace_member_property_access where membership_id=v_membership.id and property_id=p_property_id) then raise exception 'PS001D_ACCESS_ASSIGNMENT_FAILED'; end if;
  update public.ps001d_verification_resource_ledger set status='created',exposed_at=now() where id=v_ledger.id;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,v_actor_id,'ps001d_operator_property_assigned','ACCESS_ASSIGNED',jsonb_build_object('assignmentId',v_assignment.id,'propertyId',p_property_id,'operatorId',p_operator_id));
  return v_assignment;
end $$;

create or replace function public.create_ps001d_verification_booking(
  p_actor_id uuid,p_domain_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_property_id uuid
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings; v_booking_id uuid:=gen_random_uuid(); v_ledger public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_fixture_claim(p_actor_id,p_domain_actor_id,p_claim_id,p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,'authorized_operator');
  if not exists(select 1 from public.properties where id=p_property_id and owner_id=p_tenant_id and ps001d_synthetic and ps001d_claim_id=p_claim_id and ps001d_correlation_id=p_correlation_id) then raise exception 'PS001D_PROPERTY_SCOPE_MISMATCH'; end if;
  if not exists(select 1 from public.ps001d_verification_access_assignments where claim_id=p_claim_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id and operator_id=p_domain_actor_id and property_id=p_property_id and status='active') then raise exception 'PS001D_OPERATOR_PROPERTY_ACCESS_REQUIRED'; end if;
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type='booking') then raise exception 'PS001D_FIXTURE_DUPLICATE'; end if;
  insert into public.ps001d_verification_resource_ledger(claim_id,correlation_id,tenant_id,resource_type,canonical_resource_id,creating_scenario,dependency_order,status)
  values(p_claim_id,p_correlation_id,p_tenant_id,'booking',v_booking_id::text,'authorized_operator',20,'reserved') returning * into v_ledger;
  insert into public.bookings(id,property_id,check_in,check_out,guests,total_amount,status,guest_full_name,nightly_rate,cleaning_fee,taxes,service_fee,payment_status,source,notes,external_provider,stripe_payment_intent_id,raw_payload,ps001d_synthetic,ps001d_claim_id,ps001d_correlation_id,ps001d_side_effects_suppressed)
  values(v_booking_id,p_property_id,current_date+30,current_date+32,1,0,'pending','PS-001D Synthetic Guest',0,0,0,0,'unpaid','PS-001D Synthetic','PS-001D synthetic verification data; notifications, providers, payments, publication, automation, and catalog effects suppressed.',null,null,'{}'::jsonb,true,p_claim_id,p_correlation_id,true) returning * into v_booking;
  update public.ps001d_verification_resource_ledger set status='created',exposed_at=now() where id=v_ledger.id;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,p_domain_actor_id,'ps001d_booking_fixture_created','FIXTURE_CREATED',jsonb_build_object('resourceType','booking','resourceId',v_booking_id,'sideEffectsSuppressed',true));
  return v_booking;
exception when unique_violation then raise exception 'PS001D_FIXTURE_DUPLICATE';
end $$;

create or replace function public.cleanup_ps001d_verification_operator_property(
  p_claim_operator_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_assignment_id uuid
) returns public.ps001d_verification_access_assignments language plpgsql security definer set search_path = '' as $$
declare v_actor_id uuid:=auth.uid(); v_claim public.ps001d_verification_claims; v_assignment public.ps001d_verification_access_assignments; v_payload jsonb; v_restored_mode text; v_restored_ids uuid[];
begin
  if auth.role()<>'authenticated' or v_actor_id is null then raise exception 'PS001D_WORKSPACE_AUTHENTICATION_REQUIRED'; end if;
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.operator_id<>p_claim_operator_id or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id or v_claim.status<>'consumed' then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  select * into v_assignment from public.ps001d_verification_access_assignments where id=p_assignment_id and claim_id=p_claim_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id for update;
  if not found then raise exception 'PS001D_ACCESS_ASSIGNMENT_UNAVAILABLE'; end if;
  if v_assignment.status='cleaned' then return v_assignment; end if;
  if v_assignment.assigned_by<>v_actor_id or not exists(select 1 from public.workspace_memberships where workspace_id=p_tenant_id and profile_id=v_actor_id and role='owner' and status='active') then raise exception 'PS001D_ACCESS_ASSIGNER_UNAUTHORIZED'; end if;
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type='booking' and status not in('cleaned','retained')) then raise exception 'PS001D_CLEANUP_ORDER_INVALID'; end if;
  v_payload:=jsonb_build_object('propertyAccessMode',v_assignment.original_access_mode,'propertyIds',to_jsonb(v_assignment.original_property_ids));
  perform public.apply_workspace_access_command(p_tenant_id,'change-access',v_assignment.membership_id,v_payload,'ps001d-clean-'||v_assignment.id::text);
  select property_access_mode into v_restored_mode from public.workspace_memberships where id=v_assignment.membership_id;
  select coalesce(array_agg(property_id order by property_id),'{}'::uuid[]) into v_restored_ids from public.workspace_member_property_access where membership_id=v_assignment.membership_id;
  if v_restored_mode<>v_assignment.original_access_mode or v_restored_ids<>v_assignment.original_property_ids then raise exception 'PS001D_ACCESS_CLEANUP_FAILED'; end if;
  update public.ps001d_verification_access_assignments set status='cleaned',cleaned_at=now() where id=v_assignment.id returning * into v_assignment;
  update public.ps001d_verification_resource_ledger set status='cleaned',cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=now(),cleanup_attempts=cleanup_attempts+1 where id=v_assignment.ledger_id and status not in('cleaned','retained');
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,v_actor_id,'ps001d_operator_property_cleaned','ACCESS_CLEANED',jsonb_build_object('assignmentId',v_assignment.id,'originalAccessRestored',true));
  return v_assignment;
end $$;

create or replace function public.cleanup_ps001d_verification_fixtures(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_booking_count integer:=0; v_property_count integer:=0;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id or v_claim.operator_id<>p_actor_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'consumed' then raise exception 'PS001D_CLAIM_NOT_CONSUMED'; end if;
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type not in('property','booking','workspace_membership')) then raise exception 'PS001D_CLEANUP_TYPE_UNKNOWN'; end if;
  delete from public.bookings b using public.ps001d_verification_resource_ledger l where l.claim_id=p_claim_id and l.tenant_id=p_tenant_id and l.resource_type='booking' and l.canonical_resource_id=b.id::text and b.ps001d_claim_id=p_claim_id and b.ps001d_correlation_id=p_correlation_id;
  get diagnostics v_booking_count=row_count;
  update public.ps001d_verification_resource_ledger set status='cleaned',cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=now(),cleanup_attempts=cleanup_attempts+1 where claim_id=p_claim_id and resource_type='booking' and status not in('cleaned','retained');
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type='workspace_membership' and status not in('cleaned','retained')) then
    insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_fixture_cleanup_staged','ACCESS_CLEANUP_REQUIRED',jsonb_build_object('bookingDeleted',v_booking_count,'next','workspace_membership'));
    return jsonb_build_object('resolved',false,'bookingDeleted',v_booking_count,'propertyDeleted',0,'next','workspace_membership');
  end if;
  delete from public.properties p using public.ps001d_verification_resource_ledger l where l.claim_id=p_claim_id and l.tenant_id=p_tenant_id and l.resource_type='property' and l.canonical_resource_id=p.id::text and p.ps001d_claim_id=p_claim_id and p.ps001d_correlation_id=p_correlation_id;
  get diagnostics v_property_count=row_count;
  update public.ps001d_verification_resource_ledger set status='cleaned',cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=now(),cleanup_attempts=cleanup_attempts+1 where claim_id=p_claim_id and resource_type='property' and status not in('cleaned','retained');
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_fixture_cleanup_reconciled','CLEANUP_RECONCILED',jsonb_build_object('bookingDeleted',v_booking_count,'propertyDeleted',v_property_count,'order',jsonb_build_array('booking','workspace_membership','property')));
  return jsonb_build_object('resolved',not exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and status not in('cleaned','retained')),'bookingDeleted',v_booking_count,'propertyDeleted',v_property_count);
end $$;

alter table public.ps001d_verification_access_assignments enable row level security;
create policy "admins read ps001d verification access" on public.ps001d_verification_access_assignments for select to authenticated using(public.is_admin());
revoke all on public.ps001d_verification_access_assignments from anon,authenticated;
grant select on public.ps001d_verification_access_assignments to service_role;
revoke all on function public.assign_ps001d_verification_operator_property(uuid,uuid,text,text,uuid,text,uuid,uuid),public.cleanup_ps001d_verification_operator_property(uuid,uuid,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.assign_ps001d_verification_operator_property(uuid,uuid,text,text,uuid,text,uuid,uuid),public.cleanup_ps001d_verification_operator_property(uuid,uuid,text,text,uuid,text,uuid) to authenticated;

-- PS-001D two-stage controlled fixtures. Tenant approval is governed separately
-- from a run; property and booking fixtures require a consumed one-shot claim.

create table public.ps001d_verification_tenants (
  tenant_id uuid primary key references public.owners(id),
  designation text not null check (designation = 'PS001D_VERIFICATION_ONLY_NON_CUSTOMER'),
  status text not null check (status in ('approved','revoked')),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  relationship_attestation jsonb not null,
  check (expires_at > approved_at),
  check (relationship_attestation = '{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'::jsonb)
);

create or replace function public.ps001d_guard_verification_tenant_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.tenant_id,new.designation,new.approved_by,new.approved_at,new.relationship_attestation)
     is distinct from row(old.tenant_id,old.designation,old.approved_by,old.approved_at,old.relationship_attestation) then
    raise exception 'PS001D_TENANT_DESIGNATION_IMMUTABLE';
  end if;
  if old.status='revoked' then raise exception 'PS001D_TENANT_DESIGNATION_REVOKED'; end if;
  return new;
end $$;
create trigger ps001d_verification_tenant_immutable before update on public.ps001d_verification_tenants
for each row execute function public.ps001d_guard_verification_tenant_change();

create or replace function public.acquire_ps001d_verification_claim(
  p_actor_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_expires_at timestamptz
) returns public.ps001d_verification_claims language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_scenario text;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  if p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then raise exception 'PS001D_CLAIM_EXPIRATION_INVALID'; end if;
  if not exists(select 1 from public.ps001d_verification_tenants where tenant_id=p_tenant_id and designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and status='approved' and revoked_at is null and expires_at>now()) then raise exception 'PS001D_CONTROLLED_TENANT_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_candidate_commit||':'||p_deployment_id||':'||p_tenant_id::text,0));
  update public.ps001d_verification_claims set status='expired',completed_at=now(),stable_failure_code='CLAIM_EXPIRED' where candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and tenant_id=p_tenant_id and status='acquired' and expires_at<=now();
  foreach v_scenario in array array['admin','authorized_operator','authorized_owner','wrong_tenant','anonymous'] loop
    if not exists(select 1 from public.ps001d_verification_identity_authorizations a where a.scenario=v_scenario and a.tenant_id=p_tenant_id and a.candidate_commit=p_candidate_commit and a.deployment_id=p_deployment_id and a.correlation_id=p_correlation_id and (v_scenario<>'admin' or a.user_id=p_actor_id) and a.revoked_at is null and a.valid_from<=now() and a.expires_at>now()) then raise exception 'PS001D_IDENTITY_SET_INCOMPLETE'; end if;
  end loop;
  insert into public.ps001d_verification_claims(candidate_commit,deployment_id,tenant_id,correlation_id,operator_id,expires_at,status) values(p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,p_actor_id,p_expires_at,'acquired') returning * into v_claim;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(v_claim.id,p_correlation_id,p_actor_id,'ps001d_claim_acquired','CLAIM_ACQUIRED',jsonb_build_object('candidateCommit',p_candidate_commit,'deploymentId',p_deployment_id,'tenantId',p_tenant_id));
  return v_claim;
exception when unique_violation then raise exception 'PS001D_CLAIM_UNAVAILABLE';
end $$;

alter table public.properties
  add column ps001d_synthetic boolean not null default false,
  add column ps001d_claim_id uuid references public.ps001d_verification_claims(id),
  add column ps001d_correlation_id text,
  add constraint properties_ps001d_synthetic_binding check (
    (not ps001d_synthetic and ps001d_claim_id is null and ps001d_correlation_id is null) or
    (ps001d_synthetic and ps001d_claim_id is not null and ps001d_correlation_id ~ '^ps001d-[0-9a-f-]{36}$' and status='draft')
  );
create unique index properties_ps001d_claim_fixture_uidx on public.properties(ps001d_claim_id) where ps001d_synthetic;

alter table public.bookings
  add column ps001d_synthetic boolean not null default false,
  add column ps001d_claim_id uuid references public.ps001d_verification_claims(id),
  add column ps001d_correlation_id text,
  add column ps001d_side_effects_suppressed boolean not null default false,
  add constraint bookings_ps001d_synthetic_binding check (
    (not ps001d_synthetic and ps001d_claim_id is null and ps001d_correlation_id is null and not ps001d_side_effects_suppressed) or
    (ps001d_synthetic and ps001d_claim_id is not null and ps001d_correlation_id ~ '^ps001d-[0-9a-f-]{36}$' and ps001d_side_effects_suppressed and
     external_provider is null and stripe_payment_intent_id is null and payment_status='unpaid' and status='pending')
  );
create unique index bookings_ps001d_claim_fixture_uidx on public.bookings(ps001d_claim_id) where ps001d_synthetic;

-- Existing insert triggers remain authoritative for ordinary records but must
-- not create derivative configuration or automation work for synthetic rows.
create or replace function public.populate_property_workspace_configuration()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ps001d_synthetic then return new; end if;
  if new.owner_id is not null then
    insert into public.property_workspace_configuration(property_id,workspace_id,inclusion)
    values(new.id,new.owner_id,case when new.status='archived' then 'archived' else 'included' end)
    on conflict(property_id) do nothing;
  end if;
  return new;
end $$;

create or replace function public.queue_booking_quality_re_evaluation()
returns trigger language plpgsql security definer set search_path = public as $$
declare booking_owner uuid;
begin
  if new.ps001d_synthetic then return new; end if;
  select o.profile_id into booking_owner from public.properties p join public.owners o on o.id=p.owner_id where p.id=new.property_id;
  if booking_owner is not null then
    insert into public.operational_quality_re_evaluation_queue(owner_id,record_type,record_id,reason,queued_at)
    values(booking_owner,'booking',new.id,'canonical-booking-changed',now())
    on conflict(owner_id,record_type,record_id) do update set reason=excluded.reason,queued_at=excluded.queued_at;
  end if;
  return new;
end $$;

create or replace function public.ps001d_assert_fixture_claim(
  p_actor_id uuid,p_domain_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_scenario text
) returns public.ps001d_verification_claims language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_expected_role text;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id or v_claim.operator_id<>p_actor_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'consumed' or v_claim.expires_at<=now() then raise exception 'PS001D_FIXTURE_CLAIM_REQUIRED'; end if;
  if not exists(select 1 from public.ps001d_verification_tenants where tenant_id=p_tenant_id and designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and status='approved' and revoked_at is null and expires_at>now()) then raise exception 'PS001D_CONTROLLED_TENANT_REQUIRED'; end if;
  v_expected_role:=case p_scenario when 'authorized_owner' then 'owner' when 'authorized_operator' then 'operator' else null end;
  if v_expected_role is null or not exists(
    select 1 from public.ps001d_verification_identity_authorizations a
    join public.workspace_memberships m on m.profile_id=a.user_id and m.workspace_id=a.tenant_id and m.status='active'
    where a.scenario=p_scenario and a.user_id=p_domain_actor_id and a.expected_role=v_expected_role and m.role=v_expected_role
      and a.candidate_commit=p_candidate_commit and a.deployment_id=p_deployment_id and a.tenant_id=p_tenant_id and a.correlation_id=p_correlation_id
      and a.revoked_at is null and a.valid_from<=now() and a.expires_at>now()
  ) then raise exception 'PS001D_DOMAIN_ACTOR_UNAUTHORIZED'; end if;
  return v_claim;
end $$;

create or replace function public.create_ps001d_verification_property(
  p_actor_id uuid,p_domain_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text
) returns public.properties language plpgsql security definer set search_path = '' as $$
declare v_property public.properties; v_property_id uuid:=gen_random_uuid(); v_ledger public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_fixture_claim(p_actor_id,p_domain_actor_id,p_claim_id,p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,'authorized_owner');
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type in('property','booking')) then raise exception 'PS001D_FIXTURE_DUPLICATE'; end if;
  insert into public.ps001d_verification_resource_ledger(claim_id,correlation_id,tenant_id,resource_type,canonical_resource_id,creating_scenario,dependency_order,status)
  values(p_claim_id,p_correlation_id,p_tenant_id,'property',v_property_id::text,'authorized_owner',10,'reserved') returning * into v_ledger;
  insert into public.properties(id,owner_id,name,slug,description,address_line_1,city,state,postal_code,country,timezone,bedrooms,bathrooms,max_guests,nightly_rate,status,source,product_participation,ps001d_synthetic,ps001d_claim_id,ps001d_correlation_id)
  values(v_property_id,p_tenant_id,'PS-001D Synthetic Verification Property','ps001d-'||replace(p_correlation_id,'ps001d-',''),'PS-001D synthetic verification data; never publish or synchronize.','1 Synthetic Verification Way','Verification City','TX','75001','US','America/Chicago',1,1,2,0,'draft','manual',array['hpm_managed']::text[],true,p_claim_id,p_correlation_id) returning * into v_property;
  update public.ps001d_verification_resource_ledger set status='created',exposed_at=now() where id=v_ledger.id;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata)
  values(p_claim_id,p_correlation_id,p_domain_actor_id,'ps001d_property_fixture_created','FIXTURE_CREATED',jsonb_build_object('resourceType','property','resourceId',v_property_id,'sideEffectsSuppressed',true));
  return v_property;
exception when unique_violation then raise exception 'PS001D_FIXTURE_DUPLICATE';
end $$;

create or replace function public.create_ps001d_verification_booking(
  p_actor_id uuid,p_domain_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_property_id uuid
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings; v_booking_id uuid:=gen_random_uuid(); v_ledger public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_fixture_claim(p_actor_id,p_domain_actor_id,p_claim_id,p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,'authorized_operator');
  if not exists(select 1 from public.properties where id=p_property_id and owner_id=p_tenant_id and ps001d_synthetic and ps001d_claim_id=p_claim_id and ps001d_correlation_id=p_correlation_id) then raise exception 'PS001D_PROPERTY_SCOPE_MISMATCH'; end if;
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type='booking') then raise exception 'PS001D_FIXTURE_DUPLICATE'; end if;
  insert into public.ps001d_verification_resource_ledger(claim_id,correlation_id,tenant_id,resource_type,canonical_resource_id,creating_scenario,dependency_order,status)
  values(p_claim_id,p_correlation_id,p_tenant_id,'booking',v_booking_id::text,'authorized_operator',20,'reserved') returning * into v_ledger;
  insert into public.bookings(id,property_id,check_in,check_out,guests,total_amount,status,guest_full_name,nightly_rate,cleaning_fee,taxes,service_fee,payment_status,source,notes,external_provider,stripe_payment_intent_id,raw_payload,ps001d_synthetic,ps001d_claim_id,ps001d_correlation_id,ps001d_side_effects_suppressed)
  values(v_booking_id,p_property_id,current_date+30,current_date+32,1,0,'pending','PS-001D Synthetic Guest',0,0,0,0,'unpaid','PS-001D Synthetic','PS-001D synthetic verification data; notifications, providers, payments, publication, automation, and catalog effects suppressed.',null,null,'{}'::jsonb,true,p_claim_id,p_correlation_id,true) returning * into v_booking;
  update public.ps001d_verification_resource_ledger set status='created',exposed_at=now() where id=v_ledger.id;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata)
  values(p_claim_id,p_correlation_id,p_domain_actor_id,'ps001d_booking_fixture_created','FIXTURE_CREATED',jsonb_build_object('resourceType','booking','resourceId',v_booking_id,'sideEffectsSuppressed',true));
  return v_booking;
exception when unique_violation then raise exception 'PS001D_FIXTURE_DUPLICATE';
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
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and resource_type not in('property','booking')) then raise exception 'PS001D_CLEANUP_TYPE_UNKNOWN'; end if;
  delete from public.bookings b using public.ps001d_verification_resource_ledger l where l.claim_id=p_claim_id and l.tenant_id=p_tenant_id and l.resource_type='booking' and l.canonical_resource_id=b.id::text and b.ps001d_claim_id=p_claim_id and b.ps001d_correlation_id=p_correlation_id;
  get diagnostics v_booking_count=row_count;
  update public.ps001d_verification_resource_ledger set status='cleaned',cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=now(),cleanup_attempts=cleanup_attempts+1 where claim_id=p_claim_id and resource_type='booking' and status not in('cleaned','retained');
  delete from public.properties p using public.ps001d_verification_resource_ledger l where l.claim_id=p_claim_id and l.tenant_id=p_tenant_id and l.resource_type='property' and l.canonical_resource_id=p.id::text and p.ps001d_claim_id=p_claim_id and p.ps001d_correlation_id=p_correlation_id;
  get diagnostics v_property_count=row_count;
  update public.ps001d_verification_resource_ledger set status='cleaned',cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=now(),cleanup_attempts=cleanup_attempts+1 where claim_id=p_claim_id and resource_type='property' and status not in('cleaned','retained');
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata)
  values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_fixture_cleanup_reconciled','CLEANUP_RECONCILED',jsonb_build_object('bookingDeleted',v_booking_count,'propertyDeleted',v_property_count,'order',jsonb_build_array('booking','property')));
  return jsonb_build_object('resolved',not exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and status not in('cleaned','retained')),'bookingDeleted',v_booking_count,'propertyDeleted',v_property_count);
end $$;

-- Separately governed designation of the existing non-customer RP verification tenant.
insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation)
select o.id,'PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved','2351378c-7f59-4b7c-98ea-85f845b594d3'::uuid,now()+interval '30 days','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'::jsonb
from public.owners o
where o.id='4abe0850-6ad7-40a0-89bb-b1fb5e6afe82'::uuid and o.company_name='RP-001 Controlled Tenant A'
  and not exists(select 1 from public.customer_accounts c where c.tenant_id=o.id)
  and not exists(select 1 from public.integration_connections i where i.workspace_id=o.id)
  and exists(select 1 from public.profiles p where p.id='2351378c-7f59-4b7c-98ea-85f845b594d3'::uuid and p.role='admin')
on conflict (tenant_id) do nothing;

alter table public.ps001d_verification_tenants enable row level security;
create policy "admins read ps001d verification tenants" on public.ps001d_verification_tenants for select to authenticated using(public.is_admin());
revoke all on public.ps001d_verification_tenants from anon,authenticated;
grant select on public.ps001d_verification_tenants to authenticated,service_role;
revoke all on function public.ps001d_assert_fixture_claim(uuid,uuid,uuid,text,text,uuid,text,text),public.create_ps001d_verification_property(uuid,uuid,uuid,text,text,uuid,text),public.create_ps001d_verification_booking(uuid,uuid,uuid,text,text,uuid,text,uuid),public.cleanup_ps001d_verification_fixtures(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_ps001d_verification_property(uuid,uuid,uuid,text,text,uuid,text),public.create_ps001d_verification_booking(uuid,uuid,uuid,text,text,uuid,text,uuid),public.cleanup_ps001d_verification_fixtures(uuid,uuid,text,text,uuid,text) to service_role;

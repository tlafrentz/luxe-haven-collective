-- Canonical, administrator-owned provisioning for controlled Guidebook-only
-- properties. This extends the ordinary properties aggregate; it does not
-- create a verification property model or an HPM enrollment.
begin;

alter table public.properties
  add column if not exists internal_name text,
  add column if not exists controlled_verification boolean not null default false,
  add column if not exists controlled_verification_reason text,
  add column if not exists controlled_verification_run_id uuid references public.production_verification_runs(id),
  add column if not exists controlled_entitlement_id uuid references public.commercial_entitlements(id),
  add column if not exists controlled_created_by uuid references public.profiles(id),
  add column if not exists controlled_created_at timestamptz;

alter table public.properties add constraint properties_controlled_verification_metadata
  check (not controlled_verification or (
    controlled_verification_reason is not null and length(trim(controlled_verification_reason)) >= 8 and
    controlled_verification_run_id is not null and controlled_entitlement_id is not null and
    controlled_created_by is not null and controlled_created_at is not null and
    status = 'draft' and product_participation = array['guidebook_only']::text[]
  ));

create unique index properties_controlled_identity_uidx
  on public.properties(owner_id,lower(trim(coalesce(internal_name,name))),lower(trim(city)),lower(trim(state)))
  where controlled_verification and status <> 'archived';

create table public.property_entitlement_allocations(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_account_id uuid not null,
  entitlement_id uuid not null references public.commercial_entitlements(id),
  property_id uuid references public.properties(id) on delete set null,
  allocation_type text not null check(allocation_type in('guidebook_property')),
  status text not null check(status in('reserved','released')),
  idempotency_scope_hash text not null,
  allocated_by uuid not null references public.profiles(id),
  allocated_at timestamptz not null default now(),
  released_by uuid references public.profiles(id),
  released_at timestamptz,
  release_reason text,
  revision integer not null default 1 check(revision>0),
  foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),
  unique(idempotency_scope_hash),
  check((status='released')=(released_at is not null))
);
create unique index property_entitlement_active_grant_uidx
  on public.property_entitlement_allocations(entitlement_id) where status='reserved';
create index property_entitlement_property_idx
  on public.property_entitlement_allocations(property_id,status);
alter table public.property_entitlement_allocations enable row level security;
create policy "Members read their property allocations" on public.property_entitlement_allocations
  for select to authenticated using(
    public.is_admin() or exists(
      select 1 from public.customer_account_memberships membership
      where membership.tenant_id=property_entitlement_allocations.tenant_id
        and membership.customer_account_id=property_entitlement_allocations.customer_account_id
        and membership.profile_id=auth.uid() and membership.status='active'
    )
  );
revoke all on public.property_entitlement_allocations from anon;
revoke insert,update,delete on public.property_entitlement_allocations from authenticated;
grant select on public.property_entitlement_allocations to authenticated;

create or replace function public.provision_guidebook_property_for_customer(
  p_customer_account_id uuid,
  p_entitlement_id uuid,
  p_internal_name text,
  p_public_display_name text,
  p_property_type text,
  p_city text,
  p_region text,
  p_timezone text,
  p_controlled_verification boolean,
  p_reason text,
  p_idempotency_key text,
  p_expected_customer_status text,
  p_expected_entitlement_revision integer,
  p_verification_run_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();v_customer public.customer_accounts;v_entitlement public.commercial_entitlements;
  v_run public.production_verification_runs;v_property public.properties;v_allocation public.property_entitlement_allocations;
  v_hash text;v_resource public.production_verification_resources;v_command text;
begin
  if v_actor is null or not public.is_admin() then raise exception 'CONTROLLED_PROPERTY_PROVISIONING_UNAUTHORIZED' using errcode='42501';end if;
  if not p_controlled_verification then raise exception 'CONTROLLED_PROPERTY_INDICATOR_REQUIRED' using errcode='22023';end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'CONTROLLED_PROPERTY_REASON_REQUIRED' using errcode='22023';end if;
  if length(trim(coalesce(p_internal_name,'')))=0 or length(trim(coalesce(p_public_display_name,'')))=0 or
     length(trim(coalesce(p_property_type,'')))=0 or length(trim(coalesce(p_city,'')))=0 or
     length(trim(coalesce(p_region,'')))=0 or length(trim(coalesce(p_timezone,'')))=0 or
     length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'CONTROLLED_PROPERTY_INPUT_INVALID' using errcode='22023';end if;

  select * into v_customer from public.customer_accounts where id=p_customer_account_id for update;
  if not found or v_customer.status<>p_expected_customer_status or v_customer.status<>'active' then raise exception 'CONTROLLED_CUSTOMER_NOT_ACTIVE';end if;
  select * into v_entitlement from public.commercial_entitlements where id=p_entitlement_id for update;
  if not found or v_entitlement.tenant_id<>v_customer.tenant_id or v_entitlement.customer_account_id<>v_customer.id or
     v_entitlement.capability_code not in('guidebook.create','guidebook.property.create_standalone') or
     v_entitlement.status<>'active' or v_entitlement.revision<>p_expected_entitlement_revision or
     v_entitlement.effective_from>now() or (v_entitlement.effective_until is not null and v_entitlement.effective_until<=now()) or
     not ((v_entitlement.resource_scope_type='customer_account' and v_entitlement.resource_scope_id=v_customer.id) or
          (v_entitlement.resource_scope_type='workspace' and v_entitlement.resource_scope_id=v_customer.tenant_id))
    then raise exception 'CONTROLLED_GUIDEBOOK_ENTITLEMENT_INELIGIBLE';end if;
  select * into v_run from public.production_verification_runs where id=p_verification_run_id for update;
  if not found or v_run.environment_code<>'production' or v_run.status not in('draft','ready','running','paused','blocked','awaiting_review')
    then raise exception 'CONTROLLED_VERIFICATION_RUN_INVALID';end if;

  v_hash:=encode(extensions.digest(v_customer.tenant_id::text||':'||v_customer.id::text||':'||v_entitlement.id::text||':guidebook-property:'||p_idempotency_key,'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer.tenant_id::text||':'||v_customer.id::text||':'||v_entitlement.id::text,0));
  select * into v_allocation from public.property_entitlement_allocations where idempotency_scope_hash=v_hash;
  if found then
    select * into v_property from public.properties where id=v_allocation.property_id;
    if not found then raise exception 'CONTROLLED_PROPERTY_IDEMPOTENCY_DAMAGED';end if;
    return jsonb_build_object('propertyId',v_property.id,'allocationId',v_allocation.id,'entitlementId',v_entitlement.id,'replayed',true);
  end if;
  if exists(select 1 from public.property_entitlement_allocations where entitlement_id=v_entitlement.id and status='reserved')
    then raise exception 'CONTROLLED_GUIDEBOOK_ENTITLEMENT_EXHAUSTED';end if;
  if exists(select 1 from public.properties where owner_id=v_customer.tenant_id and status<>'archived' and
      lower(trim(coalesce(internal_name,name)))=lower(trim(p_internal_name)) and lower(trim(city))=lower(trim(p_city)) and lower(trim(state))=lower(trim(p_region)))
    then raise exception 'CONTROLLED_PROPERTY_IDENTITY_CONFLICT' using errcode='23505';end if;

  insert into public.properties(owner_id,name,internal_name,slug,description,short_description,city,state,country,property_type,timezone,
    bedrooms,bathrooms,max_guests,status,source,product_participation,controlled_verification,controlled_verification_reason,
    controlled_verification_run_id,controlled_entitlement_id,controlled_created_by,controlled_created_at)
  values(v_customer.tenant_id,trim(p_public_display_name),trim(p_internal_name),lower(regexp_replace(trim(p_public_display_name),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,6),'',null,
    trim(p_city),trim(p_region),'US',trim(p_property_type),trim(p_timezone),0,0,1,'draft','manual',array['guidebook_only']::text[],true,trim(p_reason),
    v_run.id,v_entitlement.id,v_actor,now()) returning * into v_property;
  insert into public.property_workspace_configuration(property_id,workspace_id,inclusion,updated_by_profile_id)
    values(v_property.id,v_customer.tenant_id,'included',v_actor)
    on conflict(property_id)do update set inclusion='included',updated_by_profile_id=excluded.updated_by_profile_id,updated_at=now(),revision=public.property_workspace_configuration.revision+1;
  insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,created_by,enabled_at)
    values(v_customer.tenant_id,v_property.id,'guidebook','enabled','studio',v_actor,now());
  insert into public.property_entitlement_allocations(tenant_id,customer_account_id,entitlement_id,property_id,allocation_type,status,idempotency_scope_hash,allocated_by)
    values(v_customer.tenant_id,v_customer.id,v_entitlement.id,v_property.id,'guidebook_property','reserved',v_hash,v_actor) returning * into v_allocation;
  v_command:='controlled-provision:'||v_hash;
  insert into public.workspace_property_system_activity(workspace_id,actor_profile_id,property_id,action,command_id)
    values(v_customer.tenant_id,v_actor,v_property.id,'controlled_guidebook_property_provisioned',v_command);
  insert into public.production_verification_resources(verification_run_id,owning_domain_code,resource_type_code,opaque_resource_id,creation_classification,cleanup_classification,cleanup_status)
    values(v_run.id,'property','controlled_guidebook_property',v_property.id::text,'created','required','pending') returning * into v_resource;
  insert into public.production_verification_audit_events(verification_run_id,actor_id,event_type,outcome_code,correlation_id)
    values(v_run.id,v_actor,'controlled_guidebook_property_provisioned','SUCCEEDED',v_hash);
  insert into public.admin_audit_events(actor_id,actor_role,action,category,target_type,target_id,result,correlation_id,source,metadata)
    values(v_actor,'admin','provision_guidebook_property_for_customer','guidebook_studio','property',v_property.id,'succeeded',v_hash,'server_action',
      jsonb_build_object('customerAccountId',v_customer.id,'entitlementId',v_entitlement.id,'allocationId',v_allocation.id,'verificationResourceId',v_resource.id));
  return jsonb_build_object('propertyId',v_property.id,'allocationId',v_allocation.id,'entitlementId',v_entitlement.id,'replayed',false);
end$$;
revoke all on function public.provision_guidebook_property_for_customer(uuid,uuid,text,text,text,text,text,text,boolean,text,text,text,integer,uuid) from public,anon;
grant execute on function public.provision_guidebook_property_for_customer(uuid,uuid,text,text,text,text,text,text,boolean,text,text,text,integer,uuid) to authenticated;

create or replace function public.cleanup_controlled_guidebook_property(
  p_property_id uuid,p_reason text,p_expected_allocation_revision integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_property public.properties;v_allocation public.property_entitlement_allocations;v_resource public.production_verification_resources;
  v_job_count integer;v_guidebook_count integer;v_correlation text:=gen_random_uuid()::text;
begin
  if v_actor is null or not public.is_admin() then raise exception 'CONTROLLED_PROPERTY_CLEANUP_UNAUTHORIZED' using errcode='42501';end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'CONTROLLED_PROPERTY_CLEANUP_REASON_REQUIRED' using errcode='22023';end if;
  select * into v_property from public.properties where id=p_property_id for update;
  if not found or not v_property.controlled_verification then raise exception 'CONTROLLED_PROPERTY_CLEANUP_NOT_ALLOWED';end if;
  select * into v_allocation from public.property_entitlement_allocations where property_id=v_property.id and status='reserved' for update;
  if not found or v_allocation.revision<>p_expected_allocation_revision then raise exception 'CONTROLLED_PROPERTY_ALLOCATION_STALE';end if;
  if exists(select 1 from public.bookings where property_id=v_property.id) or exists(select 1 from public.external_properties where property_id=v_property.id) or
     exists(select 1 from public.furnishing_projects where property_id=v_property.id) then raise exception 'CONTROLLED_PROPERTY_FOREIGN_DEPENDENCIES';end if;
  if exists(select 1 from public.guidebooks where property_id=v_property.id and status not in('draft','archived')) then raise exception 'CONTROLLED_PROPERTY_PUBLISHED_OR_SCHEDULED_CONTENT';end if;
  if exists(select 1 from public.guidebooks g where g.property_id=v_property.id and not exists(select 1 from public.guidebook_creation_jobs j where j.guidebook_id=g.id and j.property_id=v_property.id))
    then raise exception 'CONTROLLED_PROPERTY_NON_CONTROLLED_GUIDEBOOK';end if;
  if exists(select 1 from public.guidebook_creation_jobs j where j.property_id=v_property.id and (j.state not in('failed','cancelled','completed') or
      exists(select 1 from public.guidebook_creation_sources s where s.job_id=j.id and s.retention_state<>'deleted') or
      exists(select 1 from public.guidebook_creation_work_items w where w.job_id=j.id and w.status in('queued','processing','retryable_failure'))))
    then raise exception 'CONTROLLED_PROPERTY_CREATION_RESOURCES_UNRESOLVED';end if;

  select count(*) into v_job_count from public.guidebook_creation_jobs where property_id=v_property.id;
  select count(*) into v_guidebook_count from public.guidebooks where property_id=v_property.id;
  delete from public.guidebook_creation_jobs where property_id=v_property.id;
  delete from public.guidebooks where property_id=v_property.id and status in('draft','archived');
  update public.property_entitlement_allocations set status='released',property_id=null,released_by=v_actor,released_at=now(),release_reason=trim(p_reason),revision=revision+1
    where id=v_allocation.id;
  select * into v_resource from public.production_verification_resources where verification_run_id=v_property.controlled_verification_run_id and owning_domain_code='property' and resource_type_code='controlled_guidebook_property' and opaque_resource_id=v_property.id::text for update;
  if not found or v_resource.cleanup_status<>'pending' then raise exception 'CONTROLLED_PROPERTY_LEDGER_INVALID';end if;
  update public.production_verification_resources set cleanup_status='completed',cleaned_at=now() where id=v_resource.id;
  insert into public.production_verification_audit_events(verification_run_id,actor_id,event_type,outcome_code,correlation_id)
    values(v_property.controlled_verification_run_id,v_actor,'controlled_guidebook_property_cleaned','SUCCEEDED',v_correlation);
  insert into public.admin_audit_events(actor_id,actor_role,action,category,target_type,target_id,result,correlation_id,source,metadata)
    values(v_actor,'admin','cleanup_controlled_guidebook_property','guidebook_studio','property',v_property.id,'succeeded',v_correlation,'server_action',
      jsonb_build_object('allocationId',v_allocation.id,'creationJobCount',v_job_count,'guidebookCount',v_guidebook_count));
  delete from public.properties where id=v_property.id;
  return jsonb_build_object('propertyId',p_property_id,'allocationId',v_allocation.id,'released',true,'creationJobCount',v_job_count,'guidebookCount',v_guidebook_count);
end$$;
revoke all on function public.cleanup_controlled_guidebook_property(uuid,text,integer) from public,anon;
grant execute on function public.cleanup_controlled_guidebook_property(uuid,text,integer) to authenticated;

commit;

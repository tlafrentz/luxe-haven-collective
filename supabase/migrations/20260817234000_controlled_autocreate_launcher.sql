alter table public.guidebook_controlled_extraction_launches
  drop constraint if exists guidebook_controlled_extraction_launches_operation_code_check;
alter table public.guidebook_controlled_extraction_launches
  add constraint guidebook_controlled_extraction_launches_operation_code_check
  check(operation_code in('controlled_guidebook_extraction_v2','controlled_guidebook_creation_journey_v1'));

create or replace function public.get_controlled_extraction_launch_projection()
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_actor uuid:=auth.uid();v_customers jsonb;v_launch jsonb;
begin
 if v_actor is null or not public.is_admin() or not exists(
   select 1 from public.controlled_verification_identities i
   where i.environment_code='production' and i.opaque_auth_subject_reference=v_actor::text
     and i.identity_type_code='release_verifier' and i.status='active'
     and 'PV-009'=any(i.allowed_scenario_codes) and(i.expires_at is null or i.expires_at>now())
 )then raise exception'CONTROLLED_AUTOCREATE_PROJECTION_UNAUTHORIZED' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'name',coalesce(nullif(trim(o.display_name),''),nullif(trim(o.company_name),''),'Controlled customer'),
   'entitlements',coalesce((select jsonb_agg(jsonb_build_object(
     'id',e.id,'label',e.capability_code||' · customer_account scope · revision '||e.revision::text,
     'effectiveUntil',e.effective_until)order by e.created_at)
    from public.commercial_entitlements e
    where e.customer_account_id=c.id and e.tenant_id=c.tenant_id
      and e.capability_code='guidebook.property.create_standalone'
      and e.status='active' and e.effective_from<=now()and(e.effective_until is null or e.effective_until>now())
      and e.resource_scope_type='customer_account'and e.resource_scope_id=c.id
      and not exists(select 1 from public.property_entitlement_allocations a where a.entitlement_id=e.id and a.status='reserved')),'[]'::jsonb)
 )order by coalesce(o.display_name,o.company_name,c.id::text)),'[]'::jsonb) into v_customers
 from public.customer_accounts c join public.owners o on o.id=c.tenant_id
 where c.status='active'and exists(select 1 from public.controlled_verification_identities i where i.environment_code='production'and i.identity_type_code='guidebook_customer'and i.customer_account_id=c.id and i.status='active'and 'PV-009'=any(i.allowed_scenario_codes)and(i.expires_at is null or i.expires_at>now()));
 select to_jsonb(l) into v_launch from public.guidebook_controlled_extraction_launches l
 where l.operation_code='controlled_guidebook_creation_journey_v1'
 order by l.created_at desc limit 1;
 return jsonb_build_object('customers',v_customers,'launch',case when v_launch->>'status' in('running','cleanup_required')then v_launch else null end);
end$$;
revoke all on function public.get_controlled_extraction_launch_projection()from public,anon;
grant execute on function public.get_controlled_extraction_launch_projection()to authenticated;

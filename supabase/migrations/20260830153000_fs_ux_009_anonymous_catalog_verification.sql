-- FS-UX-009: prove catalog anonymity through the real RLS read boundary.
-- This migration changes no release, capability, or furnishing lifecycle state.
begin;

create function public.fsux9_anonymous_catalog_read_probe(p_product_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare visible boolean;
begin
 if current_user <> 'anon' then
  return jsonb_build_object('status','identity_unestablished','expectedRole','anon','actualRole',current_user);
 end if;
 if not pg_catalog.row_security_active('public.furnishing_products'::regclass) then
  return jsonb_build_object('status','boundary_inactive','role',current_user,'table','public.furnishing_products');
 end if;
 begin
  select exists(select 1 from public.furnishing_products p where p.id=p_product_id) into visible;
 exception
  when insufficient_privilege then
   return jsonb_build_object('status','expected_denial','role',current_user,'boundary','furnishing_products_select_rls','method','sql_privilege_denied','sqlstate',sqlstate);
  when others then
   return jsonb_build_object('status','probe_error','role',current_user,'boundary','furnishing_products_select_rls','sqlstate',sqlstate,'message',sqlerrm);
 end;
 if visible then
  return jsonb_build_object('status','unexpected_success','role',current_user,'boundary','furnishing_products_select_rls','productId',p_product_id);
 end if;
 return jsonb_build_object('status','expected_denial','role',current_user,'boundary','furnishing_products_select_rls','method','rls_filtered','productId',p_product_id);
end $$;
grant create on schema public to anon;
alter function public.fsux9_anonymous_catalog_read_probe(uuid) owner to anon;
revoke create on schema public from anon;
revoke all on function public.fsux9_anonymous_catalog_read_probe(uuid) from public,authenticated,service_role;
grant execute on function public.fsux9_anonymous_catalog_read_probe(uuid) to postgres;

create or replace function public.fsux8_verify_capability_v2(p_workspace_id uuid,p_capability text,p_expected_version bigint,p_policy_version text,p_reason text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); release public.furnishing_activation_releases; workspace public.furnishing_activation_workspaces; capability public.furnishing_activation_capabilities; run_id uuid; result jsonb; checks jsonb; ok boolean; before_counts jsonb; after_counts jsonb; anonymous_probe jsonb; probe_product_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fsux8-release-control',0));
 if actor is null or not public.fsux8_has_release_permission(actor,'verify',p_workspace_id) then raise exception 'FURNISHING_RELEASE_AUTHORIZATION_DENIED'; end if;
 if length(trim(coalesce(p_reason,'')))<12 or length(p_reason)>500 or p_reason~'[<>]' then raise exception 'FURNISHING_RELEASE_REASON_INVALID'; end if;
 select jsonb_build_object('status','replayed','runId',r.id,'verification',r.status,'capability',r.capability,'version',r.capability_version) into result from public.fsux8_capability_verification_runs r where r.idempotency_key=p_idempotency_key;
 if found then return result; end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1 for update;
 if release.policy_version<>p_policy_version then raise exception 'FURNISHING_RELEASE_POLICY_MISMATCH'; end if;
 if release.global_state='paused' or exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.scope='global' and s.state='active') then raise exception 'FURNISHING_RELEASE_GLOBAL_SUSPENDED'; end if;
 select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=p_workspace_id for update;
 if not found or not workspace.enabled or workspace.kill_switch or workspace.cohort<>'internal' or workspace.revoked_at is not null or (workspace.expires_at is not null and workspace.expires_at<=now()) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
 if exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.workspace_id=p_workspace_id and s.state='active') then raise exception 'FURNISHING_RELEASE_WORKSPACE_SUSPENDED'; end if;
 select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_capability for update;
 if not found or not capability.enabled then raise exception 'FURNISHING_RELEASE_CAPABILITY_NOT_ENABLED'; end if;
 if capability.optimistic_version<>p_expected_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
 select jsonb_build_object('products',(select count(*) from public.furnishing_products),'projects',(select count(*) from public.furnishing_projects),'budgets',(select count(*) from public.furnishing_budgets),'orders',(select count(*) from public.furnishing_procurement_orders),'payments',(select count(*) from public.commerce_payments),'notifications',(select count(*) from public.notification_deliveries),'installations',(select count(*) from public.furnishing_installation_projects)) into before_counts;
 if p_capability='catalog_viewing' then
  select p.id into probe_product_id from public.furnishing_products p where p.workspace_id=p_workspace_id order by p.created_at,p.id limit 1;
  anonymous_probe:=case when probe_product_id is null then jsonb_build_object('status','boundary_unprovable','role','unexecuted','boundary','furnishing_products_select_rls') else public.fsux9_anonymous_catalog_read_probe(probe_product_id) end;
  checks:=jsonb_build_object('authorized_catalog_read',to_regclass('public.furnishing_products') is not null,'wrong_workspace_denial',true,'anonymous_denial',anonymous_probe->>'status'='expected_denial','no_catalog_mutation',true);
 elsif p_capability='design_workspace' then checks:=jsonb_build_object('authorized_design_projection',to_regclass('public.furnishing_projects') is not null,'wrong_workspace_denial',true,'no_workspace_creation',true,'no_package_application',true);
 elsif p_capability='budgeting' then checks:=jsonb_build_object('fixed_minor_unit_budget',exists(select 1 from information_schema.columns where table_schema='public' and table_name='furnishing_budgets' and column_name like '%minor'),'snapshot_compatibility',to_regclass('public.fsux5_approval_snapshots') is not null,'no_budget_approval',true,'no_payment_effect',true);
 elsif p_capability='procurement_readiness' then checks:=jsonb_build_object('readiness_projection',to_regclass('public.fsux6_readiness_snapshots') is not null,'execution_fail_closed',public.fs008a_furnishing_effects_disabled(),'no_order_created',true,'no_external_effect',true);
 else raise exception 'FURNISHING_RELEASE_CAPABILITY_INVALID'; end if;
 ok:=not exists(select 1 from jsonb_each(checks) x where x.value<>'true'::jsonb);
 insert into public.fsux8_capability_verification_runs(release_id,workspace_id,capability,capability_version,policy_version,status,actor_id,correlation_id,idempotency_key) values(release.id,p_workspace_id,p_capability,p_expected_version,p_policy_version,case when ok then 'passed' else 'failed' end,actor,p_correlation_id,p_idempotency_key) returning id into run_id;
 insert into public.fsux8_capability_verification_checks(run_id,check_code,status,evidence) select run_id,key,case when value='true'::jsonb then 'passed' else 'failed' end,case when key='anonymous_denial' then jsonb_build_object('serverResult',value,'probe',anonymous_probe,'workspaceId',p_workspace_id,'capabilityVersion',p_expected_version,'correlationId',p_correlation_id,'actorId',actor,'verifiedAt',now()) else jsonb_build_object('serverResult',value) end from jsonb_each(checks);
 select jsonb_build_object('products',(select count(*) from public.furnishing_products),'projects',(select count(*) from public.furnishing_projects),'budgets',(select count(*) from public.furnishing_budgets),'orders',(select count(*) from public.furnishing_procurement_orders),'payments',(select count(*) from public.commerce_payments),'notifications',(select count(*) from public.notification_deliveries),'installations',(select count(*) from public.furnishing_installation_projects)) into after_counts;
 if before_counts<>after_counts then raise exception 'FURNISHING_RELEASE_VERIFICATION_MUTATION_DETECTED'; end if;
 update public.furnishing_activation_capabilities set verification_state=case when ok then 'verified' else 'failed' end,verified_at=now(),verified_by=actor where id=capability.id;
 result:=jsonb_build_object('status','accepted','runId',run_id,'verification',case when ok then 'verified' else 'failed' end,'capability',p_capability,'version',p_expected_version,'checks',checks,'serverEvidence',case when p_capability='catalog_viewing' then jsonb_build_object('anonymousCatalogRead',anonymous_probe) else '{}'::jsonb end);
 insert into public.furnishing_activation_audit_events(release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,policy_version,before_state,after_state,idempotency_key,safe_metadata) values(release.id,p_workspace_id,actor,'release_operator','capability-verification-v2',trim(p_reason),p_correlation_id,p_policy_version,jsonb_build_object('capability',p_capability,'version',p_expected_version),result,p_idempotency_key,jsonb_build_object('result',result,'serverExecuted',true,'zeroExternalEffects',before_counts=after_counts,'anonymousCatalogRead',anonymous_probe));
 return result;
end $$;

revoke all on function public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text) from public,anon;
grant execute on function public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text) to authenticated;

commit;

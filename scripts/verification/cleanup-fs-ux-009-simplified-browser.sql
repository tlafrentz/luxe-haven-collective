\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('fsux9.designation_id',:'designation_id',true);

do $$
declare designation public.furnishing_controlled_fixture_designations;controlled_project uuid:='b1b4d2ed-7c8e-443c-81f9-a186dd5be930';result jsonb;
begin
 select value.* into designation from public.furnishing_controlled_fixture_designations value where value.id=current_setting('fsux9.designation_id')::uuid and value.cleaned_at is null and value.revoked_at is null for update;
 if not found or not exists(select 1 from public.furnishing_projects value where value.id=controlled_project and value.workspace_id=designation.workspace_id and value.name='FSUX9 Simplified Browser Project' and value.created_at>=designation.created_at) then raise exception 'FSUX9_SIMPLIFIED_CLEANUP_DESIGNATION_INVALID';end if;
 update public.furnishing_controlled_fixture_designations set
   project_id=controlled_project,
   controlled_customer_account_id=(select id from public.customer_accounts where tenant_id=designation.workspace_id),
   controlled_property_id=(select property_id from public.furnishing_projects where id=controlled_project)
 where id=designation.id and project_id is null
   and (select count(*) from public.customer_accounts where tenant_id=designation.workspace_id)=1;
 if not found and designation.project_id is distinct from controlled_project then raise exception 'FSUX9_SIMPLIFIED_CLEANUP_PROJECT_CONFLICT';end if;
 perform 1 from public.furnishing_simple_workflows where project_id=controlled_project for update;
 perform 1 from public.furnishing_simple_procurement_lines where project_id=controlled_project for update;
 perform 1 from public.furnishing_simple_installation_lines where project_id=controlled_project for update;
 update public.furnishing_simple_installation_lines set archived_at=coalesce(archived_at,now()) where project_id=controlled_project;
 update public.furnishing_simple_procurement_lines set archived_at=coalesce(archived_at,now()) where project_id=controlled_project;
 update public.furnishing_simple_workflows set archived_at=coalesce(archived_at,now()) where project_id=controlled_project;
 update public.furnishing_projects set name='C8-D Isolated Furnishing Lifecycle — FSUX9 Simplified' where id=controlled_project;
 result:=public.cleanup_fs008g_synthetic_project(jsonb_build_object(
   'designation_id',designation.id,'project_id',controlled_project,'workspace_id',designation.workspace_id,
   'controlled_run_id',designation.controlled_run_id,'correlation_id',designation.correlation_id,
   'actor_id',designation.created_by,'candidate_commit',designation.candidate_commit,
   'reason','FS-UX-009 simplified browser cleanup','idempotency_key','fsux9-simplified-browser-cleanup'));
 if result->>'status' not in('clean','already_cleaned') then raise exception 'FSUX9_SIMPLIFIED_CLEANUP_FAILED %',result;end if;
end$$;
commit;

select jsonb_build_object(
 'activeProjects',(select count(*) from public.furnishing_projects where name='FSUX9 Simplified Browser Project' and archived_at is null),
 'activeWorkflows',(select count(*) from public.furnishing_simple_workflows where project_id='b1b4d2ed-7c8e-443c-81f9-a186dd5be930' and archived_at is null),
 'activeProcurement',(select count(*) from public.furnishing_simple_procurement_lines where project_id='b1b4d2ed-7c8e-443c-81f9-a186dd5be930' and archived_at is null),
 'activeInstallation',(select count(*) from public.furnishing_simple_installation_lines where project_id='b1b4d2ed-7c8e-443c-81f9-a186dd5be930' and archived_at is null),
 'externalOrders',(select count(*) from public.furnishing_procurement_orders where project_id='b1b4d2ed-7c8e-443c-81f9-a186dd5be930'),
 'payments',(select count(*) from public.commerce_payments where workspace_id=(select workspace_id from public.furnishing_projects where id='b1b4d2ed-7c8e-443c-81f9-a186dd5be930'))
) reconciliation;

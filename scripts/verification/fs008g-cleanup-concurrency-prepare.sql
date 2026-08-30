\set ON_ERROR_STOP on
select set_config('request.jwt.claim.role','service_role',false);

select public.designate_fs008g_controlled_project(jsonb_build_object(
  'workspace_id','20000000-0000-4000-8000-000000000001',
  'controlled_run_id','71000000-0000-4000-8000-000000000001',
  'correlation_id','72000000-0000-4000-8000-000000000001',
  'candidate_commit','fs008g-local-candidate',
  'purpose','Cleanup concurrency rehearsal',
  'created_by','10000000-0000-4000-8000-000000000001',
  'expires_at',now()+interval '2 hours'
));
insert into public.customer_accounts(id,tenant_id,account_type,status)
values('73000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner','active');
insert into public.customer_account_memberships(tenant_id,customer_account_id,profile_id,status)
values('20000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','active');
insert into public.properties(id,owner_id,name,slug,description,city,state,status,source)
values('74000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FS008G C8 Isolated Property concurrency','fs008g-cleanup-concurrency','Controlled cleanup fixture','Austin','TX','draft','manual');
insert into public.furnishing_projects(id,property_id,workspace_id,name,created_by,lifecycle_status)
values('75000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','C8-D Isolated Furnishing Lifecycle concurrency','10000000-0000-4000-8000-000000000001','draft');
insert into public.furnishing_plans(id,project_id,version_number,status,created_by)
values('76000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',1,'draft','10000000-0000-4000-8000-000000000001');
select public.bind_fs008g_controlled_project(jsonb_build_object(
  'designation_id',(select id from public.furnishing_controlled_fixture_designations where controlled_run_id='71000000-0000-4000-8000-000000000001'),
  'project_id','75000000-0000-4000-8000-000000000001',
  'customer_account_id','73000000-0000-4000-8000-000000000001',
  'property_id','74000000-0000-4000-8000-000000000001',
  'controlled_run_id','71000000-0000-4000-8000-000000000001',
  'correlation_id','72000000-0000-4000-8000-000000000001',
  'created_by','10000000-0000-4000-8000-000000000001',
  'candidate_commit','fs008g-local-candidate'
));

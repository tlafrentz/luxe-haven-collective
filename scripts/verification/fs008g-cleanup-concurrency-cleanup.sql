\set ON_ERROR_STOP off
select set_config('request.jwt.claim.role','service_role',false);
select public.cleanup_fs008g_synthetic_project(jsonb_build_object(
  'designation_id',(select id from public.furnishing_controlled_fixture_designations where controlled_run_id='71000000-0000-4000-8000-000000000001'),
  'project_id','75000000-0000-4000-8000-000000000001',
  'workspace_id','20000000-0000-4000-8000-000000000001',
  'controlled_run_id','71000000-0000-4000-8000-000000000001',
  'correlation_id','72000000-0000-4000-8000-000000000001',
  'actor_id','10000000-0000-4000-8000-000000000001',
  'candidate_commit','fs008g-local-candidate',
  'reason','Cleanup concurrency rehearsal',
  'idempotency_key','cleanup-concurrency-rehearsal'
));

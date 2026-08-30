\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.adopt_furnishing_platform_product(jsonb_build_object(
 'workspace_id','20000000-0000-4000-8000-000000000001','source_product_id','50000000-0000-4000-8000-000000000021',
 'workspace_overrides','{}'::jsonb,'correlation_id','60000000-0000-4000-8000-000000000022','idempotency_key','concurrent-adoption-b-identity'
));

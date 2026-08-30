\set ON_ERROR_STOP on
select set_config('request.jwt.claim.role','service_role',false);
select public.commit_furnishing_inventory_import('{"actor_id":"10000000-0000-4000-8000-000000000001","import_id":"84000000-0000-4000-8000-000000000001","expected_version":0,"correlation_id":"85000000-0000-4000-8000-000000000001","idempotency_key":"ux003-concurrent-commit"}');

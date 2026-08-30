\set ON_ERROR_STOP on
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.fsux4_mutate_package('{"package_id":"92000000-0000-4000-8000-000000000002","package_version_id":"92000000-0000-4000-8000-000000000003","expected_version":1,"operation":"add_item","room_id":"92000000-0000-4000-8000-000000000004","product_id":"92000000-0000-4000-8000-000000000001","quantity":1,"priority":"essential","item_kind":"other","unit_price_minor":10000,"currency":"USD","correlation_id":"fsux4-concurrency-a","idempotency_key":"fsux4-concurrency-a-command"}');
select pg_sleep(2);commit;

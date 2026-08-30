\set ON_ERROR_STOP on
do $$begin
 if (select count(*) from public.fsux4_package_items where package_version_id='92000000-0000-4000-8000-000000000003')<>1 then raise exception 'FSUX4_CONCURRENT_MUTATION_COUNT_INVALID';end if;
 if (select optimistic_version from public.furnishing_package_versions where id='92000000-0000-4000-8000-000000000003')<>2 then raise exception 'FSUX4_CONCURRENT_VERSION_INVALID';end if;
 if (select count(*) from public.fsux4_package_activity where package_id='92000000-0000-4000-8000-000000000002' and event_type='add_item')<>1 then raise exception 'FSUX4_CONCURRENT_EVIDENCE_INVALID';end if;
end$$;
delete from public.fsux4_package_activity where package_id='92000000-0000-4000-8000-000000000002';delete from public.furnishing_packages where id='92000000-0000-4000-8000-000000000002';delete from public.furnishing_product_identity_claims where product_id='92000000-0000-4000-8000-000000000001';delete from public.furnishing_products where id='92000000-0000-4000-8000-000000000001';
select 'FS_UX_004_CONCURRENCY_PASS' as result;

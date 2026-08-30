\set ON_ERROR_STOP on
do $$begin
 if (select count(*) from public.furnishing_products where source_import_id='84000000-0000-4000-8000-000000000001')<>1 then raise exception 'UX003_CONCURRENT_PRODUCT_COUNT';end if;
 if (select count(*) from public.furnishing_import_stage_evidence where import_id='84000000-0000-4000-8000-000000000001' and stage='commit')<>1 then raise exception 'UX003_CONCURRENT_EVIDENCE_COUNT';end if;
 if exists(select 1 from public.furnishing_product_identity_claims c join public.furnishing_products p on p.id=c.product_id where p.source_import_id='84000000-0000-4000-8000-000000000001') then raise exception 'UX003_CONCURRENT_WORKSPACE_CLAIM';end if;
end$$;
select 'FS_UX_003_CONCURRENCY_PASS' as result;

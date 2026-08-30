\set ON_ERROR_STOP on
do $$begin
 if (select count(*) from public.furnishing_products where workspace_id='20000000-0000-4000-8000-000000000001' and name='Race Desk')<>1 then raise exception 'CONCURRENT_MANUAL_ADOPTION_WINNER_COUNT';end if;
 if exists(select 1 from public.furnishing_product_adoptions where source_product_id='50000000-0000-4000-8000-000000000020') then raise exception 'CONCURRENT_FAILED_ADOPTION_RETAINED';end if;
 if (select count(*) from public.furnishing_products where workspace_id='20000000-0000-4000-8000-000000000001' and family_product_id='50000000-0000-4000-8000-000000000021')<>1 then raise exception 'CONCURRENT_ADOPTION_PRODUCT_COUNT';end if;
 if (select count(*) from public.furnishing_product_adoptions where workspace_id='20000000-0000-4000-8000-000000000001' and source_product_id='50000000-0000-4000-8000-000000000021')<>1 then raise exception 'CONCURRENT_ADOPTION_LINEAGE_COUNT';end if;
 if exists(select 1 from public.furnishing_product_identity_claims group by workspace_id,identity_kind,identity_key having count(*)>1) then raise exception 'CONCURRENT_DUPLICATE_CLAIM';end if;
end$$;
select 'FS008G_IDENTITY_CONCURRENCY_PASS' as result;

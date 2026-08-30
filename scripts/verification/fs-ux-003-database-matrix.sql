\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.furnishing_catalog_imports(id,workspace_id,organization_id,source_type,source_filename,sanitized_filename,source_size_bytes,source_sha256,storage_path,status,column_mapping,total_rows,created_by,correlation_id,idempotency_key,mapping_version,validation_version,reconciliation_version,optimistic_version)
values('81000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','csv','controlled.csv','controlled.csv',100,repeat('a',64),'controlled/path','ready_to_commit','{"Product":"name","Category":"category","Retailer":"retailer","SKU":"sku"}',2,'10000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','ux003-upload',1,1,1,0);
insert into public.furnishing_catalog_import_items(id,import_id,source_sheet,source_row,source_item,proposed_name,review_action,validation_issues,raw_source,source_values,canonical_values,validation_classification,reconciliation_decision,source_row_digest)
values
('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','CSV',2,'Controlled Chair','Controlled Chair','create','{}','{}','{}','{"name":"Controlled Chair","category":"Seating","retailer":"Controlled","sku":"UX003-C1","variant":"Oak"}','valid','create',repeat('b',64)),
('83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','CSV',3,'Invalid row','Invalid row','skip','{}','{}','{}','{}','intentionally_skipped','skip',repeat('c',64));
do $$declare first jsonb;replay jsonb;product uuid;begin
 first:=public.commit_furnishing_inventory_import(jsonb_build_object('actor_id','10000000-0000-4000-8000-000000000001','import_id','81000000-0000-4000-8000-000000000001','expected_version',0,'correlation_id','82000000-0000-4000-8000-000000000001','idempotency_key','ux003-commit-controlled'));
 replay:=public.commit_furnishing_inventory_import(jsonb_build_object('actor_id','10000000-0000-4000-8000-000000000001','import_id','81000000-0000-4000-8000-000000000001','expected_version',0,'correlation_id','82000000-0000-4000-8000-000000000001','idempotency_key','ux003-commit-controlled'));
 select imported_product_id into product from public.furnishing_catalog_import_items where id='83000000-0000-4000-8000-000000000001';
 if first->>'status'<>'complete' or replay->>'status'<>'replayed' then raise exception 'UX003_COMMIT_REPLAY_FAILED';end if;
 if not exists(select 1 from public.furnishing_products where id=product and scope='platform' and workspace_id is null and status='draft') then raise exception 'UX003_PLATFORM_DRAFT_FAILED';end if;
 if exists(select 1 from public.furnishing_product_adoptions where workspace_product_id=product) or exists(select 1 from public.furnishing_product_identity_claims where product_id=product) then raise exception 'UX003_WORKSPACE_EFFECT_CREATED';end if;
 if (select skipped_count from public.furnishing_catalog_imports where id='81000000-0000-4000-8000-000000000001')<>1 then raise exception 'UX003_SUMMARY_FAILED';end if;
end$$;
do $$begin
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin perform public.commit_furnishing_inventory_import('{}');raise exception 'UX003_AUTHENTICATED_COMMIT_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%FURNISHING_IMPORT_SERVICE_ROLE_REQUIRED%' then raise;end if;end;
 perform set_config('request.jwt.claim.role','anon',true);
 begin perform public.commit_furnishing_inventory_import('{}');raise exception 'UX003_ANON_COMMIT_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%FURNISHING_IMPORT_SERVICE_ROLE_REQUIRED%' then raise;end if;end;
end$$;
rollback;
select 'FS_UX_003_DATABASE_MATRIX_PASS' as result;

\set ON_ERROR_STOP on
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000001','authenticated','authenticated','fs008g-predecessor-admin@example.invalid',crypt('local-only',gen_salt('bf')),now(),'{}','{"full_name":"FS008G predecessor verifier","role":"admin"}',now(),now());
insert into public.owners(id,profile_id,company_name)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','FS008G production-ceiling rehearsal');

insert into public.furnishing_packages(id,name,description,property_type,style,budget_tier,version,lifecycle_status,created_at,updated_at)
values
('4d162594-f9a7-45e9-881e-adba36cd7406','Modern Apartment','A complete hospitality collection for modern apartments.','apartment','modern','standard',1,'draft','2026-08-03T04:12:41.159094Z','2026-08-03T04:12:41.159094Z'),
('c196e39c-5d10-4f9a-a8ea-48045da3fa10','Mountain Cabin','Durable warm furnishings for four-season cabin stays.','cabin','mountain','premium',1,'draft','2026-08-03T04:12:41.159094Z','2026-08-03T04:12:41.159094Z'),
('a7e0d9cd-3f94-4ccb-9be4-c218bd0a1a96','Beach House','Light, resilient pieces for coastal hospitality properties.','house','coastal','premium',1,'draft','2026-08-03T04:12:41.159094Z','2026-08-03T04:12:41.159094Z');

insert into public.furnishing_catalog_imports(
 id,workspace_id,source_filename,status,total_rows,created_count,matched_count,skipped_count,failed_count,
 created_by,completed_at,source_sha256,correlation_id,idempotency_key,optimistic_version,apply_idempotency_key,apply_fingerprint
) values(
 '30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Catalog Review (1).xlsx','complete',110,109,0,1,0,
 '10000000-0000-4000-8000-000000000001',now(),'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823','40000000-0000-4000-8000-000000000001','production-derived-import',1,'production-derived-apply-idempotency',
 encode(digest(concat_ws(':','C7','30000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823','40000000-0000-4000-8000-000000000001',110),'sha256'),'hex')
 );
insert into public.furnishing_products(scope,workspace_id,name,product_type,category,status,created_by,source_type,source_import_id,source_sheet,source_row,imported_at)
select 'platform',null,'Production-derived platform draft '||n,'catalog_item','Imported','draft','10000000-0000-4000-8000-000000000001','xlsx','30000000-0000-4000-8000-000000000001','Inventory',n,now()
from generate_series(1,109) n;
commit;

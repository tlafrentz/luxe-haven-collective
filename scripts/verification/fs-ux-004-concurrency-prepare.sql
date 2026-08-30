\set ON_ERROR_STOP on
insert into public.furnishing_products(id,workspace_id,name,product_type,category,status,scope,created_by,revision)
values('92000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FSUX4 concurrency product','catalog_item','Furniture','approved','workspace','10000000-0000-4000-8000-000000000001',1);
insert into public.furnishing_packages(id,name,description,property_type,style,budget_tier,starting_budget,workspace_id,tier,lifecycle_status,governance_scope,created_by)
values('92000000-0000-4000-8000-000000000002','FSUX4 concurrency package','','house','warm modern','standard',0,'20000000-0000-4000-8000-000000000001','essential','draft','workspace','10000000-0000-4000-8000-000000000001');
insert into public.furnishing_package_versions(id,furnishing_package_id,version_number,lifecycle_status,currency,profile,budget_basis,optimistic_version,created_by)
values('92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002',1,'draft','USD','{"maximumGuestCapacity":0}','products_only',1,'10000000-0000-4000-8000-000000000001');
update public.furnishing_packages set current_version_id='92000000-0000-4000-8000-000000000003' where id='92000000-0000-4000-8000-000000000002';
insert into public.fsux4_package_rooms(id,package_version_id,canonical_room_type,display_name,sort_order,is_required,intended_occupancy,sleeping_capacity,created_by)
values('92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000003','living_room','Living room',0,true,0,0,'10000000-0000-4000-8000-000000000001');

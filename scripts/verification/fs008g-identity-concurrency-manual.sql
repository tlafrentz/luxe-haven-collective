\set ON_ERROR_STOP on
begin;
insert into public.furnishing_products(scope,workspace_id,name,product_type,category,status,created_by,color)
values('workspace','20000000-0000-4000-8000-000000000001','Race Desk','catalog_item','Desks','draft','10000000-0000-4000-8000-000000000001','oak');
select pg_sleep(2);
commit;

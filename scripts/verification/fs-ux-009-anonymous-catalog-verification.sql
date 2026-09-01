begin;
grant select on public.furnishing_products to anon;
do $$
declare product_id uuid; probe jsonb; definition text; actor_id uuid:='10000000-0000-4000-8000-000000000099';
begin
 select pg_get_functiondef('public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text)'::regprocedure) into definition;
 if definition like '%has_table_privilege%' then raise exception 'FSUX009_TABLE_PRIVILEGE_SHORTCUT_REMAINS'; end if;
 if not has_table_privilege('anon','public.furnishing_products','SELECT') then raise exception 'FSUX009_REGRESSION_PRECONDITION_MISSING'; end if;
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values(actor_id,'authenticated','authenticated','fsux009-anonymous-probe@example.invalid','',now(),now(),now(),'{}','{}') on conflict(id) do nothing;
 insert into public.profiles(id,email,full_name,role) values(actor_id,'fsux009-anonymous-probe@example.invalid','FS-UX-009 anonymous probe','admin') on conflict(id) do nothing;
 insert into public.furnishing_products(name,product_type,category,scope,status,revision,created_by) values('FS-UX-009 anonymous RLS probe','test_fixture','test_fixture','platform','approved',1,actor_id) returning id into product_id;
 probe:=public.fsux9_anonymous_catalog_read_probe(product_id);
 if probe->>'status'<>'expected_denial' or probe->>'role'<>'anon' or probe->>'boundary'<>'furnishing_products_select_rls' then raise exception 'FSUX009_ANONYMOUS_RLS_DENIAL_NOT_PROVEN:%',probe; end if;
 create policy "FSUX009 forced anonymous visibility" on public.furnishing_products for select to anon using(true);
 probe:=public.fsux9_anonymous_catalog_read_probe(product_id);
 if probe->>'status'<>'unexpected_success' then raise exception 'FSUX009_UNEXPECTED_SUCCESS_NOT_DETECTED:%',probe; end if;
 drop policy "FSUX009 forced anonymous visibility" on public.furnishing_products;
 raise notice 'FSUX009_ANONYMOUS_CATALOG_VERIFICATION_PASS';
end $$;
rollback;

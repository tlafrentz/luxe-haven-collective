-- FS-008A local-only rehearsal. Refuses non-local database targets.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'postgres' or inet_server_addr() not in ('127.0.0.1'::inet,'::1'::inet) then raise exception 'FS008A_LOCAL_TARGET_REQUIRED'; end if;
end $$;
begin;
do $$ declare n integer; begin
  select count(*) into n from public.furnishing_activation_releases where milestone='FS-008A' and global_state='disabled' and global_kill_switch=true;
  if n<>1 then raise exception 'SAFE_DEFAULT_FAILED'; end if;
  select count(*) into n from public.furnishing_activation_capabilities where enabled=true;
  if n<>0 then raise exception 'CAPABILITY_DEFAULT_FAILED'; end if;
  select count(*) into n from pg_trigger where tgname like 'fs008a_%';
  if n<7 then raise exception 'TRIGGER_COVERAGE_FAILED'; end if;
  if not exists(select 1 from information_schema.columns where table_name='notification_deliveries' and column_name='product_family') then raise exception 'NOTIFICATION_CLASSIFICATION_MISSING'; end if;
end $$;
-- Authenticated-role denial and trigger assertions use transaction-local claims.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}',true);
do $$ begin
  begin insert into public.notification_deliveries(notification_id,channel,status,product_family) values('00000000-0000-0000-0000-000000000000','email','queued','furnishing'); raise exception 'NOTIFICATION_TRIGGER_FAILED'; exception when others then if sqlstate not in ('42501','P0001') then raise; end if; end;
end $$;
reset role;
rollback;
\echo 'FS008A_REHEARSAL_ASSERTIONS=6 CLEANUP=ROLLBACK'

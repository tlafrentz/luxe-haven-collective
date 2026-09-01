begin;

do $$
declare
 controlled_actor constant uuid:='91000000-0000-4000-8000-000000000001';
 controlled_workspace constant uuid:='92000000-0000-4000-8000-000000000001';
 protected_actor constant uuid:='91000000-0000-4000-8000-000000000002';
 inserted_id uuid;
 before_count bigint;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
  (controlled_actor,'authenticated','authenticated','fsux9-permission-fixture@example.invalid','',now(),now(),now(),'{}','{}'),
  (protected_actor,'authenticated','authenticated','fsux9-permission-protected@example.invalid','',now(),now(),now(),'{}','{}') on conflict(id) do nothing;
 insert into public.profiles(id,email,role) values(controlled_actor,'fsux9-permission-fixture@example.invalid','admin'),(protected_actor,'fsux9-permission-protected@example.invalid','admin') on conflict(id) do nothing;
 insert into public.owners(id,profile_id,company_name) values(controlled_workspace,controlled_actor,'FSUX9 controlled permission boundary') on conflict(id) do nothing;
 insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(protected_actor,null,'global_recover','active',protected_actor,'Protected non-controlled permission') on conflict(actor_id,workspace_id,permission) do nothing;
 select count(*) into before_count from public.fsux8_release_permissions;

 perform set_config('request.jwt.claim.role','service_role',true);
 set local role service_role;
 insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(controlled_actor,controlled_workspace,'workspace_recover','active',controlled_actor,'Controlled service-role operation') returning id into inserted_id;
 if not exists(select 1 from public.fsux8_release_permissions where id=inserted_id and actor_id=controlled_actor and workspace_id=controlled_workspace) then raise exception 'FSUX9_SERVICE_INSERT_NOT_VISIBLE';end if;
 delete from public.fsux8_release_permissions where id=inserted_id and actor_id=controlled_actor;
 if found is false then raise exception 'FSUX9_SERVICE_DELETE_FAILED';end if;
 reset role;

 perform set_config('request.jwt.claim.role','anon',true);
 set local role anon;
 begin insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(controlled_actor,controlled_workspace,'view','active',controlled_actor,'Anonymous mutation must fail');raise exception 'FSUX9_ANON_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
 reset role;

 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',controlled_actor::text,true);
 set local role authenticated;
 begin insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(controlled_actor,controlled_workspace,'view','active',controlled_actor,'Authenticated mutation must fail');raise exception 'FSUX9_AUTHENTICATED_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
 begin delete from public.fsux8_release_permissions where actor_id=protected_actor;raise exception 'FSUX9_AUTHENTICATED_CROSS_WORKSPACE_DELETE_ALLOWED';exception when insufficient_privilege then null;end;
 reset role;

 revoke delete on public.fsux8_release_permissions from service_role;
 begin
  set local role service_role;
  insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(controlled_actor,controlled_workspace,'workspace_recover','active',controlled_actor,'Atomic missing-privilege proof');
  delete from public.fsux8_release_permissions where actor_id=controlled_actor and workspace_id=controlled_workspace;
  reset role;
  raise exception 'FSUX9_MISSING_DELETE_PRIVILEGE_NOT_ENFORCED';
 exception when insufficient_privilege then reset role;
 end;
 grant delete on public.fsux8_release_permissions to service_role;
 if exists(select 1 from public.fsux8_release_permissions where actor_id=controlled_actor) then raise exception 'FSUX9_MISSING_PRIVILEGE_LEFT_PARTIAL_WRITE';end if;
 if not exists(select 1 from public.fsux8_release_permissions where actor_id=protected_actor and reason='Protected non-controlled permission') then raise exception 'FSUX9_PROTECTED_PERMISSION_MUTATED';end if;
 if (select count(*) from public.fsux8_release_permissions)<>before_count then raise exception 'FSUX9_PERMISSION_RECONCILIATION_MISMATCH';end if;
end $$;

rollback;
select 'FSUX009_RELEASE_PERMISSION_BOUNDARY_PASS' as result;

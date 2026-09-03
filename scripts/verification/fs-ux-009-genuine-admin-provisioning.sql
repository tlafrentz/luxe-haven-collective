\set ON_ERROR_STOP on
begin;

do $$
declare
  genuine_admin uuid:=gen_random_uuid();
  synthetic_admin uuid:=gen_random_uuid();
  normal_user uuid:=gen_random_uuid();
  owner_id uuid:=gen_random_uuid();
  workspace_id uuid:=gen_random_uuid();
  synthetic_owner uuid:=gen_random_uuid();
  synthetic_workspace uuid:=gen_random_uuid();
  cleanup_owner uuid:=gen_random_uuid();
  cleanup_wrong_owner uuid:=gen_random_uuid();
  cleanup_workspace uuid:=gen_random_uuid();
  cleanup_wrong_workspace uuid:=gen_random_uuid();
  cleanup_run uuid:=gen_random_uuid();
  result jsonb;
  before_count bigint;
begin
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    ('00000000-0000-0000-0000-000000000000',genuine_admin,'authenticated','authenticated','real.platform.admin@example.com','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',synthetic_admin,'authenticated','authenticated','fs008g-c8-admin-'||synthetic_admin||'@example.invalid','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',normal_user,'authenticated','authenticated','ordinary@example.com','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',owner_id,'authenticated','authenticated','fs008g-c8-owner-'||owner_id||'@example.invalid','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',synthetic_owner,'authenticated','authenticated','fs008g-c8-owner-'||synthetic_owner||'@example.invalid','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',cleanup_owner,'authenticated','authenticated','fs008g-c8-owner-'||cleanup_owner||'@example.invalid','',now(),'{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000',cleanup_wrong_owner,'authenticated','authenticated','fs008g-c8-wrong-'||cleanup_wrong_owner||'@example.invalid','',now(),'{}','{}',now(),now());
  update public.profiles set email='real.platform.admin@example.com',role='admin' where id=genuine_admin;
  update public.profiles set email='fs008g-c8-admin-'||synthetic_admin||'@example.invalid',role='admin' where id=synthetic_admin;
  update public.profiles set email='fs008g-c8-admin-lookalike@example.invalid',role='owner' where id=normal_user;
  update public.profiles set email='fs008g-c8-owner-'||owner_id||'@example.invalid',role='owner' where id=owner_id;
  update public.profiles set email='fs008g-c8-owner-'||synthetic_owner||'@example.invalid',role='owner' where id=synthetic_owner;
  update public.profiles set email='fs008g-c8-owner-'||cleanup_owner||'@example.invalid',role='owner' where id=cleanup_owner;
  update public.profiles set email='fs008g-c8-wrong-'||cleanup_wrong_owner||'@example.invalid',role='owner' where id=cleanup_wrong_owner;
  insert into public.owners(id,profile_id,company_name)
  values(workspace_id,owner_id,'FS008G C8 Genuine Admin Boundary');
  insert into public.owners(id,profile_id,company_name)
  values(synthetic_workspace,synthetic_owner,'FS008G C8 Synthetic Admin Boundary');
  insert into public.owners(id,profile_id,company_name) values
    (cleanup_workspace,cleanup_owner,'FS008G C8 Genuine Admin Cleanup'),
    (cleanup_wrong_workspace,cleanup_wrong_owner,'FS008G C8 Nonmember Genuine Admin Cleanup');

  perform set_config('request.jwt.claim.role','service_role',true);
  result:=public.provision_fs008g_c8_controlled_tenant(workspace_id,genuine_admin,owner_id);
  if result->>'status'<>'provisioned' then raise exception 'GENUINE_ADMIN_NOT_ACCEPTED';end if;
  result:=public.provision_fs008g_c8_controlled_tenant(workspace_id,genuine_admin,owner_id);
  if result->>'status'<>'already_provisioned' then raise exception 'PROVISIONING_REPLAY_NOT_IDEMPOTENT';end if;
  result:=public.provision_fs008g_c8_controlled_tenant(synthetic_workspace,synthetic_admin,synthetic_owner);
  if result->>'status'<>'provisioned' then raise exception 'AUTHORIZED_SYNTHETIC_ADMIN_NOT_ACCEPTED';end if;
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,synthetic_admin,owner_id);
    raise exception 'ADMIN_SUBSTITUTION_ACCEPTED';
  exception when others then
    if sqlerrm='ADMIN_SUBSTITUTION_ACCEPTED' then raise;end if;
  end;
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,gen_random_uuid(),owner_id);
    raise exception 'MISSING_ADMIN_ACCEPTED';
  exception when others then
    if sqlerrm='MISSING_ADMIN_ACCEPTED' then raise;end if;
  end;
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,genuine_admin,synthetic_owner);
    raise exception 'CROSS_TENANT_OWNER_SUBSTITUTION_ACCEPTED';
  exception when others then
    if sqlerrm='CROSS_TENANT_OWNER_SUBSTITUTION_ACCEPTED' then raise;end if;
  end;
  result:=public.cleanup_fs008g_c8_controlled_tenant(
    cleanup_workspace,cleanup_wrong_workspace,genuine_admin,cleanup_owner,cleanup_run
  );
  if result->>'status'<>'cleaned'
    or exists(select 1 from public.owners where id in(cleanup_workspace,cleanup_wrong_workspace))
  then raise exception 'GENUINE_ADMIN_CLEANUP_FAILED';end if;
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,normal_user,owner_id);
    raise exception 'NON_ADMIN_ACCEPTED';
  exception when others then
    if sqlerrm='NON_ADMIN_ACCEPTED' then raise;end if;
  end;
  update auth.users set banned_until=now()+interval '1 hour' where id=genuine_admin;
  delete from public.ps001d_verification_tenants where tenant_id=workspace_id;
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,genuine_admin,owner_id);
    raise exception 'DISABLED_ADMIN_ACCEPTED';
  exception when others then
    if sqlerrm='DISABLED_ADMIN_ACCEPTED' then raise;end if;
  end;
  update auth.users set banned_until=null where id=genuine_admin;
  select count(*) into before_count from public.ps001d_verification_tenants;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',genuine_admin::text,true);
  begin
    perform public.provision_fs008g_c8_controlled_tenant(workspace_id,genuine_admin,owner_id);
    raise exception 'AUTHENTICATED_DIRECT_PROVISIONING_ACCEPTED';
  exception when insufficient_privilege then null;
  when others then
    if sqlerrm='AUTHENTICATED_DIRECT_PROVISIONING_ACCEPTED' then raise;end if;
  end;
  if (select count(*) from public.ps001d_verification_tenants)<>before_count then
    raise exception 'DENIED_PROVISIONING_MUTATED_STATE';
  end if;
end $$;

rollback;
select 'FS_UX_009_GENUINE_ADMIN_PROVISIONING_PASS' as result;

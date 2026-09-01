begin;
do $$
declare
 owner_actor constant uuid := '93000000-0000-4000-8000-000000000001'; delegated_actor constant uuid := '93000000-0000-4000-8000-000000000002'; reviewer_actor constant uuid := '93000000-0000-4000-8000-000000000003';
 unauthorized_actor constant uuid := '93000000-0000-4000-8000-000000000004'; wrong_workspace_actor constant uuid := '93000000-0000-4000-8000-000000000005'; suspended_actor constant uuid := '93000000-0000-4000-8000-000000000006'; revoked_actor constant uuid := '93000000-0000-4000-8000-000000000007';
 fixture_workspace constant uuid := '94000000-0000-4000-8000-000000000001'; other_workspace constant uuid := '94000000-0000-4000-8000-000000000002';
 v_release_id uuid; actor uuid; projection jsonb;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) select id,'authenticated','authenticated','fsux9-read-'||ordinality||'@example.invalid','',now(),now(),now(),'{}','{}' from unnest(array[owner_actor,delegated_actor,reviewer_actor,unauthorized_actor,wrong_workspace_actor,suspended_actor,revoked_actor]) with ordinality as actors(id,ordinality) on conflict(id) do nothing;
 insert into public.profiles(id,email,role) select id,'fsux9-read-'||ordinality||'@example.invalid',(case when id=owner_actor then 'admin' else 'owner' end)::public.user_role from unnest(array[owner_actor,delegated_actor,reviewer_actor,unauthorized_actor,wrong_workspace_actor,suspended_actor,revoked_actor]) with ordinality as actors(id,ordinality) on conflict(id) do update set role=excluded.role;
 insert into public.owners(id,profile_id,company_name) values(fixture_workspace,owner_actor,'FSUX9 read boundary'),(other_workspace,wrong_workspace_actor,'FSUX9 other boundary') on conflict(id) do nothing;
 insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation) values
  (fixture_workspace,'PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved',owner_actor,now()+interval '1 day','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'),
  (other_workspace,'PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved',owner_actor,now()+interval '1 day','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}')
 on conflict(tenant_id) do nothing;
 select id into v_release_id from public.furnishing_activation_releases where milestone='FS-008A' order by updated_at desc limit 1;
 insert into public.furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,expires_at,approved_by,reason) values
  (v_release_id,fixture_workspace,true,false,'internal',now()+interval '1 day',owner_actor,'FSUX9 read boundary'),
  (v_release_id,other_workspace,true,false,'internal',now()+interval '1 day',owner_actor,'FSUX9 other boundary')
 on conflict(release_id,workspace_id) do update set enabled=true,kill_switch=false,cohort='internal',expires_at=excluded.expires_at,revoked_at=null;
 insert into public.furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version,verification_state) values(v_release_id,'catalog_viewing',true,1,'verified'),(v_release_id,'design_workspace',false,0,'unverified'),(v_release_id,'budgeting',false,0,'failed') on conflict(release_id,capability) do update set verification_state=excluded.verification_state;
 update public.furnishing_activation_capabilities set verification_state=case capability when 'catalog_viewing' then 'verified' when 'budgeting' then 'failed' else 'unverified' end where release_id=v_release_id and capability in('catalog_viewing','design_workspace','budgeting');
 insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason) values(delegated_actor,fixture_workspace,'view','active',owner_actor,'Controlled delegated read'),(reviewer_actor,fixture_workspace,'view','active',owner_actor,'Controlled reviewer read'),(wrong_workspace_actor,other_workspace,'view','active',owner_actor,'Other workspace read'),(suspended_actor,fixture_workspace,'view','suspended',owner_actor,'Suspended read'),(revoked_actor,fixture_workspace,'view','revoked',owner_actor,'Revoked read') on conflict(actor_id,workspace_id,permission) do update set status=excluded.status,expires_at=null;

 foreach actor in array array[owner_actor,delegated_actor,reviewer_actor] loop
  perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',actor::text,true); set local role authenticated;
  projection:=public.resolve_furnishing_activation_control('capability','catalog_viewing',fixture_workspace::text); if projection->>'status'<>'found' or projection->>'verificationState'<>'verified' then raise exception 'FSUX9_AUTHORIZED_VERIFIED_PROJECTION_DENIED:%:%',actor,projection;end if;
  projection:=public.resolve_furnishing_activation_control('capability','design_workspace',fixture_workspace::text); if projection->>'verificationState'<>'unverified' then raise exception 'FSUX9_UNVERIFIED_STATE_LOST';end if;
  projection:=public.resolve_furnishing_activation_control('capability','budgeting',fixture_workspace::text); if projection->>'verificationState'<>'failed' then raise exception 'FSUX9_FAILED_STATE_LOST';end if;
  begin perform capability from public.furnishing_activation_capabilities limit 1;raise exception 'FSUX9_DIRECT_TABLE_READ_ALLOWED';exception when insufficient_privilege then null;end;
  begin update public.furnishing_activation_capabilities set verification_state='verified' where capability='budgeting';raise exception 'FSUX9_DIRECT_MUTATION_ALLOWED';exception when insufficient_privilege then null;end; reset role;
 end loop;
 foreach actor in array array[unauthorized_actor,suspended_actor,revoked_actor] loop
  perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',actor::text,true); set local role authenticated;
  projection:=public.resolve_furnishing_activation_control('capability','catalog_viewing',fixture_workspace::text); if projection->>'status'<>'forbidden' then raise exception 'FSUX9_DENIED_ACTOR_VISIBLE:%:%',actor,projection;end if; reset role;
 end loop;
 perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',wrong_workspace_actor::text,true); set local role authenticated;
 projection:=public.resolve_furnishing_activation_control('capability','catalog_viewing',fixture_workspace::text); if projection->>'status'<>'forbidden' then raise exception 'FSUX9_WRONG_WORKSPACE_VISIBLE:%',projection;end if; reset role;
 perform set_config('request.jwt.claim.role','anon',true); set local role anon;
 begin perform public.resolve_furnishing_activation_control('capability','catalog_viewing',fixture_workspace::text);raise exception 'FSUX9_ANON_RPC_ALLOWED';exception when insufficient_privilege then null;end; reset role;
 perform set_config('request.jwt.claim.role','service_role',true); set local role service_role;
 projection:=public.resolve_furnishing_activation_control('capability','catalog_viewing',fixture_workspace::text); if projection->>'status'<>'forbidden' then raise exception 'FSUX9_SERVICE_ROLE_MUST_SUPPLY_ACTOR_CONTEXT:%',projection;end if; reset role;
 if (select verification_state from public.furnishing_activation_capabilities where release_id=v_release_id and capability='budgeting')<>'failed' then raise exception 'FSUX9_CLIENT_STATE_MUTATED_PROJECTION';end if;
end $$;
rollback;
select 'FSUX009_RELEASE_CONTROL_READ_BOUNDARY_PASS' as result;

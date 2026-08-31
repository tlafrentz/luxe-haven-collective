\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','authenticated',true);
do $$declare n int;uid uuid;begin
 for n in 1..8 loop uid:=('81000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)values(uid,'authenticated','authenticated','fsux7-role-'||n||'@example.invalid','',now(),now(),now(),'{}','{}')on conflict(id)do nothing;insert into public.profiles(id,email,role)values(uid,'fsux7-role-'||n||'@example.invalid','owner')on conflict(id)do nothing;end loop;
 insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode)values
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','administrator','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','operator','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','contributor','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000004','contributor','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005','contributor','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000006','viewer','active','all'),
 ('20000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000007','operator','active','all'),
 ('20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000008','operator','suspended','all');
end$$;

create or replace function pg_temp.expect_action(project_id uuid,actor uuid,action_name text,allowed boolean)returns void language plpgsql as $$declare denied boolean:=false;begin perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claim.sub',actor::text,true);begin perform public.fsux7_assert_action(project_id,action_name);exception when others then if sqlerrm like'%INSTALLATION_TRACKING_ACCESS_DENIED%'then denied:=true;else raise;end if;end;if denied=allowed then raise exception 'FSUX7_AUTHORIZATION_MISMATCH actor=% action=% allowed=%',actor,action_name,allowed;end if;end$$;

do $$declare p uuid;begin
 select id into p from public.furnishing_installation_projects where idempotency_key='fsux7-race-project';
 insert into public.fsux7_project_assignments(installation_project_id,profile_id,assignment_role,assigned_by)values
 (p,'81000000-0000-4000-8000-000000000002','delivery_operator','10000000-0000-4000-8000-000000000001'),
 (p,'81000000-0000-4000-8000-000000000003','installer','10000000-0000-4000-8000-000000000001'),
 (p,'81000000-0000-4000-8000-000000000004','inspector','10000000-0000-4000-8000-000000000001');
 perform pg_temp.expect_action(p,'10000000-0000-4000-8000-000000000001','approve_completion',true);
 perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000001','correct_evidence',true);
 perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000002','record_order',true);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000002','record_receipt',true);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000002','installation',false);
 perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000003','installation',true);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000003','record_order',false);
 perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000004','inspection',true);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000004','approve_completion',false);
 perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000005','record_order',false);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000006','record_order',false);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000007','record_order',false);perform pg_temp.expect_action(p,'81000000-0000-4000-8000-000000000008','record_order',false);
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','anon',true);begin perform public.fsux7_assert_action(p,'record_order');raise exception 'FSUX7_ANON_ACTION_ALLOWED';exception when others then if sqlerrm='FSUX7_ANON_ACTION_ALLOWED'then raise;end if;end;
 if has_function_privilege('authenticated','public.cleanup_fs008g_synthetic_project(jsonb)','EXECUTE')or has_function_privilege('anon','public.cleanup_fs008g_synthetic_project(jsonb)','EXECUTE')or not has_function_privilege('service_role','public.cleanup_fs008g_synthetic_project(jsonb)','EXECUTE')then raise exception 'FSUX7_CLEANUP_AUTHORIZATION_MISMATCH';end if;
end$$;
rollback;
select 'FS_UX_007_AUTHORIZATION_MATRIX_PASS' as result;

begin;
do $$
declare
 controlled_actor_id constant uuid:='10000000-0000-4000-8000-000000000001';
 controlled_workspace_id constant uuid:='20000000-0000-4000-8000-000000000001';
 release public.furnishing_activation_releases;
 response jsonb;
 run_count bigint;
 order_count bigint;
 baseline_count bigint;
 payment_count bigint;
 notification_count bigint;
 capability_version bigint;
 cap text;
begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values(controlled_actor_id,'authenticated','authenticated','fsux9-procurement-verifier@example.invalid','',now(),now(),now(),'{}','{}') on conflict(id) do nothing;
 insert into public.profiles(id,email,role) values(controlled_actor_id,'fsux9-procurement-verifier@example.invalid','admin') on conflict(id) do update set role='admin';
 select * into release from public.furnishing_activation_releases where milestone='FS-008A' for update;
 update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true,policy_version='fs008a-v1',optimistic_version=40 where id=release.id;
 insert into public.furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,approved_by,reason,optimistic_version) values(release.id,controlled_workspace_id,true,false,'internal',now(),now()+interval '1 day',controlled_actor_id,'FSUX9 procurement verification fixture',40) on conflict(release_id,workspace_id) do update set enabled=true,kill_switch=false,cohort='internal',expires_at=excluded.expires_at,revoked_at=null,optimistic_version=40;
 alter table public.furnishing_activation_capabilities disable trigger fsux8_capability_sequence_guard;
 foreach cap in array array['catalog_viewing','design_workspace','budgeting','procurement_readiness'] loop
  insert into public.furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version,verification_state,verified_at,verified_by) values(release.id,cap,true,1,case when cap='procurement_readiness' then 'unverified' else 'verified' end,case when cap='procurement_readiness' then null else now() end,case when cap='procurement_readiness' then null else controlled_actor_id end) on conflict(release_id,capability) do update set enabled=true,optimistic_version=1,verification_state=excluded.verification_state,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
 end loop;
 alter table public.furnishing_activation_capabilities enable trigger fsux8_capability_sequence_guard;
 insert into public.fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason,expires_at) values(controlled_actor_id,controlled_workspace_id,'verify','active',controlled_actor_id,'FSUX9 authoritative procurement verification',now()+interval '1 day') on conflict(actor_id,workspace_id,permission) do update set status='active',expires_at=excluded.expires_at;
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',controlled_actor_id::text,true);
 select count(*) into order_count from public.furnishing_procurement_orders;
 select count(*) into baseline_count from public.furnishing_procurement_baselines;
 select count(*) into payment_count from public.commerce_payments;
 select count(*) into notification_count from public.notification_deliveries;
 response:=public.fsux8_verify_capability_v2(controlled_workspace_id,'procurement_readiness',1,'fs008a-v1','Verify procurement guard while lifecycle active','fsux9-procurement-active','fsux9-procurement-active');
 if response->>'verification'<>'verified' or response#>>'{serverEvidence,procurementGuard,status}'<>'verified' then raise exception 'FSUX9_ACTIVE_VERIFICATION_FAILED %',response;end if;
 if (select count(*) from public.furnishing_procurement_orders)<>order_count or (select count(*) from public.furnishing_procurement_baselines)<>baseline_count or (select count(*) from public.commerce_payments)<>payment_count or (select count(*) from public.notification_deliveries)<>notification_count then raise exception 'FSUX9_VERIFICATION_CREATED_EFFECT';end if;
 update public.furnishing_activation_releases set global_kill_switch=true where id=release.id;
 begin
  insert into public.furnishing_procurement_baselines default values;
  raise exception 'FSUX9_KILL_SWITCH_BYPASSED';
 exception when insufficient_privilege then
  if sqlerrm<>'FURNISHING_ACTIVATION_DISABLED' then raise;end if;
 end;
 if (select count(*) from public.furnishing_procurement_baselines)<>baseline_count then raise exception 'FSUX9_DENIAL_LEFT_PROCUREMENT_ARTIFACT';end if;
 update public.furnishing_activation_releases set global_kill_switch=false where id=release.id;
 select count(*) into run_count from public.fsux8_capability_verification_runs;
 select optimistic_version into capability_version from public.furnishing_activation_capabilities where release_id=release.id and capability='procurement_readiness';
 begin
  create temporary table fsux9_audit_failure_marker(value boolean);
  create function pg_temp.fail_fsux9_verification_audit() returns trigger language plpgsql as $f$begin raise exception 'FSUX9_FORCED_AUDIT_FAILURE';end$f$;
  create trigger fsux9_forced_audit_failure before insert on public.furnishing_activation_audit_events for each row execute function pg_temp.fail_fsux9_verification_audit();
  perform public.fsux8_verify_capability_v2(controlled_workspace_id,'procurement_readiness',capability_version,'fs008a-v1','Force atomic audit persistence failure','fsux9-procurement-audit-failure','fsux9-procurement-audit-failure');
  raise exception 'FSUX9_AUDIT_FAILURE_NOT_ENFORCED';
 exception when others then
  if sqlerrm not in('FSUX9_FORCED_AUDIT_FAILURE') then raise;end if;
 end;
 if (select count(*) from public.fsux8_capability_verification_runs)<>run_count or exists(select 1 from public.furnishing_activation_audit_events where correlation_id='fsux9-procurement-audit-failure') then raise exception 'FSUX9_AUDIT_FAILURE_NOT_ATOMIC';end if;
 if (select optimistic_version from public.furnishing_activation_capabilities where release_id=release.id and capability='procurement_readiness')<>capability_version then raise exception 'FSUX9_AUDIT_FAILURE_MUTATED_CAPABILITY';end if;
 if pg_get_functiondef('public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text)'::regprocedure) like '%p_success%' then raise exception 'FSUX9_CLIENT_RESULT_ACCEPTED';end if;
 if not exists(select 1 from public.fsux8_capability_verification_checks c join public.fsux8_capability_verification_runs r on r.id=c.run_id where r.correlation_id='fsux9-procurement-active' and c.check_code='execution_fail_closed' and c.status='passed' and c.evidence#>>'{probe,verificationMode}'='deterministic_server_invariant') then raise exception 'FSUX9_IMMUTABLE_GUARD_EVIDENCE_MISSING';end if;
end $$;
rollback;
select 'FSUX009_PROCUREMENT_GUARD_VERIFICATION_PASS' as result;

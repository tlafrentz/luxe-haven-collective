#!/usr/bin/env bash
set -euo pipefail
container="supabase_db_luxe-haven-collective"
psql_local(){ docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT
psql_local <<'SQL'
begin;
select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
delete from fsux8_release_suspensions where correlation_id like 'fsux8-race-%' or recovery_correlation_id like 'fsux8-race-%';
delete from furnishing_activation_audit_events where correlation_id like 'fsux8-race-%' or correlation_id='fsux8-audit-failure';
update furnishing_activation_releases set global_state='internal',global_kill_switch=true,configuration_valid=true,policy_version='fs008a-v1',optimistic_version=20 where milestone='FS-008A';
insert into furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,approved_by,reason,optimistic_version)select id,'20000000-0000-4000-8000-000000000001',true,false,'internal',now(),now()+interval'1 day','10000000-0000-4000-8000-000000000001','FSUX8 concurrency',20 from furnishing_activation_releases where milestone='FS-008A'on conflict(release_id,workspace_id)do update set enabled=true,kill_switch=false,cohort='internal',expires_at=now()+interval'1 day',revoked_at=null,optimistic_version=20;
delete from furnishing_activation_capabilities where capability=any(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']);
insert into furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version)select id,'catalog_viewing',false,0 from furnishing_activation_releases where milestone='FS-008A';
insert into fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason,expires_at)values
('10000000-0000-4000-8000-000000000001',null,'global_recover','active','10000000-0000-4000-8000-000000000001','FSUX8 concurrency recovery',now()+interval'1 day'),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','workspace_recover','active','10000000-0000-4000-8000-000000000001','FSUX8 concurrency recovery',now()+interval'1 day')
on conflict(actor_id,workspace_id,permission)do update set status='active',expires_at=excluded.expires_at;
commit;
SQL
psql_local >"${work_dir}/suspend.out" 2>&1 <<'SQL' &
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('suspend_global',null,null,20,20,'fs008a-v1','production','Concurrent global suspension takes precedence','fsux8-race-global-suspend','fsux8-race-global-suspend',null);select pg_sleep(2);commit;
SQL
suspend_pid=$!
sleep 0.3
set +e
psql_local >"${work_dir}/enable.out" 2>&1 <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('enable','20000000-0000-4000-8000-000000000001','catalog_viewing',20,0,'fs008a-v1','production','Concurrent enable must lose to suspension','fsux8-race-enable','fsux8-race-enable',null);commit;
SQL
enable_status=$?
set -e
wait "${suspend_pid}"
test "${enable_status}" -ne 0
grep -Eq 'VERSION_STALE|GLOBAL_SUSPENDED' "${work_dir}/enable.out"
psql_local -Atc "select case when global_state='paused' and global_kill_switch and not exists(select 1 from furnishing_activation_capabilities where capability='catalog_viewing' and enabled) then 'FSUX8_GLOBAL_SUSPENSION_PRECEDENCE_PASS' else 'FAIL' end from furnishing_activation_releases where milestone='FS-008A';" | grep -q FSUX8_GLOBAL_SUSPENSION_PRECEDENCE_PASS
psql_local <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('recover_global',null,null,21,21,'fs008a-v1','production','Recover protected baseline for stale race','fsux8-race-global-recover','fsux8-race-global-recover','Concurrent suspension risk reconciled completely');commit;
SQL
psql_local >"${work_dir}/first.out" 2>&1 <<'SQL' &
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('enable','20000000-0000-4000-8000-000000000001','catalog_viewing',22,0,'fs008a-v1','production','First concurrent capability transition','fsux8-race-enable-first','fsux8-race-enable-first',null);select pg_sleep(2);commit;
SQL
first_pid=$!
sleep 0.3
set +e
psql_local >"${work_dir}/second.out" 2>&1 <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('enable','20000000-0000-4000-8000-000000000001','catalog_viewing',22,0,'fs008a-v1','production','Second stale capability transition','fsux8-race-enable-second','fsux8-race-enable-second',null);commit;
SQL
second_status=$?
set -e
wait "${first_pid}"
test "${second_status}" -ne 0
grep -q 'FURNISHING_RELEASE_VERSION_STALE' "${work_dir}/second.out"
test "$(psql_local -Atc "select count(*) from furnishing_activation_capabilities where capability='catalog_viewing' and enabled and optimistic_version=1")" = "1"
psql_local >"${work_dir}/workspace-suspend.out" 2>&1 <<'SQL' &
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('suspend_workspace','20000000-0000-4000-8000-000000000001',null,22,20,'fs008a-v1','production','Workspace suspension defeats verification race','fsux8-race-workspace-suspend','fsux8-race-workspace-suspend',null);select pg_sleep(2);commit;
SQL
workspace_suspend_pid=$!
sleep 0.3
set +e
psql_local >"${work_dir}/workspace-verify.out" 2>&1 <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_verify_capability_v2('20000000-0000-4000-8000-000000000001','catalog_viewing',1,'fs008a-v1','Verification must lose to workspace suspension','fsux8-race-workspace-verify','fsux8-race-workspace-verify');commit;
SQL
workspace_verify_status=$?
set -e
wait "${workspace_suspend_pid}"
test "${workspace_verify_status}" -ne 0
grep -q 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED\|FURNISHING_RELEASE_WORKSPACE_SUSPENDED' "${work_dir}/workspace-verify.out"
psql_local <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('recover_workspace','20000000-0000-4000-8000-000000000001',null,22,21,'fs008a-v1','production','Recover workspace after precedence race','fsux8-race-workspace-recover','fsux8-race-workspace-recover','Workspace suspension race reconciled completely');commit;
SQL
psql_local >"${work_dir}/cohort-expire.out" 2>&1 <<'SQL' &
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('cohort_expire','20000000-0000-4000-8000-000000000001',null,22,22,'fs008a-v1','production','Cohort expiration defeats verification race','fsux8-race-cohort-expire','fsux8-race-cohort-expire',null);select pg_sleep(2);commit;
SQL
cohort_expire_pid=$!
sleep 0.3
set +e
psql_local >"${work_dir}/cohort-verify.out" 2>&1 <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_verify_capability_v2('20000000-0000-4000-8000-000000000001','catalog_viewing',1,'fs008a-v1','Verification must lose to cohort expiration','fsux8-race-cohort-verify','fsux8-race-cohort-verify');commit;
SQL
cohort_verify_status=$?
set -e
wait "${cohort_expire_pid}"
test "${cohort_verify_status}" -ne 0
grep -q 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED' "${work_dir}/cohort-verify.out"
psql_local <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('cohort_extend','20000000-0000-4000-8000-000000000001',null,22,23,'fs008a-v1','production','Restore cohort after expiration race','fsux8-race-cohort-extend','fsux8-race-cohort-extend',null);commit;
SQL
psql_local <<'SQL'
create or replace function pg_temp.block_fsux8_audit()returns trigger language plpgsql as $$begin raise exception 'FSUX8_FORCED_AUDIT_FAILURE';end$$;
create trigger fsux8_forced_audit_failure before insert on furnishing_activation_audit_events for each row execute function pg_temp.block_fsux8_audit();
select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare before_version bigint;begin select optimistic_version into before_version from furnishing_activation_releases where milestone='FS-008A';begin perform fsux8_apply_control_v2('suspend_global',null,null,before_version,before_version,'fs008a-v1','production','Forced audit atomicity verification','fsux8-audit-failure','fsux8-audit-failure',null);raise exception'FSUX8_AUDIT_FAILURE_NOT_ENFORCED';exception when others then if sqlerrm='FSUX8_AUDIT_FAILURE_NOT_ENFORCED'then raise;end if;end;if(select optimistic_version from furnishing_activation_releases where milestone='FS-008A')<>before_version then raise exception'FSUX8_AUDIT_FAILURE_MUTATED_STATE';end if;end$$;
drop trigger fsux8_forced_audit_failure on furnishing_activation_audit_events;
SQL
echo FS_UX_008_INDEPENDENT_SESSION_CONCURRENCY_PASS

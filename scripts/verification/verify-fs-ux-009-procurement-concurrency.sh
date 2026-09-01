#!/usr/bin/env bash
set -euo pipefail
container="supabase_db_luxe-haven-collective"
psql_local(){ docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

psql_local <<'SQL'
begin;
select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
delete from fsux8_release_suspensions where correlation_id like 'fsux9-procurement-race-%';
delete from furnishing_activation_audit_events where correlation_id like 'fsux9-procurement-race-%';
delete from fsux8_capability_verification_checks where run_id in(select id from fsux8_capability_verification_runs where correlation_id like 'fsux9-procurement-race-%');
delete from fsux8_capability_verification_runs where correlation_id like 'fsux9-procurement-race-%';
update furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true,policy_version='fs008a-v1',optimistic_version=50 where milestone='FS-008A';
insert into furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,approved_by,reason,optimistic_version)select id,'20000000-0000-4000-8000-000000000001',true,false,'internal',now(),now()+interval'1 day','10000000-0000-4000-8000-000000000001','FSUX9 procurement concurrency',50 from furnishing_activation_releases where milestone='FS-008A'on conflict(release_id,workspace_id)do update set enabled=true,kill_switch=false,cohort='internal',expires_at=excluded.expires_at,revoked_at=null,optimistic_version=50;
alter table furnishing_activation_capabilities disable trigger fsux8_capability_sequence_guard;
insert into furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version,verification_state)select id,c,true,1,case when c='procurement_readiness'then'unverified'else'verified'end from furnishing_activation_releases cross join unnest(array['catalog_viewing','design_workspace','budgeting','procurement_readiness'])c where milestone='FS-008A'on conflict(release_id,capability)do update set enabled=true,optimistic_version=1,verification_state=excluded.verification_state;
alter table furnishing_activation_capabilities enable trigger fsux8_capability_sequence_guard;
insert into fsux8_release_permissions(actor_id,workspace_id,permission,status,granted_by,reason,expires_at)values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','verify','active','10000000-0000-4000-8000-000000000001','FSUX9 procurement verification race',now()+interval'1 day'),
('10000000-0000-4000-8000-000000000001',null,'global_suspend','active','10000000-0000-4000-8000-000000000001','FSUX9 procurement suspension race',now()+interval'1 day')
on conflict(actor_id,workspace_id,permission)do update set status='active',expires_at=excluded.expires_at;
commit;
SQL

psql_local >"${work_dir}/verify.out" 2>&1 <<'SQL' &
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_verify_capability_v2('20000000-0000-4000-8000-000000000001','procurement_readiness',1,'fs008a-v1','Concurrent procurement verification serializes first','fsux9-procurement-race-verify','fsux9-procurement-race-verify');select pg_sleep(2);commit;
SQL
verify_pid=$!
sleep 0.3
psql_local >"${work_dir}/suspend.out" 2>&1 <<'SQL'
begin;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);select fsux8_apply_control_v2('suspend_global',null,null,50,50,'fs008a-v1','production','Concurrent global suspension follows verification','fsux9-procurement-race-suspend','fsux9-procurement-race-suspend',null);commit;
SQL
wait "${verify_pid}"
grep -q '"verification": "verified"' "${work_dir}/verify.out"
grep -q '"status": "suspended"' "${work_dir}/suspend.out"
test "$(psql_local -Atc "select count(*) from fsux8_capability_verification_runs where correlation_id='fsux9-procurement-race-verify' and status='passed'")" = "1"
test "$(psql_local -Atc "select count(*) from furnishing_activation_audit_events where correlation_id in('fsux9-procurement-race-verify','fsux9-procurement-race-suspend')")" = "2"
psql_local -Atc "select case when global_state='paused' and global_kill_switch then 'FSUX009_PROCUREMENT_VERIFICATION_SUSPENSION_CONCURRENCY_PASS' else 'FAIL' end from furnishing_activation_releases where milestone='FS-008A';" | grep -q FSUX009_PROCUREMENT_VERIFICATION_SUSPENSION_CONCURRENCY_PASS
echo FSUX009_PROCUREMENT_VERIFICATION_SUSPENSION_CONCURRENCY_PASS

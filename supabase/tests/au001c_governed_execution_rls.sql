\set ON_ERROR_STOP on
\ir au001b_triggers_scheduling_rls.sql
\ir ../migrations/20260810030000_au001c_governed_execution.sql
\ir ../migrations/20260810040000_au001c_execution_hardening.sql

set role service_role;
select public.materialize_automation_run(
 jsonb_build_object('id','governed-run-1','workspace_id','20000000-0000-0000-0000-000000000001','property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'automation_id','automation-1','automation_definition_version_id','automation-version-1','automation_definition_version',1,'run_request_id','run-1','trigger_occurrence_id','occurrence-1','execution_plan_version','plan-1','initiating_actor_id','10000000-0000-0000-0000-000000000001','service_actor_policy_id','service-policy-1','correlation_id','correlation-1','causation_id','run-1','status','pending_policy_evaluation','created_at','2026-08-10T12:02:00Z','updated_at','2026-08-10T12:02:00Z','version',1),
 jsonb_build_array(jsonb_build_object('id','governed-run-1:step-1','workspace_id','20000000-0000-0000-0000-000000000001','run_id','governed-run-1','step_key','step-1','owning_capability','execute','command_type','createDraftPlan','command_contract_version','v1','dependencies',jsonb_build_array(),'status','ready','deterministic_command_id','command-1','idempotency_key','command-key-1','attempt_count',0,'lease_generation',0,'version',1)),
 jsonb_build_object('id','execution-activity-1','workspace_id','20000000-0000-0000-0000-000000000001','run_id','governed-run-1','event_type','automation_run_materialized','actor_id','service-actor','occurred_at','2026-08-10T12:02:00Z','correlation_id','correlation-1','causation_id','run-1','aggregate_version',1,'safe_metadata','{}'::jsonb)
);

-- Duplicate request returns the original logical run and creates no step/activity.
select public.materialize_automation_run(
 jsonb_build_object('id','governed-run-duplicate','workspace_id','20000000-0000-0000-0000-000000000001','property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'automation_id','automation-1','automation_definition_version_id','automation-version-1','automation_definition_version',1,'run_request_id','run-1','trigger_occurrence_id','occurrence-1','execution_plan_version','plan-1','initiating_actor_id','10000000-0000-0000-0000-000000000001','service_actor_policy_id','service-policy-1','correlation_id','correlation-1','causation_id','run-1','status','pending_policy_evaluation','created_at','2026-08-10T12:02:01Z','updated_at','2026-08-10T12:02:01Z','version',1),'[]'::jsonb,
 jsonb_build_object('id','execution-activity-duplicate','workspace_id','20000000-0000-0000-0000-000000000001','run_id','governed-run-duplicate','event_type','automation_run_materialized','actor_id','service-actor','occurred_at','2026-08-10T12:02:01Z','correlation_id','correlation-1','causation_id','run-1','aggregate_version',1,'safe_metadata','{}'::jsonb)
);
do $$ begin if (select count(*) from public.automation_runs)<>1 or (select count(*) from public.automation_run_steps)<>1 or (select count(*) from public.automation_execution_activity)<>1 then raise exception 'logical run replay duplicated effects'; end if; end $$;

-- Concurrency groups serialize claims and lease recovery requires an owning-outcome check.
update public.automation_run_steps set concurrency_group='property-command' where id='governed-run-1:step-1';
insert into public.automation_run_steps(id,workspace_id,run_id,step_key,owning_capability,command_type,command_contract_version,dependencies,concurrency_group,status,deterministic_command_id,idempotency_key,attempt_count,lease_generation,version)
values('governed-run-1:step-2','20000000-0000-0000-0000-000000000001','governed-run-1','step-2','execute','createDraftPlan','v1','{}','property-command','ready','command-2','command-key-2',0,0,1);
select public.claim_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-1',1,'worker-1','2026-08-10T12:03:00Z',60000);
do $$ declare unavailable public.automation_run_steps; begin select * into unavailable from public.claim_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-1',1,'worker-2','2026-08-10T12:03:01Z',60000); if unavailable.id is not null then raise exception 'duplicate step lease granted'; end if; end $$;
do $$ declare unavailable public.automation_run_steps; begin select * into unavailable from public.claim_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-2',1,'worker-2','2026-08-10T12:03:01Z',60000); if unavailable.id is not null then raise exception 'concurrency group overlap granted'; end if; end $$;
select public.heartbeat_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-1','worker-1',1,2,'2026-08-10T12:03:30Z',60000);
do $$ begin begin perform public.reclaim_expired_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-1',3,'2026-08-10T12:05:00Z',false); raise exception 'reclaim skipped owning outcome check'; exception when check_violation then null; end; end $$;
select public.reclaim_expired_automation_run_step('20000000-0000-0000-0000-000000000001','governed-run-1:step-1',3,'2026-08-10T12:05:00Z',true);

reset role; set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ begin if (select count(*) from public.automation_runs)<>1 or (select count(*) from public.automation_run_steps)<>2 then raise exception 'owner cannot inspect run'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$ begin if (select count(*) from public.automation_runs)<>0 or (select count(*) from public.automation_run_steps)<>0 then raise exception 'restricted property leaked run'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
do $$ begin if (select count(*) from public.automation_runs)<>0 then raise exception 'cross-tenant run leaked'; end if; end $$;
reset role; set role anon;
do $$ begin begin perform count(*) from public.automation_runs; raise exception 'anonymous run read succeeded'; exception when insufficient_privilege then null; end; end $$;
reset role; set role service_role;
do $$ begin begin update public.automation_execution_activity set event_type='tampered'; raise exception 'activity history changed'; exception when insufficient_privilege then null; end; end $$;
reset role;
select 'AU-001C PostgreSQL concurrency and RLS verification passed' as result;

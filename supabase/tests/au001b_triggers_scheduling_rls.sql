\set ON_ERROR_STOP on
\ir au001a_automation_foundation_rls.sql
\ir ../migrations/20260810020000_au001b_triggers_scheduling.sql

insert into public.automation_triggers(
  id,workspace_id,automation_id,automation_definition_version,kind,schema_version,scope_type,property_ids,enabled,effective_from,
  configuration,misfire_policy,backfill_maximum_count,backfill_maximum_age_ms,deduplication_policy_version,eligibility_policy_version,
  created_by_profile_id,updated_by_profile_id,created_at,updated_at,version
) values(
  'trigger-1','20000000-0000-0000-0000-000000000001','automation-1',1,'MANUAL','au001-trigger.v1','property','{30000000-0000-0000-0000-000000000001}',true,'2026-01-01T00:00:00Z',
  '{}','SKIP',10,604800000,'au001-occurrence.v1','au001-eligibility.v1','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-08-10T12:00:00Z','2026-08-10T12:00:00Z',1
);

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select public.accept_automation_trigger_occurrence(
  jsonb_build_object('id','occurrence-1','occurrence_key','stable-occurrence-1','workspace_id','20000000-0000-0000-0000-000000000001','automation_id','automation-1','automation_definition_version',1,'trigger_id','trigger-1','trigger_kind','MANUAL','target_key','property-1','occurred_at','2026-08-10T12:00:00Z','detected_at','2026-08-10T12:00:00Z','disposition','ACCEPTED','reason_code','TRIGGER_ELIGIBLE','correlation_id','correlation-1','source_identity','manual:request-1','safe_context','{}'::jsonb,'eligibility_policy_version','au001-eligibility.v1','backfilled',false,'version',1),
  jsonb_build_object('id','run-1','idempotency_key','run:stable-occurrence-1','workspace_id','20000000-0000-0000-0000-000000000001','scope_type','property','property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'automation_id','automation-1','automation_definition_version',1,'trigger_id','trigger-1','trigger_kind','MANUAL','occurrence_id','occurrence-1','requested_at','2026-08-10T12:00:00Z','occurred_at','2026-08-10T12:00:00Z','eligibility_policy_version','au001-eligibility.v1','approval_classification','before-run','correlation_id','correlation-1','safe_trigger_context','{}'::jsonb,'status','REQUESTED','version',1),
  jsonb_build_array(jsonb_build_object('id','trigger-activity-1','workspace_id','20000000-0000-0000-0000-000000000001','automation_id','automation-1','trigger_id','trigger-1','occurrence_id','occurrence-1','event_type','run-request-created','actor_id','10000000-0000-0000-0000-000000000001','occurred_at','2026-08-10T12:00:00Z','correlation_id','correlation-1','aggregate_version',1,'safe_metadata','{}'::jsonb))
);

do $$ begin
  if (select count(*) from public.automation_triggers)<>1 then raise exception 'owner cannot read trigger'; end if;
  if (select count(*) from public.automation_trigger_occurrences)<>1 then raise exception 'owner cannot read occurrence'; end if;
  if (select count(*) from public.automation_run_requests)<>1 then raise exception 'owner cannot read run request'; end if;
end $$;

-- Replaying the occurrence returns its original run request without appending.
select public.accept_automation_trigger_occurrence(
  jsonb_build_object('id','occurrence-replay','occurrence_key','stable-occurrence-1','workspace_id','20000000-0000-0000-0000-000000000001','automation_id','automation-1','automation_definition_version',1,'trigger_id','trigger-1','trigger_kind','MANUAL','target_key','property-1','occurred_at','2026-08-10T12:00:00Z','detected_at','2026-08-10T12:01:00Z','disposition','ACCEPTED','reason_code','TRIGGER_ELIGIBLE','correlation_id','correlation-1','source_identity','manual:request-1','safe_context','{}'::jsonb,'eligibility_policy_version','au001-eligibility.v1','backfilled',false,'version',1),
  null,'[]'::jsonb
);
do $$ begin
  if (select count(*) from public.automation_trigger_occurrences)<>1 or (select count(*) from public.automation_run_requests)<>1 or (select count(*) from public.automation_trigger_activity)<>1 then raise exception 'occurrence replay duplicated durable effects'; end if;
end $$;

-- Same-workspace administrator sees the authorized trigger history.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$ begin if (select count(*) from public.automation_trigger_occurrences)<>1 then raise exception 'administrator cannot read occurrence'; end if; end $$;

-- Property-limited operator, another workspace owner, and anonymous actor see nothing.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$ begin if (select count(*) from public.automation_triggers)<>0 or (select count(*) from public.automation_run_requests)<>0 then raise exception 'restricted property leaked'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
do $$ begin if (select count(*) from public.automation_triggers)<>0 or (select count(*) from public.automation_trigger_occurrences)<>0 then raise exception 'cross-tenant trigger leaked'; end if; end $$;
reset role;
set role anon;
do $$ begin begin perform count(*) from public.automation_triggers; raise exception 'anonymous trigger read succeeded'; exception when insufficient_privilege then null; end; end $$;

-- Service workers contend on one lease; only expiry permits a generation change.
reset role;
set role service_role;
select public.claim_automation_scheduler_lease('partition-1','20000000-0000-0000-0000-000000000001','worker-1','2026-08-10T12:00:00Z',60000);
do $$ declare unavailable public.automation_scheduler_leases; begin
  select * into unavailable from public.claim_automation_scheduler_lease('partition-1','20000000-0000-0000-0000-000000000001','worker-2','2026-08-10T12:00:30Z',60000);
  if unavailable.partition_key is not null then raise exception 'overlapping lease granted'; end if;
end $$;
select public.claim_automation_scheduler_lease('partition-1','20000000-0000-0000-0000-000000000001','worker-2','2026-08-10T12:01:01Z',60000);
select public.advance_automation_scheduler_checkpoint('partition-1','worker-2',2,0,'2026-08-10T12:01:00Z','2026-08-10T12:01:01Z');
do $$ begin
  begin perform public.advance_automation_scheduler_checkpoint('partition-1','worker-1',1,1,'2026-08-10T12:02:00Z','2026-08-10T12:01:02Z'); raise exception 'lost lease advanced checkpoint'; exception when serialization_failure then null; end;
  begin update public.automation_trigger_occurrences set reason_code='tampered' where id='occurrence-1'; raise exception 'occurrence history changed'; exception when insufficient_privilege then null; end;
  begin update public.automation_run_requests set status='WITHHELD' where id='run-1'; raise exception 'run request history changed'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'AU-001B PostgreSQL race and RLS verification passed' as result;

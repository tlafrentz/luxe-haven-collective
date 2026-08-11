\set ON_ERROR_STOP on

do $$
begin
  if exists(select 1 from public.automation_triggers where enabled) then
    raise exception 'An automation trigger became enabled';
  end if;
  if exists(select 1 from public.automation_run_requests) then
    raise exception 'A migration created an automation run request';
  end if;
  if exists(select 1 from public.automation_runs) then
    raise exception 'A migration created an automation run';
  end if;
  if exists(select 1 from public.automation_scheduler_leases) then
    raise exception 'A scheduler lease became active';
  end if;
  if exists(select 1 from public.automation_scheduler_checkpoints) then
    raise exception 'A scheduler checkpoint became active';
  end if;
end;
$$;

do $$
declare automation_cron_jobs integer := 0;
begin
  if to_regclass('cron.job') is not null then
    execute $query$
      select count(*) from cron.job
      where lower(coalesce(command,'')) like '%automation%'
         or lower(coalesce(jobname,'')) like '%automation%'
    $query$ into automation_cron_jobs;
  end if;
  if automation_cron_jobs > 0 then
    raise exception 'An automation cron job is active';
  end if;
end;
$$;

do $$
declare active_processor_triggers integer;
begin
  select count(*) into active_processor_triggers
  from pg_trigger trigger_record
  join pg_class relation on relation.oid=trigger_record.tgrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='public'
    and relation.relname like 'automation_%'
    and not trigger_record.tgisinternal
    and (
      lower(trigger_record.tgname) like '%dispatch%'
      or lower(trigger_record.tgname) like '%schedule%'
      or lower(trigger_record.tgname) like '%process%'
      or lower(trigger_record.tgname) like '%queue%'
    );
  if active_processor_triggers > 0 then
    raise exception 'An automation processor trigger is installed';
  end if;
end;
$$;

select 'AU-001 hosted inactivity verification passed' as result;

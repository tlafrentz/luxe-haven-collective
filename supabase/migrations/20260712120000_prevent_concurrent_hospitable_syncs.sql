/*
 * Prevent concurrent syncs of the same type for a single
 * integration connection.
 *
 * Before creating the unique index, close any duplicate
 * historical running rows while preserving the newest one.
 */
with duplicate_running_syncs as (
  select
    id,
    row_number() over (
      partition by connection_id, sync_type
      order by started_at desc, id desc
    ) as running_rank
  from public.integration_sync_runs
  where status = 'running'
)
update public.integration_sync_runs as sync_run
set
  status = 'failed',
  completed_at = now(),
  error_message = coalesce(
    sync_run.error_message,
    'Sync closed while enabling concurrent-run protection.'
  )
from duplicate_running_syncs
where sync_run.id = duplicate_running_syncs.id
  and duplicate_running_syncs.running_rank > 1;

create unique index if not exists
  integration_sync_runs_one_running_per_type_key
on public.integration_sync_runs (
  connection_id,
  sync_type
)
where status = 'running';

comment on index
  public.integration_sync_runs_one_running_per_type_key
is
  'Allows only one running sync of each type per integration connection.';

begin;

create or replace function public.release_automation_scheduler_lease(
  p_partition_key text,
  p_owner_id text,
  p_generation bigint,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.automation_scheduler_leases
  set
    expires_at = p_now,
    heartbeat_at = p_now - interval '1 microsecond'
  where partition_key = p_partition_key
    and owner_id = p_owner_id
    and generation = p_generation;

  if not found then
    raise exception 'Scheduler lease lost' using errcode='40001';
  end if;
end;
$$;

revoke all on function public.release_automation_scheduler_lease(text,text,bigint,timestamptz)
  from public, anon, authenticated;
grant execute on function public.release_automation_scheduler_lease(text,text,bigint,timestamptz)
  to service_role;

commit;

-- Forward-compatible worker lease recovery. An interrupted worker may leave an
-- item processing; after its lease expires another worker must be able to
-- reclaim it without duplicating the owning idempotent application attempt.
create or replace function public.claim_guidebook_creation_work(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.guidebook_creation_work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.guidebook_creation_work_items%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'guidebook_creation_worker_unauthorized';
  end if;

  select * into item
  from public.guidebook_creation_work_items
  where (
      status in ('queued', 'retryable_failure')
      or (status = 'processing' and lease_expires_at <= now())
    )
    and available_at <= now()
    and (lease_expires_at is null or lease_expires_at <= now())
  order by available_at, created_at
  for update skip locked
  limit 1;

  if item.id is null then
    return;
  end if;

  update public.guidebook_creation_work_items
  set status = 'processing',
      attempts = attempts + 1,
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(
        secs => greatest(10, least(p_lease_seconds, 600))
      )
  where id = item.id
  returning * into item;

  return next item;
end
$$;

revoke all on function public.claim_guidebook_creation_work(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_guidebook_creation_work(text, integer)
  to service_role;

-- public.guests has row level security enabled but ships with zero policies
-- and no grant to authenticated, so any workspace member read that embeds
-- guests (e.g. reservation context lookups joining bookings -> guests) fails
-- with "permission denied for table guests", even for workspaces with no
-- properties yet. guests.owner_id is a profiles.id (the workspace owner's
-- profile), not a workspace id, so it cannot be compared to auth.uid() for
-- team members directly. Guest PII is only ever reachable in practice
-- through a booking (primary_guest_id), so scope access the same way
-- "Workspace members read authorized bookings" scopes bookings: via the
-- property the guest's booking belongs to.

begin;
create index if not exists bookings_primary_guest_id_idx
on public.bookings (primary_guest_id);
drop policy if exists "Workspace members read authorized guests" on public.guests;
create policy "Workspace members read authorized guests"
on public.guests for select to authenticated using (
  public.is_admin()
  or exists (
    select 1
    from public.bookings booking
    where booking.primary_guest_id = guests.id
      and public.can_access_workspace_property(booking.property_id)
  )
);
grant select on public.guests to authenticated;
commit;

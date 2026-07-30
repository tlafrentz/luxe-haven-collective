alter table public.property_snapshots
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists workspace_id uuid;

create index if not exists property_snapshots_owner_workspace_address_idx
  on public.property_snapshots(owner_id, workspace_id, normalized_address_key, expires_at desc, version desc);

create policy "Owners can read property snapshots"
  on public.property_snapshots for select
  using (owner_id = auth.uid());

create policy "Owners can create property snapshots"
  on public.property_snapshots for insert
  with check (owner_id = auth.uid());

-- Governed expense archival metadata and permission-aware permanent deletion.
alter table public.financial_transactions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_profile_id uuid references public.profiles(id);

create index if not exists financial_transactions_archive_idx
  on public.financial_transactions(workspace_id, archived_at desc)
  where archived_at is not null;

grant delete on public.financial_transactions to authenticated;

create policy "financial transactions workspace delete" on public.financial_transactions
for delete to authenticated
using (public.can_manage_financial_observation(workspace_id, property_id));

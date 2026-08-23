-- FI-003C5: canonical financial reads follow active workspace membership.
-- Provider tokens and provider-control tables remain service-role only.
drop policy if exists "financial accounts workspace read" on public.financial_accounts;
create policy "financial accounts workspace read" on public.financial_accounts
  for select to authenticated
  using(public.active_workspace_role(workspace_id) is not null or public.is_admin());

drop policy if exists "financial transactions workspace read" on public.financial_transactions;
create policy "financial transactions workspace read" on public.financial_transactions
  for select to authenticated
  using(public.active_workspace_role(workspace_id) is not null or public.is_admin());

drop policy if exists "cash balances workspace read" on public.cash_balance_observations;
create policy "cash balances workspace read" on public.cash_balance_observations
  for select to authenticated
  using(public.active_workspace_role(workspace_id) is not null or public.is_admin());

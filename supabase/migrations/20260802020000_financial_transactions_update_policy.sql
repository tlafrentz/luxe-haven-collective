-- financial_transactions only ever had a SELECT policy (using the wrong
-- can_access_platform_action_workspace check) and an unconditional INSERT
-- policy. There was no UPDATE policy or grant at all, so editing an existing
-- expense (e.g. to add a source reference) was never possible from the app.
grant update on public.financial_transactions to authenticated;

create policy "financial transactions workspace update" on public.financial_transactions for update to authenticated
using (public.can_manage_financial_observation(workspace_id, property_id))
with check (public.can_manage_financial_observation(workspace_id, property_id));

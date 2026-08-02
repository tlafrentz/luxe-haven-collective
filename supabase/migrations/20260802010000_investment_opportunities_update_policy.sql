-- investment_opportunities has only ever had a SELECT policy/grant for
-- authenticated. saveAnalysisAsScenarioAction and convertScenarioToOpportunityAction
-- both update scenario_only directly (not through a security-definer RPC like
-- every other mutation on this table), so both silently failed under RLS with
-- no UPDATE policy to permit them at all.
grant update on public.investment_opportunities to authenticated;

create policy "Workspace members manage Investment Opportunities"
on public.investment_opportunities for update to authenticated
using (public.can_manage_investment_opportunity(workspace_id, property_id))
with check (public.can_manage_investment_opportunity(workspace_id, property_id));

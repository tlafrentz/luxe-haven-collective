import type { PortfolioExecutionSummary, PortfolioExecutionSummaryReader } from "../application/overview";
import { createClient } from "@/lib/supabase/server";

type SourceRow = Readonly<{ action_id: string; source_type: string; source_id: string | null }>;
type ActionRow = Readonly<{ id: string; title: string; status: string; schedule_due: string | null }>;

export class SupabasePortfolioExecutionSummaryReader implements PortfolioExecutionSummaryReader {
  async read(workspaceId: string, authorizedPropertyIds: readonly string[]): Promise<PortfolioExecutionSummary> {
    if (!authorizedPropertyIds.length) return { activeDecisions: 0, openActions: 0, outcomeReviewsDue: 0, items: [] };
    const client = await createClient();
    const { data: sources, error: sourceError } = await client.from("platform_action_sources").select("action_id,source_type,source_id").eq("workspace_id", workspaceId).eq("capability", "portfolio");
    if (sourceError) throw new Error(`Unable to read Portfolio execution sources: ${sourceError.message}`);
    const sourceRows = (sources ?? []) as SourceRow[];
    const actionIds = [...new Set(sourceRows.map(({ action_id }) => action_id))];
    if (!actionIds.length) return { activeDecisions: 0, openActions: 0, outcomeReviewsDue: 0, items: [] };
    const { data: actions, error: actionError } = await client.from("platform_actions").select("id,title,status,schedule_due").eq("workspace_id", workspaceId).in("id", actionIds).not("status", "in", '("completed","cancelled","archived")').limit(5);
    if (actionError) throw new Error(`Unable to read Portfolio execution actions: ${actionError.message}`);
    const rows = (actions ?? []) as ActionRow[];
    const decisionIds = new Set(sourceRows.filter(({ source_type, source_id }) => source_type === "decision" && source_id).map(({ source_id }) => source_id));
    return Object.freeze({
      activeDecisions: decisionIds.size,
      openActions: rows.length,
      outcomeReviewsDue: 0,
      items: Object.freeze(rows.map((row) => ({ id: row.id, title: row.title, kind: "action" as const, status: row.status, destination: `/dashboard/actions/${row.id}` }))),
    });
  }
}

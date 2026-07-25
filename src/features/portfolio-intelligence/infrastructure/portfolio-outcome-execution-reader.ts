import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function readPortfolioDecisionExecutionCompletion(
  workspaceId: string,
  decisionIds: readonly string[],
): Promise<ReadonlyMap<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of decisionIds) result.set(id, false);
  if (!decisionIds.length) return result;
  const client = await createClient();
  const { data: sources, error } = await client.from("platform_action_sources")
    .select("action_id,source_id").eq("workspace_id", workspaceId)
    .eq("source_type", "decision").eq("capability", "portfolio")
    .in("source_id", [...decisionIds]);
  if (error) throw new Error("Portfolio execution lineage unavailable.", { cause: error });
  const rows = (sources ?? []) as readonly Readonly<{ action_id: string; source_id: string }>[];
  const actionIds = rows.map(({ action_id }) => action_id);
  if (!actionIds.length) return result;
  const { data: actions, error: actionError } = await client.from("platform_actions")
    .select("id,status").eq("workspace_id", workspaceId).in("id", actionIds);
  if (actionError) throw new Error("Portfolio execution status unavailable.", { cause: actionError });
  const statuses = new Map(((actions ?? []) as readonly Readonly<{ id: string; status: string }>[])
    .map(({ id, status }) => [id, status]));
  for (const decisionId of decisionIds) {
    const linked = rows.filter(({ source_id }) => source_id === decisionId);
    result.set(decisionId, linked.length > 0 && linked.every(({ action_id }) =>
      ["completed", "archived"].includes(statuses.get(action_id) ?? "")));
  }
  return result;
}


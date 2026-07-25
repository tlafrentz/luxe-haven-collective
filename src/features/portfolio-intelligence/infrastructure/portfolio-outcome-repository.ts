import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  PortfolioDecisionOutcomeReview, PortfolioLearningRecord,
  PortfolioOutcomeRepository,
} from "../application/outcomes";

type JsonObject = Record<string, unknown>;

export class SupabasePortfolioOutcomeRepository implements PortfolioOutcomeRepository {
  async listReviews(workspaceId: string): Promise<readonly PortfolioDecisionOutcomeReview[]> {
    const client = await createClient();
    const { data, error } = await client.from("portfolio_decision_outcome_reviews")
      .select("snapshot").eq("workspace_id", workspaceId).order("reviewed_at", { ascending: false });
    if (error) throw new Error("Portfolio outcome reviews unavailable.", { cause: error });
    return (data ?? []).map((row) => review((row as unknown as { snapshot: unknown }).snapshot));
  }
  async appendReview(value: PortfolioDecisionOutcomeReview, commandId: string) {
    const data = await append("append_portfolio_outcome_review", {
      p_workspace_id: value.workspaceId, p_review_id: value.id,
      p_decision_id: value.decisionId, p_command_id: commandId, p_snapshot: value,
    });
    return review(data);
  }
  async listLearnings(workspaceId: string): Promise<readonly PortfolioLearningRecord[]> {
    const client = await createClient();
    const { data, error } = await client.from("portfolio_learning_records")
      .select("snapshot").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (error) throw new Error("Portfolio learning records unavailable.", { cause: error });
    return (data ?? []).map((row) => learning((row as unknown as { snapshot: unknown }).snapshot));
  }
  async publishLearning(value: PortfolioLearningRecord, commandId: string) {
    const data = await append("append_portfolio_learning_record", {
      p_workspace_id: value.workspaceId, p_learning_id: value.id,
      p_command_id: commandId, p_snapshot: value,
    });
    return learning(data);
  }
}
async function append(name: string, input: JsonObject) {
  const client = await createClient();
  const rpc = client.rpc as unknown as (rpcName: string, args: JsonObject) =>
    Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc(name, input);
  if (error) throw new Error("Portfolio learning persistence failed.", { cause: error });
  return data;
}
function review(value: unknown): PortfolioDecisionOutcomeReview {
  if (!value || typeof value !== "object") throw new TypeError("Invalid outcome review snapshot.");
  return Object.freeze(value as PortfolioDecisionOutcomeReview);
}
function learning(value: unknown): PortfolioLearningRecord {
  if (!value || typeof value !== "object") throw new TypeError("Invalid portfolio learning snapshot.");
  return Object.freeze(value as PortfolioLearningRecord);
}


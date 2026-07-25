import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  DecisionMeasurementPlan, DecisionRepository, PortfolioStrategicDecision,
} from "../application/decisions";

type JsonObject = Record<string, unknown>;

export class SupabasePortfolioDecisionRepository implements DecisionRepository {
  async list(workspaceId: string): Promise<readonly PortfolioStrategicDecision[]> {
    const client = await createClient();
    const { data, error } = await client
      .from("portfolio_recommendation_reviews")
      .select("snapshot")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Portfolio decision repository unavailable.", { cause: error });
    return (data ?? []).map((row) => snapshot((row as unknown as { snapshot: unknown }).snapshot));
  }

  async get(workspaceId: string, decisionId: string): Promise<PortfolioStrategicDecision | null> {
    const client = await createClient();
    const { data, error } = await client
      .from("portfolio_recommendation_reviews")
      .select("snapshot")
      .eq("workspace_id", workspaceId)
      .eq("id", decisionId)
      .maybeSingle();
    if (error) throw new Error("Portfolio decision repository unavailable.", { cause: error });
    return data ? snapshot((data as unknown as { snapshot: unknown }).snapshot) : null;
  }

  async save(
    decision: PortfolioStrategicDecision,
    expectedRevision: number,
    commandId: string,
  ): Promise<PortfolioStrategicDecision> {
    const client = await createClient();
    const rpc = client.rpc as unknown as (name: string, input: JsonObject) =>
      Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
    const { data, error } = await rpc("save_portfolio_recommendation_review", {
      p_workspace_id: decision.workspaceId,
      p_decision_id: decision.decisionId,
      p_expected_revision: expectedRevision,
      p_command_id: commandId,
      p_snapshot: decision,
    });
    if (error?.code === "40001") throw new Error("Portfolio decision revision conflict.", { cause: error });
    if (error) throw new Error("Portfolio decision persistence failed.", { cause: error });
    return snapshot(data);
  }
}

export async function savePortfolioDecisionMeasurementPlan(
  workspaceId: string,
  plan: DecisionMeasurementPlan,
  evidenceVersion: string,
  profileId: string,
) {
  const client = await createClient();
  const { error } = await client.from("portfolio_decision_measurement_plans").upsert({
    workspace_id: workspaceId, decision_id: plan.decisionId, plan,
    evidence_version: evidenceVersion, review_at: plan.reviewAt,
    created_by_profile_id: profileId,
  } as never, { onConflict: "workspace_id,decision_id" });
  if (error) throw new Error("Decision measurement plan persistence failed.", { cause: error });
}

function snapshot(value: unknown): PortfolioStrategicDecision {
  if (!value || typeof value !== "object") throw new TypeError("Invalid portfolio decision snapshot.");
  return Object.freeze(value as PortfolioStrategicDecision);
}

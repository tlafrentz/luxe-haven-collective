"use server";

import type { PortfolioComparison } from "@/features/portfolio";
import {
  buildPortfolioOutcomesWorkspace, evaluateOutcomeReviewReadiness,
  readPortfolioDecisionExecutionCompletion, SupabasePortfolioOutcomeRepository,
} from "@/features/portfolio-intelligence";
import { getPortfolioDecisionsRouteState } from "./portfolio-decisions-runtime";

type RouteInput = Readonly<{
  workspaceId?: string; propertyIds?: readonly string[];
  periodPreset: "30d" | "90d" | "ytd" | "12m"; comparisonType: PortfolioComparison; now?: Date;
}>;

export async function getPortfolioOutcomesRouteState(input: RouteInput) {
  const started = Date.now();
  try {
    const decisionsState = await getPortfolioDecisionsRouteState(input);
    if (!decisionsState.ok) return decisionsState;
    const decisionWorkspace = decisionsState.workspace;
    const workspaceId = decisionWorkspace.findings.identity.workspaceId;
    const repository = new SupabasePortfolioOutcomeRepository();
    const [reviews, learnings, completion] = await Promise.all([
      repository.listReviews(workspaceId), repository.listLearnings(workspaceId),
      readPortfolioDecisionExecutionCompletion(
        workspaceId,
        decisionWorkspace.decisions.map(({ canonicalDecisionId, decisionId }) => canonicalDecisionId ?? decisionId),
      ),
    ]);
    const now = (input.now ?? new Date()).toISOString();
    const readiness = decisionWorkspace.decisions.map((decision) =>
      evaluateOutcomeReviewReadiness({
        decision,
        executionComplete: completion.get(decision.canonicalDecisionId ?? decision.decisionId) ?? false,
        evidenceCount: decision.evidence.length,
        freshness: decisionWorkspace.findings.freshness,
        now,
      }));
    const workspace = buildPortfolioOutcomesWorkspace({
      decisions: decisionWorkspace.decisions, candidates: decisionWorkspace.candidates,
      reviews, learnings, readiness, role: decisionWorkspace.role, evaluatedAt: now,
    });
    console.info("portfolio_outcomes_evaluated", {
      workspaceId, actorRole: workspace.role, reviewedCount: reviews.length,
      readyCount: readiness.filter(({ state }) => state === "ready").length,
      learningCount: workspace.learnings.length, state: workspace.state,
      durationMilliseconds: Date.now() - started, policyVersion: "portfolio-outcome-policy-v1",
    });
    return { ok: true as const, workspace };
  } catch (error) {
    console.error("portfolio_outcomes_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      durationMilliseconds: Date.now() - started,
    });
    return { ok: false as const, code: "unavailable" as const, message: "Portfolio outcomes could not be loaded. Historical decisions, expectations, and reviews were not changed." };
  }
}


import { ActionBuilder, createActionId, type Action, type LegacyActionOwner as ActionOwner } from "@/platform/actions";
import { Decision, DecisionMode } from "@/platform/decisions";
import { Identifier } from "@/platform/kernel";
import { createOutcomeId, emptyOutcomeLineage, Outcome } from "@/platform/outcomes";
import type { Recommendation } from "@/platform/recommendations";
import type { OpportunityStatus, RevenueOpportunity } from "../types";

export type RevenueRecommendationDisposition = "accepted" | "dismissed";
export type RevenueDecisionResult = Readonly<{ decision: Decision<RevenueRecommendationDisposition>; action?: Action }>;

export function decideRevenueRecommendation(input: Readonly<{
  recommendation: Recommendation; opportunity: RevenueOpportunity; disposition: RevenueRecommendationDisposition;
  decidedAt: Date; owner?: ActionOwner; decisionId?: string; actionId?: string;
}>): RevenueDecisionResult {
  const decision = Decision.create({
    id: Identifier.create(input.decisionId ?? `decision-${input.opportunity.id}`), type: "revenue.opportunity",
    outcome: input.disposition, context: { subjectType: input.opportunity.propertyId ? "property" : "portfolio", subjectId: input.opportunity.propertyId ?? "portfolio", effectiveAt: input.decidedAt },
    rationale: { summary: input.opportunity.summary, supportingReasons: input.recommendation.rationale, confidence: input.recommendation.confidence },
    decidedAt: input.decidedAt, title: input.recommendation.summary, summary: input.opportunity.summary,
    mode: DecisionMode.HUMAN_APPROVED, priority: input.recommendation.priority, confidence: input.recommendation.confidence,
    recommendationIds: [input.recommendation.id], evaluationIds: input.recommendation.evaluationIds,
    claimIds: input.recommendation.claimIds, evidenceIds: input.recommendation.evidenceIds, observationIds: input.recommendation.observationIds,
    metadata: { opportunityId: input.opportunity.id },
  });
  if (input.disposition === "dismissed") return { decision };
  if (!input.owner) throw new TypeError("An accepted Revenue recommendation requires an Action owner.");
  const action = new ActionBuilder().build({ id: createActionId(input.actionId ?? `action-${input.opportunity.id}`), createdAt: input.decidedAt,
    result: { title: input.opportunity.title, summary: input.opportunity.action.summary, type: input.opportunity.action.type,
      priority: input.opportunity.severity, owner: input.owner, sourceDecisions: [decision], metadata: { opportunityId: input.opportunity.id, category: input.opportunity.category } } });
  return { decision, action };
}

export function recordRevenueOutcome(input: Readonly<{ action: Action; successful: boolean; summary: string; startedAt: Date; completedAt: Date; metrics: Readonly<Record<string, number>>; notes?: readonly string[] }>): Outcome {
  const lineage = emptyOutcomeLineage();
  return Outcome.create({ id: createOutcomeId(`outcome-${input.action.id.value}`), title: `${input.action.title} outcome`, summary: input.summary,
    type: "action", status: input.successful ? "completed" : "failed", successful: input.successful, startedAt: input.startedAt, completedAt: input.completedAt,
    metrics: input.metrics, notes: input.notes, lineage: { ...lineage, actionIds: [input.action.id], decisionIds: input.action.decisionIds }, metadata: { capability: "revenue-intelligence" } });
}

/** Compatibility-only recombination of separated lifecycle artifacts. */
export function projectOpportunityStatus(input: Readonly<{ decision?: Decision<RevenueRecommendationDisposition>; action?: Action; outcome?: Outcome }>): OpportunityStatus {
  if (input.outcome) return "resolved";
  if (input.decision?.outcome === "dismissed") return "dismissed";
  if (input.decision?.outcome === "accepted" || input.action) return "accepted";
  return "open";
}

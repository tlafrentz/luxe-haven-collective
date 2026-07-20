import { Action, ActionCollection, createActionId } from "@/platform/actions";
import { Decision, DecisionMode } from "@/platform/decisions";
import { Identifier } from "@/platform/kernel";

import type { InvestmentCommitment, InvestmentCommitmentOutcome, InvestmentDecision, InvestmentPlatformAnalysis } from "../../domain";

export type CommitInvestmentRecommendationInput = Readonly<{
  projection: InvestmentDecision;
  analysis: InvestmentPlatformAnalysis;
  outcome: InvestmentCommitmentOutcome;
  decidedAt?: Date;
  rationale?: string;
}>;

/** Converts an explicit user commitment into a canonical Decision and proposed diligence Actions. */
export function commitInvestmentRecommendation({
  projection,
  analysis,
  outcome,
  decidedAt = new Date(),
  rationale,
}: CommitInvestmentRecommendationInput): InvestmentCommitment {
  const recommendation = analysis.recommendations.toArray()[0];
  if (!recommendation) throw new Error("Investment analysis must contain a recommendation.");

  const decision = Decision.create({
    id: Identifier.create(`decision-investment-${slug(projection.property.id)}-${outcome}`),
    type: "investment.acquisition",
    outcome,
    context: { subjectType: "property", subjectId: projection.property.id, effectiveAt: decidedAt },
    rationale: {
      summary: rationale ?? `The acquisition recommendation was ${outcome}.`,
      confidence: recommendation.confidence,
    },
    decidedAt,
    title: "Acquisition decision",
    summary: `Acquisition recommendation ${outcome}.`,
    mode: outcome === "accepted" ? DecisionMode.HUMAN_APPROVED : outcome === "rejected" ? DecisionMode.REJECTED : DecisionMode.DEFERRED,
    confidence: recommendation.confidence,
    recommendationIds: [recommendation.id],
    evaluationIds: analysis.evaluations.toArray().map((value) => value.id),
    claimIds: analysis.claims.toArray().map((value) => value.id),
    evidenceIds: analysis.evidence.toArray().map((value) => value.id),
    observationIds: analysis.observations.toArray().map((value) => value.id),
    metadata: { propertyId: projection.property.id },
  });

  const actions = outcome === "accepted"
    ? projection.strategy.firstNinetyDayPriorities.map((priority, index) => Action.create({
        id: createActionId(`action-investment-${slug(projection.property.id)}-${index + 1}`),
        title: priority,
        summary: `Acquisition diligence for ${projection.property.location.address1}.`,
        type: "investment-diligence",
        priority: index === 0 ? "high" : "medium",
        owner: { type: "user", id: "investment-owner", displayName: "Investment Owner" },
        decisionIds: [decision.id],
        createdAt: decidedAt,
        metadata: { propertyId: projection.property.id },
      }))
    : [];

  return { recommendation, decision, actions: ActionCollection.create(actions) };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

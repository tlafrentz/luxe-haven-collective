import { describe, expect, it } from "vitest";
import { createOpportunity as createRevenueOpportunity } from "../test-support/factories";
import { toRevenueReasoningArtifacts } from "./revenue-reasoning-adapter";
import { decideRevenueRecommendation, projectOpportunityStatus, recordRevenueOutcome } from "./revenue-opportunity-lifecycle";

describe("Revenue opportunity lifecycle adapter", () => {
  it("separates Recommendation, Decision, Action, and Outcome", () => {
    const opportunity = createRevenueOpportunity();
    const recommendation = toRevenueReasoningArtifacts({ opportunities: [opportunity], summary: { total: 1, highPriority: 1, mediumPriority: 0, lowPriority: 0, estimatedRevenueImpact: 0, currency: "USD", byCategory: { pricing: 1, occupancy: 0, revenue: 0, distribution: 0, operations: 0 }, bySeverity: { high: 1, medium: 0, low: 0 } }, generatedAt: opportunity.detectedAt }).recommendations.toArray()[0];
    const accepted = decideRevenueRecommendation({ recommendation, opportunity, disposition: "accepted", decidedAt: new Date("2026-07-19T12:00:00Z"), owner: { type: "team", id: "revenue", displayName: "Revenue Team" } });

    expect(accepted.decision.outcome).toBe("accepted");
    expect(accepted.action?.decisionIds[0].equals(accepted.decision.id)).toBe(true);
    expect(projectOpportunityStatus(accepted)).toBe("accepted");

    const outcome = recordRevenueOutcome({ action: accepted.action!, successful: true, summary: "Revenue increased.", startedAt: new Date("2026-07-19T12:05:00Z"), completedAt: new Date("2026-07-20T12:05:00Z"), metrics: { revenue: 425 } });
    expect(outcome.metrics.revenue).toBe(425);
    expect(outcome.lineage.decisionIds[0].equals(accepted.decision.id)).toBe(true);
    expect(projectOpportunityStatus({ ...accepted, outcome })).toBe("resolved");
  });

  it("does not create work for a dismissed Recommendation", () => {
    const opportunity = createRevenueOpportunity();
    const recommendation = toRevenueReasoningArtifacts({ opportunities: [opportunity], summary: { total: 1, highPriority: 1, mediumPriority: 0, lowPriority: 0, estimatedRevenueImpact: 0, currency: "USD", byCategory: { pricing: 1, occupancy: 0, revenue: 0, distribution: 0, operations: 0 }, bySeverity: { high: 1, medium: 0, low: 0 } }, generatedAt: opportunity.detectedAt }).recommendations.toArray()[0];
    const dismissed = decideRevenueRecommendation({ recommendation, opportunity, disposition: "dismissed", decidedAt: new Date("2026-07-19T12:00:00Z") });
    expect(dismissed.action).toBeUndefined();
    expect(projectOpportunityStatus(dismissed)).toBe("dismissed");
  });
});

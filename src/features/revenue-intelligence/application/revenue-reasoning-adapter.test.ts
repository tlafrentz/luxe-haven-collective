import { describe, expect, it } from "vitest";
import { createOpportunity as createRevenueOpportunity } from "../test-support/factories";
import { toRevenueReasoningArtifacts } from "./revenue-reasoning-adapter";

describe("Revenue reasoning adapter", () => {
  it("preserves detector methodology while emitting the canonical reasoning chain", () => {
    const opportunity = createRevenueOpportunity();
    const artifacts = toRevenueReasoningArtifacts({ opportunities: [opportunity], summary: { total: 1, highPriority: 1, mediumPriority: 0, lowPriority: 0, estimatedRevenueImpact: 0, currency: "USD", byCategory: { pricing: 1, occupancy: 0, revenue: 0, distribution: 0, operations: 0 }, bySeverity: { high: 1, medium: 0, low: 0 } }, generatedAt: opportunity.detectedAt });

    expect(artifacts.observations.size).toBe(opportunity.evidence.length);
    expect(artifacts.evidence.size).toBe(opportunity.evidence.length);
    expect(artifacts.claims.size).toBe(1);
    expect(artifacts.evaluations.size).toBe(1);
    expect(artifacts.recommendations.size).toBe(1);
    expect(artifacts.recommendations.toArray()[0].metadata.opportunityId).toBe(opportunity.id);
  });
});

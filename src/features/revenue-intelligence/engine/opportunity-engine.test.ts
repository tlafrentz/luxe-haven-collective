import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runOpportunityEngine,
} from "../services/run-opportunity-engine";

import {
  createOpportunity,
  createOpportunityDetectionContext,
} from "../test-support/factories";

import type {
  OpportunityDetector,
} from "../types";

describe("runOpportunityEngine", () => {
  it("returns a stable empty report when no detectors are supplied", () => {
    const context =
      createOpportunityDetectionContext();

    const result = runOpportunityEngine({
      context,
      detectors: [],
    });

    expect(result).toEqual({
      opportunities: [],
      summary: {
        total: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        estimatedRevenueImpact: 0,
        currency: "USD",
        byCategory: {
          pricing: 0,
          occupancy: 0,
          revenue: 0,
          distribution: 0,
          operations: 0,
        },
        bySeverity: {
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      generatedAt:
        "2026-07-12T18:00:00.000Z",
    });
  });

  it("executes detectors, deduplicates results, sorts them, and builds a summary", () => {
    const duplicateOpportunity =
      createOpportunity({
        id: "duplicate-opportunity",
        severity: "medium",
        confidence: "medium",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 100,
          currency: "USD",
          basis: "Test impact.",
        },
      });

    const highPriorityOpportunity =
      createOpportunity({
        id: "high-priority-opportunity",
        severity: "high",
        confidence: "high",
        category: "operations",
        impact: {
          type: "revenue-at-risk",
          estimatedAmount: 300,
          currency: "USD",
          basis: "Test risk.",
        },
      });

    const firstDetector: OpportunityDetector = {
      id: "first-detector",
      opportunityTypes: ["gap-night"],
      detect: () => [
        duplicateOpportunity,
        highPriorityOpportunity,
      ],
    };

    const secondDetector: OpportunityDetector = {
      id: "second-detector",
      opportunityTypes: ["gap-night"],
      detect: () => [
        createOpportunity({
          ...duplicateOpportunity,
          title: "Duplicate replacement",
        }),
      ],
    };

    const result = runOpportunityEngine({
      context:
        createOpportunityDetectionContext(),
      detectors: [
        firstDetector,
        secondDetector,
      ],
    });

    expect(
      result.opportunities.map(
        (opportunity) => opportunity.id,
      ),
    ).toEqual([
      "high-priority-opportunity",
      "duplicate-opportunity",
    ]);

    expect(result.opportunities[1].title).toBe(
      "Test opportunity",
    );

    expect(result.summary).toMatchObject({
      total: 2,
      highPriority: 1,
      mediumPriority: 1,
      lowPriority: 0,
      estimatedRevenueImpact: 400,
      currency: "USD",
    });
  });
});

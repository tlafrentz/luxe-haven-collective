import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunity,
} from "@/features/revenue-intelligence/test-support/factories";

import {
  createRevenueIntelligence,
} from "../test-support/factories";

import {
  buildIntelligenceChanges,
} from "./build-intelligence-changes";

describe("buildIntelligenceChanges", () => {
  it("maps revenue opportunities into informational changes", () => {
    const [result] =
      buildIntelligenceChanges(
        createRevenueIntelligence({
          opportunities: [
            createOpportunity({
              id: "revenue-opportunity",
              category: "pricing",
              impact: {
                type: "revenue-increase",
                estimatedAmount: 500,
                currency: "USD",
                basis:
                  "Pricing improvement.",
              },
            }),
          ],
        }),
      );

    expect(result).toMatchObject({
      id: "intelligence-change-revenue-opportunity",
      type: "opportunity-detected",
      tone: "informational",
      pillar: "revenue",
      value: 500,
      unit: "currency",
      currency: "USD",
    });
  });

  it("maps high-severity revenue risks into negative changes", () => {
    const [result] =
      buildIntelligenceChanges(
        createRevenueIntelligence({
          opportunities: [
            createOpportunity({
              id: "revenue-risk",
              severity: "high",
              impact: {
                type: "revenue-at-risk",
                estimatedAmount: 900,
                currency: "USD",
                basis:
                  "Revenue exposure.",
              },
            }),
          ],
        }),
      );

    expect(result).toMatchObject({
      id: "intelligence-change-revenue-risk",
      type: "risk-detected",
      tone: "negative",
      pillar: "revenue",
    });
  });

  it("maps distribution signals to the growth pillar", () => {
    const [result] =
      buildIntelligenceChanges(
        createRevenueIntelligence({
          opportunities: [
            createOpportunity({
              category: "distribution",
            }),
          ],
        }),
      );

    expect(result.pillar).toBe("growth");
  });
});

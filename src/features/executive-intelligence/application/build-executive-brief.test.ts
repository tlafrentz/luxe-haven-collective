import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createExecutivePriority,
  createHpmPerformanceReport,
  createPortfolioSnapshot,
  createRevenueRiskSummary,
} from "../test-support/factories";

import {
  buildExecutiveBrief,
} from "./build-executive-brief";

describe("buildExecutiveBrief", () => {
  it("uses the highest-ranked priority as the recommended focus", () => {
    const priority =
      createExecutivePriority();

    const result =
      buildExecutiveBrief({
        hpmPerformance:
          createHpmPerformanceReport(),
        portfolioSnapshot:
          createPortfolioSnapshot(),
        revenueRisk:
          createRevenueRiskSummary(),
        priorities: [priority],
      });

    expect(result.headline).toContain(
      priority.title,
    );
    expect(result.recommendedFocus).toBe(
      priority.action.summary,
    );
  });

  it("creates a warning or critical brief when quantified risk is active", () => {
    const result =
      buildExecutiveBrief({
        hpmPerformance:
          createHpmPerformanceReport(),
        portfolioSnapshot:
          createPortfolioSnapshot(),
        revenueRisk:
          createRevenueRiskSummary({
            itemCount: 1,
            totalEstimatedAmount: 500,
            items: [
              {
                id: "risk-1",
                pillar: "revenue",
                propertyId: "property-1",
                title: "Payment at risk",
                summary:
                  "A reservation is unpaid.",
                estimatedAmount: 500,
                currency: "USD",
                confidence: "high",
                detectedAt:
                  "2026-07-13T15:00:00.000Z",
              },
            ],
          }),
        priorities: [],
      });

    expect(result.tone).toBe("critical");
    expect(result.concerns).toContain(
      "1 revenue-risk item is currently active.",
    );
  });
});

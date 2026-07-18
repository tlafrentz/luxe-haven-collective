import { describe, expect, it } from "vitest";

import { buildMarketTrendIntelligence } from "../builders/build-market-trend-intelligence";
import { TrendDirection } from "../../domain/enums/trend-direction";

describe("buildMarketTrendIntelligence", () => {
  it("derives positive market momentum from aligned signals", () => {
    const intelligence = buildMarketTrendIntelligence({
      averageDailyRateTrend: TrendDirection.Positive,
      occupancyTrend: TrendDirection.Positive,
      revenueTrend: TrendDirection.StronglyPositive,
      inventoryTrend: TrendDirection.Stable,
      pricingPowerTrend: TrendDirection.Positive,
      demandTrend: TrendDirection.Positive,
      confidenceScore: 90,
    });

    expect(intelligence.isPositive).toBe(true);
    expect(intelligence.momentumScore.value).toBeGreaterThan(70);
    expect(intelligence.supportingSignals).toContain(
      "Revenue is strongly positive.",
    );
    expect(intelligence.conflictingSignals).toEqual([]);
  });

  it("surfaces evidence that conflicts with the overall direction", () => {
    const intelligence = buildMarketTrendIntelligence({
      averageDailyRateTrend: TrendDirection.Positive,
      occupancyTrend: TrendDirection.Negative,
      revenueTrend: TrendDirection.Positive,
      inventoryTrend: TrendDirection.Positive,
      pricingPowerTrend: TrendDirection.Positive,
      demandTrend: TrendDirection.Positive,
      confidenceScore: 80,
    });

    expect(intelligence.isPositive).toBe(true);
    expect(intelligence.hasConflictingEvidence).toBe(true);
    expect(
      intelligence.conflictingSignals.some((signal) =>
        signal.startsWith("Occupancy is"),
      ),
    ).toBe(true);
    expect(
      intelligence.conflictingSignals.some((signal) =>
        signal.startsWith("Inventory is"),
      ),
    ).toBe(true);
  });
});

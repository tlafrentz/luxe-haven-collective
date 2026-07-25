import { describe, expect, it } from "vitest";
import { ConfidenceLevel } from "@/platform/scoring";
import {
  aggregatePortfolioConfidence,
  aggregatePortfolioFreshness,
  aggregatePortfolioMetrics,
  assertPortfolioPeriod,
  type PortfolioPropertyProjection,
} from "./read-model";

function property(overrides: Partial<PortfolioPropertyProjection> = {}): PortfolioPropertyProjection {
  return {
    propertyId: "property-1",
    name: "Lake House",
    status: "active",
    market: "Austin",
    operatingModel: "short-term-rental",
    metrics: {
      grossRevenue: 300, adr: 100, occupancy: 0.5, revpar: 50,
      netOperatingIncome: 120, cashFlow: 90, margin: 0.4,
      bookingCount: 3, activeStays: 1, openActions: 2, operationalIssues: 1,
    },
    contribution: { revenue: 300, netOperatingIncome: 120, bookings: 3, actions: 2, operationalIssues: 1, evidenceCount: 1 },
    observations: [],
    evidence: [],
    confidence: ConfidenceLevel.HIGH,
    freshness: "current",
    ...overrides,
  };
}

describe("Portfolio read model domain", () => {
  it("rolls totals up from property contributions and uses portfolio denominators", () => {
    const result = aggregatePortfolioMetrics([
      property(),
      property({
        propertyId: "property-2",
        metrics: {
          grossRevenue: 200, adr: 200, occupancy: 0.25, revpar: 50,
          netOperatingIncome: 80, cashFlow: 50, margin: 0.4,
          bookingCount: 2, activeStays: 2, openActions: 1, operationalIssues: 0,
        },
      }),
    ]);
    expect(result).toMatchObject({
      grossRevenue: 500, netOperatingIncome: 200, cashFlow: 140,
      bookingCount: 5, activeStays: 3, openActions: 3, operationalIssues: 1,
      adr: 125, revpar: 50, margin: 0.4,
    });
    expect(result.occupancy).toBe(0.4);
  });

  it("preserves unavailable financial metrics instead of inventing zeroes", () => {
    const result = aggregatePortfolioMetrics([
      property({ metrics: { ...property().metrics, grossRevenue: null, netOperatingIncome: null, cashFlow: null, adr: null, revpar: null, occupancy: null, margin: null } }),
    ]);
    expect(result.grossRevenue).toBeNull();
    expect(result.netOperatingIncome).toBeNull();
    expect(result.margin).toBeNull();
  });

  it("propagates the least trustworthy confidence and worst freshness", () => {
    expect(aggregatePortfolioConfidence([ConfidenceLevel.HIGH, ConfidenceLevel.LOW])).toBe(ConfidenceLevel.LOW);
    expect(aggregatePortfolioFreshness(["current", "degraded", "stale"])).toBe("degraded");
  });

  it("requires explicit, valid comparison periods", () => {
    expect(() => assertPortfolioPeriod({ current: { from: "2026-07-01", to: "2026-07-31" }, comparisonType: "previous-year" })).toThrow(/comparison/);
    expect(() => assertPortfolioPeriod({ current: { from: "2026-07-31", to: "2026-07-01" }, comparisonType: "none" })).toThrow(/current period/);
  });
});

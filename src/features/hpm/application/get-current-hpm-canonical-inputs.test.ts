import { describe, expect, it, vi } from "vitest";
import type { AnalyticsDashboardProjection } from "@/features/analytics";
import type { RevenueIntelligence } from "@/features/revenue-intelligence";
import { ClaimCollection } from "@/platform/claims";
import { EvaluationCollection } from "@/platform/evaluations";
import { EvidenceCollection } from "@/platform/evidence";
import { ObservationCollection } from "@/platform/observations";
import { RecommendationCollection } from "@/platform/recommendations";

import { getCurrentHpmCanonicalInputs } from "./get-current-hpm-canonical-inputs";

function analytics(): AnalyticsDashboardProjection {
  const metrics: AnalyticsDashboardProjection["metrics"] = {
    grossRevenue: 4200, roomRevenue: 4050, occupiedNights: 25, availableNights: 31,
    occupancyRate: 80.6, averageDailyRate: 162, revPar: 130.65,
    averageLengthOfStay: 25, averageBookingLeadTime: 10, cancellationRate: 0,
    totalBookings: 1, upcomingBookings: 0, completedBookings: 0, cancelledBookings: 0,
    revenueBreakdown: { roomRevenue: 4050, cleaningFees: 150, taxes: 0, serviceFees: 0, otherRevenue: 0, grossRevenue: 4200 },
    bookingSources: [], stayLengthDistribution: [],
  };
  return {
    generatedAt: "2026-07-20T12:00:00Z", dateRange: { startDate: "2026-07-01", endDate: "2026-08-01" },
    previousDateRange: { startDate: "2026-06-01", endDate: "2026-07-01" }, selectedProperty: null, properties: [],
    metrics, previousMetrics: metrics,
    comparison: {} as AnalyticsDashboardProjection["comparison"], revenueSeries: [], occupancySeries: [], bookings: [], summaries: [],
    metricProjections: [{ metric: "gross-revenue", label: "Gross revenue", value: 1000, unit: "currency",
      scope: { type: "portfolio", id: "portfolio" }, period: { startDate: "2026-07-01", endDate: "2026-08-01" },
      measuredAt: "2026-07-20T12:00:00Z", calculationVersion: "analytics-v1" }],
  };
}

function revenue(reasoning = true): RevenueIntelligence {
  return {
    report: {} as RevenueIntelligence["report"], opportunityReport: {} as RevenueIntelligence["opportunityReport"],
    bookings: [], occupancySeries: [], generatedAt: "2026-07-20T12:00:00Z",
    ...(reasoning ? { reasoning: { observations: ObservationCollection.empty(), evidence: EvidenceCollection.empty(),
      claims: ClaimCollection.empty(), evaluations: EvaluationCollection.empty(), recommendations: RecommendationCollection.empty() } } : {}),
  };
}

describe("getCurrentHpmCanonicalInputs", () => {
  it("assembles available canonical sources and leaves unavailable providers empty", async () => {
    const getAnalytics = vi.fn().mockResolvedValue(analytics());
    const getRevenue = vi.fn().mockResolvedValue(revenue());
    const result = await getCurrentHpmCanonicalInputs(
      { startDate: "2026-07-01", endDate: "2026-08-01", generatedAt: "2026-07-20T12:00:00Z" },
      { getAnalytics, getRevenue },
    );
    expect(result.inputs.observations.size).toBe(1);
    expect(result.inputs.actions.isEmpty).toBe(true);
    expect(result.inputs.decisions.isEmpty).toBe(true);
    expect(result.inputs.outcomes.isEmpty).toBe(true);
    expect([...result.inputs.pillarScores?.keys() ?? []]).toEqual(["operations", "revenue", "financial"]);
    expect(result.inputs.pillarScores?.get("operations")?.value).toBe(80.6);
    expect(result.inputs.analytics).toEqual({ generatedAt: new Date("2026-07-20T12:00:00Z"), metricCount: 1 });
    expect(getAnalytics).toHaveBeenCalledOnce();
    expect(getRevenue).toHaveBeenCalledOnce();
  });

  it("keeps missing Analytics observations and optional Revenue reasoning partial", async () => {
    const emptyAnalytics = {
      ...analytics(),
      metricProjections: [],
      metrics: { ...analytics().metrics, grossRevenue: 0, roomRevenue: 0, occupiedNights: 0, totalBookings: 0 },
    };
    const result = await getCurrentHpmCanonicalInputs(
      { startDate: "2026-07-01", endDate: "2026-08-01" },
      { getAnalytics: vi.fn().mockResolvedValue(emptyAnalytics), getRevenue: vi.fn().mockResolvedValue(revenue(false)) },
    );
    expect(result.inputs.observations.isEmpty).toBe(true);
    expect(result.inputs.evidence.isEmpty).toBe(true);
    expect(result.inputs.recommendations.isEmpty).toBe(true);
    expect(result.inputs.pillarScores).toBeUndefined();
    expect(result.context.analytics).toBe(emptyAnalytics);
  });
});

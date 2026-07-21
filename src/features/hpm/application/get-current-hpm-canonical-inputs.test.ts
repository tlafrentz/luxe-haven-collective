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
  return {
    generatedAt: "2026-07-20T12:00:00Z", dateRange: { startDate: "2026-07-01", endDate: "2026-08-01" },
    previousDateRange: { startDate: "2026-06-01", endDate: "2026-07-01" }, selectedProperty: null, properties: [],
    metrics: {} as AnalyticsDashboardProjection["metrics"], previousMetrics: {} as AnalyticsDashboardProjection["previousMetrics"],
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
    expect(result.inputs.pillarScores).toBeUndefined();
    expect(result.inputs.analytics).toEqual({ generatedAt: new Date("2026-07-20T12:00:00Z"), metricCount: 1 });
    expect(getAnalytics).toHaveBeenCalledOnce();
    expect(getRevenue).toHaveBeenCalledOnce();
  });

  it("keeps missing Analytics observations and optional Revenue reasoning partial", async () => {
    const emptyAnalytics = { ...analytics(), metricProjections: [] };
    const result = await getCurrentHpmCanonicalInputs(
      { startDate: "2026-07-01", endDate: "2026-08-01" },
      { getAnalytics: vi.fn().mockResolvedValue(emptyAnalytics), getRevenue: vi.fn().mockResolvedValue(revenue(false)) },
    );
    expect(result.inputs.observations.isEmpty).toBe(true);
    expect(result.inputs.evidence.isEmpty).toBe(true);
    expect(result.inputs.recommendations.isEmpty).toBe(true);
    expect(result.context.analytics).toBe(emptyAnalytics);
  });
});

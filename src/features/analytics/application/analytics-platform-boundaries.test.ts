import { describe, expect, it } from "vitest";

import { Identifier } from "@/platform/kernel";
import { createOutcomeId, emptyOutcomeLineage, Outcome, OutcomeCollection } from "@/platform/outcomes";

import { buildAnalyticsMetricProjections } from "../lib/metric-projections";
import { buildPerformanceSummaries } from "../lib/performance-summaries";
import type { DashboardComparison, DashboardMetrics } from "../types";
import { projectOutcomeHistory } from "./project-outcome-history";
import { toPlatformObservations } from "./to-platform-observations";

function metrics(): DashboardMetrics {
  return {
    grossRevenue: 12000, roomRevenue: 10000, occupiedNights: 50, availableNights: 100,
    occupancyRate: 50, averageDailyRate: 200, revPar: 100, averageLengthOfStay: 3,
    averageBookingLeadTime: 21, cancellationRate: 5, totalBookings: 20, upcomingBookings: 5,
    completedBookings: 14, cancelledBookings: 1,
    revenueBreakdown: { roomRevenue: 10000, cleaningFees: 1000, taxes: 500, serviceFees: 500, otherRevenue: 0, grossRevenue: 12000 },
    bookingSources: [], stayLengthDistribution: [],
  };
}

const comparison: DashboardComparison = {
  revenue: { difference: 1200, percentChange: 11.1, direction: "up" },
  occupancy: { difference: -10, percentChange: -16.7, direction: "down" },
  adr: { difference: 0, percentChange: 0, direction: "neutral" },
  revPar: { difference: -20, percentChange: -16.7, direction: "down" },
};

describe("Analytics Platform boundaries", () => {
  it("keeps canonical performance summaries descriptive and advice-free", () => {
    const summaries = buildPerformanceSummaries(metrics(), comparison);
    expect(summaries).toHaveLength(4);
    expect(summaries.map((value) => value.description).join(" ")).not.toMatch(/consider|should|recommend|optimi[sz]e|attention/i);
    expect(summaries.find((value) => value.id === "occupancy-comparison")?.description).toContain("decreased 16.7%");
  });

  it("maps factual metric projections to traceable Platform Observations", () => {
    const projections = buildAnalyticsMetricProjections({
      metrics: metrics(),
      dateRange: { startDate: "2026-07-01", endDate: "2026-08-01" },
      propertyId: "property-1",
      measuredAt: "2026-08-01T12:00:00Z",
    });
    const observations = toPlatformObservations(projections);
    const occupancy = observations.toArray().find((value) => value.type === "analytics.occupancy-rate");
    expect(observations.size).toBe(projections.length);
    expect(occupancy?.value).toBe(50);
    expect(occupancy?.subject.id).toBe("property-1");
    expect(occupancy?.metadata?.calculationVersion).toBe("analytics-v1");
  });

  it("projects Outcome history without owning or changing lifecycle state", () => {
    const actionId = Identifier.create("action-pricing-1");
    const decisionId = Identifier.create("decision-pricing-1");
    const lineage = emptyOutcomeLineage();
    const outcome = Outcome.create({
      id: createOutcomeId("outcome-pricing-1"), title: "Pricing effect", summary: "Measured pricing result.",
      type: "action", status: "completed", successful: true,
      startedAt: new Date("2026-07-01T00:00:00Z"), completedAt: new Date("2026-07-02T00:00:00Z"),
      metrics: { revenueImpact: 250 }, lineage: { ...lineage, actionIds: [actionId], decisionIds: [decisionId] },
    });
    const history = projectOutcomeHistory(OutcomeCollection.create([outcome]));
    expect(history[0].metrics.revenueImpact).toBe(250);
    expect(history[0].actionIds).toEqual([actionId.value]);
    expect(outcome.status).toBe("completed");
  });
});

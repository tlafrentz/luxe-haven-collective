import { describe, expect, it, vi } from "vitest";
import { ActionCollection } from "@/platform/actions";
import { ClaimCollection } from "@/platform/claims";
import { DecisionCollection } from "@/platform/decisions";
import { EvaluationCollection } from "@/platform/evaluations";
import { EvidenceCollection } from "@/platform/evidence";
import { IntelligenceCollection } from "@/platform/intelligence";
import { LearningCollection } from "@/platform/learning";
import { ObservationCollection } from "@/platform/observations";
import { OutcomeCollection } from "@/platform/outcomes";
import { RecommendationCollection } from "@/platform/recommendations";
import { buildHpmLifecycleProjection, type CurrentHpmLifecycleResult } from "@/features/hpm";

import { getExecutiveIntelligenceView } from "./get-executive-intelligence-view";

describe("getExecutiveIntelligenceView", () => {
  it("uses the shared lifecycle query and returns its result unchanged", async () => {
    const lifecycle = buildHpmLifecycleProjection({ observations: ObservationCollection.empty(), evidence: EvidenceCollection.empty(), claims: ClaimCollection.empty(),
      evaluations: EvaluationCollection.empty(), recommendations: RecommendationCollection.empty(), decisions: DecisionCollection.empty(), actions: ActionCollection.empty(),
      outcomes: OutcomeCollection.empty(), intelligence: IntelligenceCollection.empty(), learning: LearningCollection.empty() }, { now: new Date("2026-07-20T12:00:00Z") });
    const neutral = { difference: 0, percentChange: 0, direction: "neutral" as const };
    const analytics = { properties: [], selectedProperty: null, dateRange: { startDate: "2026-07-01", endDate: "2026-08-01" },
      metrics: { grossRevenue: 0, occupancyRate: 0, averageDailyRate: 0, revPar: 0, totalBookings: 0, upcomingBookings: 0 },
      comparison: { revenue: neutral, occupancy: neutral, adr: neutral, revPar: neutral } } as unknown as CurrentHpmLifecycleResult["context"]["analytics"];
    const lifecycleResult = { lifecycle, context: { analytics, revenue: {} as never } } satisfies CurrentHpmLifecycleResult;
    const getLifecycle = vi.fn().mockResolvedValue(lifecycleResult);
    const result = await getExecutiveIntelligenceView({ startDate: "2026-07-01", endDate: "2026-08-01" }, getLifecycle);
    expect(result.lifecycleResult).toBe(lifecycleResult);
    expect(result.view.health.status).toBe("unavailable");
    expect(result.view.scope.scopeKnown).toBe(true);
    expect(getLifecycle).toHaveBeenCalledOnce();
  });
});

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
import type { CurrentHpmCanonicalAssembly } from "./get-current-hpm-canonical-inputs";
import { getCurrentHpmLifecycleProjection } from "./get-current-hpm-lifecycle-projection";

describe("getCurrentHpmLifecycleProjection", () => {
  it("returns the projection and preserves partial canonical collections", async () => {
    const assembly = {
      inputs: { observations: ObservationCollection.empty(), evidence: EvidenceCollection.empty(), claims: ClaimCollection.empty(),
        evaluations: EvaluationCollection.empty(), recommendations: RecommendationCollection.empty(), decisions: DecisionCollection.empty(),
        actions: ActionCollection.empty(), outcomes: OutcomeCollection.empty(), intelligence: IntelligenceCollection.empty(), learning: LearningCollection.empty(),
        analytics: { generatedAt: new Date("2026-07-20T12:00:00Z"), metricCount: 0 } },
      context: { analytics: {} as never, revenue: {} as never },
    } satisfies CurrentHpmCanonicalAssembly;
    const getInputs = vi.fn().mockResolvedValue(assembly);
    const result = await getCurrentHpmLifecycleProjection({ startDate: "2026-07-01", endDate: "2026-08-01" }, getInputs);
    expect(result.lifecycle.generatedAt).toEqual(new Date("2026-07-20T12:00:00Z"));
    expect(result.lifecycle.health.score).toBeNull();
    expect(result.lifecycle.dataGaps).toContain("No current Observations are available.");
    expect(result.context).toBe(assembly.context);
    expect(getInputs).toHaveBeenCalledOnce();
  });

  it("surfaces assembler errors", async () => {
    await expect(getCurrentHpmLifecycleProjection(
      { startDate: "2026-07-01", endDate: "2026-08-01" },
      vi.fn().mockRejectedValue(new Error("provider failed")),
    )).rejects.toThrow("provider failed");
  });
});

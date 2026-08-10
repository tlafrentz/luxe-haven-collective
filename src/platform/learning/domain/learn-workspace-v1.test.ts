import { describe, expect, it } from "vitest";
import { approvedLearningBoundary, assessLessonConfidence, ingestFinalizedOutcome, transitionLesson, validateLessonApplicability, type FinalizedOutcomeLearningSource } from "./learn-workspace-v1";

const source = (changes: Partial<FinalizedOutcomeLearningSource> = {}): FinalizedOutcomeLearningSource => ({ outcomeId: "outcome-1", outcomeVersion: 1, workspaceId: "workspace-1", propertyIds: ["property-1"], sourceActionId: "action-1", sourcePlanId: "plan-1", sourceDecisionId: "decision-1", sourceState: "finalized", classification: "achieved", confidence: "medium", dataQuality: "sufficient", measurementType: "percentage-change", metricCategory: "revenue", measurementWindow: { start: "2026-07-01", end: "2026-07-31", timezone: "America/Chicago" }, baselineToActual: { baseline: 100, actual: 110, relativeVariance: .1 }, targetVariance: 0, requiredGuardrailsPassed: true, attributionCaveat: "The result followed the action; causation was not established.", finalizedAt: "2026-08-01T00:00:00Z", ...changes });

describe("LR-001 Learn foundation", () => {
  it("ingests each finalized outcome version idempotently with complete lineage", () => {
    const first = ingestFinalizedOutcome(source(), "2026-08-02T00:00:00Z");
    const replay = ingestFinalizedOutcome(source(), "2026-08-02T00:00:00Z");
    expect(first).toEqual(replay);
    expect(first.idempotencyKey).toBe("learning-signal:outcome:outcome-1:v1");
    expect(first.context).toMatchObject({ sourceActionId: "action-1", sourcePlanId: "plan-1", sourceDecisionId: "decision-1" });
  });

  it("keeps inconclusive and not-measurable outcomes useful without treating them as failed practices", () => {
    for (const [sourceState, classification] of [["inconclusive", "inconclusive"], ["not-measurable", "not-measurable"]] as const) {
      const signal = ingestFinalizedOutcome(source({ sourceState, classification }), "2026-08-02T00:00:00Z");
      expect(signal.eligibility).toBe("eligible");
      expect(signal.eligibilityReason).toMatch(/measurement or execution learning/);
    }
  });

  it("requires invalidation before processing reopened or superseded source versions", () => {
    expect(() => ingestFinalizedOutcome(source({ sourceState: "reopened" }), "2026-08-02T00:00:00Z")).toThrow(/invalidate prior learning/i);
  });

  it("enforces human-reviewed lesson lifecycle decisions", () => {
    expect(transitionLesson("draft", "ready-for-review")).toBe("ready-for-review");
    expect(() => transitionLesson("awaiting-review", "approved")).toThrow(/authorized reviewer/);
    expect(transitionLesson("awaiting-review", "approved", { reviewerAuthorized: true })).toBe("approved");
    expect(() => transitionLesson("draft", "rejected", { reviewerAuthorized: true })).toThrow(/requires a reason/);
  });

  it("lowers confidence for contradictions, source amendments, and unsupported breadth", () => {
    const narrow = assessLessonConfidence({ supportingCount: 5, contradictingCount: 0, propertyCount: 4, averageSourceConfidence: .9, averageDataQuality: .9, prospectiveRatio: 1, reopenedSourceCount: 0, applicabilityScope: "customer-portfolio" });
    const broadFromOne = assessLessonConfidence({ supportingCount: 5, contradictingCount: 1, propertyCount: 1, averageSourceConfidence: .9, averageDataQuality: .9, prospectiveRatio: 1, reopenedSourceCount: 1, applicabilityScope: "customer-portfolio" });
    expect(narrow.confidence).toBe("high");
    expect(broadFromOne.score).toBeLessThanOrEqual(49);
    expect(broadFromOne.reasons.join(" ")).toMatch(/Broad applicability/);
  });

  it("prevents silent applicability broadening", () => {
    const applicability = { scope: "selected-properties" as const, propertyIds: ["property-1", "property-2"], conditions: [], exclusions: [] };
    expect(() => validateLessonApplicability(applicability, ["property-1"])).toThrow(/requires a reason/);
    expect(validateLessonApplicability(applicability, ["property-1"], "Comparable operating model").propertyIds).toHaveLength(2);
  });

  it("exposes only current approved records to LR-002", () => {
    const approved = { lessonId: "lesson-1", lessonVersion: 1, status: "approved" as const, statement: "Observed association.", lessonType: "successful-practice", confidence: "medium" as const, evidenceStrength: "moderate" as const, applicability: { scope: "single-property" as const, propertyIds: ["property-1"], conditions: [], exclusions: [] }, limitations: ["One property"], attributionCaveat: "Causation not established.", supportingSourceReferences: [{ type: "outcome" as const, id: "outcome-1", version: 1 }], contradictingSourceCount: 0, approvedBy: "reviewer-1", approvedAt: "2026-08-03", lastReviewedAt: "2026-08-03" };
    expect(approvedLearningBoundary([approved])).toEqual([approved]);
  });
});

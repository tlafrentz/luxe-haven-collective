import { describe, expect, it } from "vitest";
import { assessLearningApplicability, assessLearningRecommendation, createRecommendationHandoff, requireEligibleLearning, transitionLearningRecommendation, type ApprovedLearningSource } from "./learning-recommendation";

const lesson = (changes: Partial<ApprovedLearningSource> = {}): ApprovedLearningSource => ({ lessonId: "lesson-1", lessonVersion: 2, status: "approved", statement: "Observed practice was associated with improvement.", lessonType: "successful-practice", confidence: "high", evidenceStrength: "strong", applicability: { scope: "single-property", propertyIds: ["property-1"], conditions: [{ key: "market", operator: "equals", value: "Austin" }], exclusions: ["peak-event"] }, limitations: ["Causation not established"], supportingSourceReferences: [{ type: "outcome", id: "outcome-1", version: 1 }], contradictingSourceCount: 0, approvedBy: "reviewer-1", approvedAt: "2026-08-01", lastReviewedAt: "2026-08-01", ...changes });
const target = (changes: Record<string, unknown> = {}) => ({ targetType: "property" as const, targetId: "property-1", contextVersion: 3, propertyIds: ["property-1"], attributes: { market: "Austin", evaluatedAt: "2026-08-09", ...changes }, dataQuality: "complete" as const });

describe("LR-002 Learning Recommendations", () => {
  it("accepts only current approved LR-001 learning", () => {
    expect(requireEligibleLearning(lesson(), "2026-08-09").lessonVersion).toBe(2);
    expect(() => requireEligibleLearning(lesson({ status: "needs-reevaluation" }), "2026-08-09")).toThrow(/current approved learning/i);
    expect(() => requireEligibleLearning(lesson({ status: "retired" }), "2026-08-09")).toThrow(/current approved learning/i);
  });

  it("evaluates matches, unknowns, exclusions, and unsupported scope expansion", () => {
    expect(assessLearningApplicability(lesson(), target()).match).toBe("strong-match");
    expect(assessLearningApplicability(lesson(), target({ market: undefined })).match).toBe("insufficient-context");
    expect(assessLearningApplicability(lesson(), target({ exclusions: ["peak-event"] })).match).toBe("excluded");
    expect(assessLearningApplicability(lesson(), { ...target(), targetId: "property-2", propertyIds: ["property-2"] }).match).toBe("partial-match");
  });

  it("never raises recommendation certainty above the source lesson", () => {
    const applicability = assessLearningApplicability(lesson({ confidence: "low", evidenceStrength: "limited" }), target());
    const result = assessLearningRecommendation({ lesson: lesson({ confidence: "low", evidenceStrength: "limited" }), applicability, targetDataQuality: "complete", supportingLessonCount: 5, contradictingLessonCount: 0, risk: "low", reversible: true, measurementReady: true });
    expect(result.confidence).not.toBe("high");
    expect(result.score).toBeLessThanOrEqual(49);
  });

  it("frames property-specific scope expansion as investigatory", () => {
    const applicability = assessLearningApplicability(lesson(), { ...target(), targetId: "property-2", propertyIds: ["property-2"] });
    expect(assessLearningRecommendation({ lesson: lesson(), applicability, targetDataQuality: "complete", supportingLessonCount: 1, contradictingLessonCount: 0, risk: "low", reversible: true, measurementReady: true }).strength).toBe("investigatory");
  });

  it("enforces review dispositions and reasons", () => {
    expect(() => transitionLearningRecommendation("awaiting-review", "accepted")).toThrow(/authorized reviewer/);
    expect(transitionLearningRecommendation("awaiting-review", "accepted", { reviewerAuthorized: true })).toBe("accepted");
    expect(() => transitionLearningRecommendation("awaiting-review", "rejected", { reviewerAuthorized: true })).toThrow(/requires a reason/);
    expect(() => transitionLearningRecommendation("awaiting-review", "deferred", { reviewerAuthorized: true })).toThrow(/review date or condition/);
  });

  it("creates only explicit authorized and measurable handoff requests", () => {
    const base = { recommendationId: "recommendation-1", recommendationVersion: 1, handoffType: "draft-action-plan" as const, correlationId: "correlation-1", sourceLessonVersions: [{ id: "lesson-1", version: 2 }], target: { type: "property", id: "property-1", propertyIds: ["property-1"] }, expectedResult: "Reduce response time", measurementExpectation: "Compare median response time after 30 days" };
    expect(() => createRecommendationHandoff({ ...base, accepted: false, authorized: true })).toThrow(/accepted recommendation/);
    const handoff = createRecommendationHandoff({ ...base, accepted: true, authorized: true });
    expect(handoff.status).toBe("requested");
    expect(handoff.idempotencyKey).toContain("draft-action-plan");
  });
});

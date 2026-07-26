import { describe, expect, it } from "vitest";
import {
  detectContradiction, generateCandidateLesson, mergeLessons, publishLesson,
  retireLesson, reviseLesson, validateAssumption, LessonKnowledgeError,
  type OrganizationalLesson,
} from ".";

const at = "2026-07-25T00:00:00.000Z";
const evidence = Object.freeze([{
  type: "review" as const, capability: "platform-learning",
  sourceId: "review:1", sourceVersion: "1",
}]);
const applicability = Object.freeze([{
  dimension: "strategy" as const, value: "weekend-pricing",
}, { dimension: "market" as const, referenceId: "market:mesa" }]);

function lesson(overrides: Partial<OrganizationalLesson> = {}): OrganizationalLesson {
  return Object.freeze({
    id: "lesson:1:v1", seriesId: "lesson:1", revision: 1,
    workspaceId: "workspace:1", learningSubjectId: "subject:1",
    category: "revenue", statement: "Weekend ADR increases improve RevPAR.",
    applicability, confidence: "moderate", maturity: "emerging",
    status: "validated", contradictionState: "none", evidence,
    sourceReviewIds: Object.freeze(["review:1"]),
    sourceCandidateIds: Object.freeze(["candidate:1"]),
    policyVersion: "lesson-v1", createdByProfileId: "profile:1", createdAt: at,
    ...overrides,
  });
}

describe("assumption validation and lessons", () => {
  it("validates assumptions only from terminal evidence-backed reviews", () => {
    const result = validateAssumption({
      assumption: Object.freeze({
        id: "assumption:1", workspaceId: "workspace:1", learningSubjectId: "subject:1",
        statement: "Higher weekend ADR improves RevPAR.", category: "revenue",
        sourceReviewId: "review:1", createdByProfileId: "profile:1", createdAt: at,
      }),
      outcomeReview: Object.freeze({
        id: "review:1", workspaceId: "workspace:1", status: "completed",
        confidence: "moderate", evidence,
      }),
      status: "confirmed", rationale: "RevPAR exceeded the versioned target.",
      reviewerProfileId: "profile:2", policyVersion: "assumption-v1", createdAt: at,
    });
    expect(result.result.status).toBe("confirmed");
    expect(result.event.type).toBe("AssumptionValidated");
  });

  it("keeps candidates distinct from published knowledge", () => {
    const candidate = generateCandidateLesson({
      id: "candidate:1", seriesId: "candidate-series:1", revision: 1,
      workspaceId: "workspace:1", learningSubjectId: "subject:1",
      category: "revenue", statement: "Weekend ADR increases improve RevPAR.",
      applicability, confidence: "moderate", evidence,
      sourceReviewIds: Object.freeze(["review:1"]),
      sourceAssumptionResultIds: Object.freeze(["assumption-result:1"]),
      policyVersion: "candidate-v1", createdByProfileId: "profile:1", createdAt: at,
    }).candidate;
    expect(candidate.status).toBe("candidate");
    expect(publishLesson({
      ...lesson(), id: "lesson:1:v1", sourceCandidateIds: [candidate.id],
    }).lesson.status).toBe("validated");
  });

  it("never defaults applicability to everywhere", () => {
    expect(() => publishLesson({
      ...lesson(), applicability: [],
    })).toThrowError(LessonKnowledgeError);
  });

  it("detects overlapping opposing conclusions without deleting either lesson", () => {
    const first = lesson();
    const second = lesson({
      id: "lesson:2:v1", seriesId: "lesson:2",
      statement: "Weekend ADR increases reduce RevPAR.",
      sourceReviewIds: ["review:2"],
    });
    const contradiction = detectContradiction(first, second, {
      id: "contradiction:1", rationale: "Opposing RevPAR conclusions overlap in Mesa.",
      evidence, policyVersion: "contradiction-v1", createdByProfileId: "profile:1",
      createdAt: at, opposingConclusion: true,
    });
    expect(contradiction?.contradictionState).toBe("possible");
    expect(first.status).toBe("validated");
    expect(second.status).toBe("validated");
  });

  it("appends revisions, supersession, retirement, and merges", () => {
    const first = lesson();
    const revised = reviseLesson(first, {
      ...first, id: "lesson:1:v2",
      statement: "Weekend ADR increases improve RevPAR in high-demand Mesa periods.",
      maturity: "supported", createdAt: "2026-08-01T00:00:00.000Z",
    });
    expect(revised.lesson.revision).toBe(2);
    expect(revised.relationship.type).toBe("supersedes");
    expect(retireLesson(revised.lesson, {
      id: "lesson:1:v3", reason: "Operating model changed.",
      retiredByProfileId: "profile:admin", retiredAt: "2027-01-01T00:00:00.000Z",
      policyVersion: "retirement-v1",
    }).lesson.status).toBe("retired");
    const merged = mergeLessons([first, lesson({ id: "lesson:2:v1", seriesId: "lesson:2" })], {
      ...lesson(), id: "lesson:3:v1", seriesId: "lesson:3",
      statement: "Context-specific weekend pricing improves RevPAR.",
      sourceCandidateIds: ["candidate:1", "candidate:2"],
    });
    expect(merged.relationships).toHaveLength(2);
  });
});

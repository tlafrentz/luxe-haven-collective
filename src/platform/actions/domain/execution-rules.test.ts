import { describe, expect, it } from "vitest";
import { assertAcyclicDependencies, evaluateCompletionReadiness, evaluateTimeEscalation, generateScheduledOccurrences, triggeredOccurrenceKey } from "./execution-rules";

describe("EX-001 execution policies", () => {
  it("prevents completion until criteria, evidence, approval, and dependencies are satisfied", () => {
    const blocked = evaluateCompletionReadiness({ policy: { mode: "specific", requiredTypes: ["photo"], minimumPhotoCount: 2, beforeAndAfterPhotos: true, reviewerApprovalRequired: true }, evidence: [{ type: "photo", reviewStatus: "pending", photoPhase: "before" }], checklistComplete: false, unresolvedDependencyIds: ["action-2"] });
    expect(blocked.ready).toBe(false); expect(blocked.blockers).toHaveLength(5);
    expect(evaluateCompletionReadiness({ policy: { mode: "specific", requiredTypes: ["photo"], minimumPhotoCount: 2, beforeAndAfterPhotos: true, reviewerApprovalRequired: true }, evidence: [{ type: "photo", reviewStatus: "accepted", photoPhase: "before" }, { type: "photo", reviewStatus: "pending", photoPhase: "after" }], checklistComplete: true }).ready).toBe(true);
  });

  it("rejects direct and indirect dependency cycles", () => {
    expect(() => assertAcyclicDependencies([{ actionId: "a", dependsOnActionId: "a" }])).toThrow(/itself/);
    expect(() => assertAcyclicDependencies([{ actionId: "a", dependsOnActionId: "b" }, { actionId: "b", dependsOnActionId: "c" }, { actionId: "c", dependsOnActionId: "a" }])).toThrow(/cycle/);
    expect(() => assertAcyclicDependencies([{ actionId: "a", dependsOnActionId: "b" }, { actionId: "c", dependsOnActionId: "b" }])).not.toThrow();
  });

  it("generates immutable schedule identities and deduplicates replayed reservation events", () => {
    const occurrences = generateScheduledOccurrences({ templateId: "weekly-clean", templateVersion: 2, startsAt: new Date("2026-08-03T15:00:00Z"), from: new Date("2026-08-03T00:00:00Z"), through: new Date("2026-08-18T00:00:00Z"), rule: { type: "weekly" }, dueOffsetSeconds: 3600 });
    expect(occurrences.map((item) => item.scheduledFor.toISOString())).toEqual(["2026-08-03T15:00:00.000Z", "2026-08-10T15:00:00.000Z", "2026-08-17T15:00:00.000Z"]);
    expect(occurrences[0].dueAt?.toISOString()).toBe("2026-08-03T16:00:00.000Z");
    expect(triggeredOccurrenceKey("turnover", 1, "checkout", "reservation-42")).toBe(triggeredOccurrenceKey("turnover", 1, "checkout", "reservation-42"));
  });

  it("evaluates deterministic time-based escalation boundaries", () => {
    const base = { statusChangedAt: new Date("2026-08-09T10:00:00Z"), now: new Date("2026-08-09T12:00:00Z"), dueSoonSeconds: 3600, criticalOverdueSeconds: 7200, blockedSeconds: 3600, reviewSeconds: 7200 };
    expect(evaluateTimeEscalation({ ...base, status: "blocked" })).toBe("blocked-too-long");
    expect(evaluateTimeEscalation({ ...base, status: "ready", dueAt: new Date("2026-08-09T11:00:00Z") })).toBe("overdue");
    expect(evaluateTimeEscalation({ ...base, status: "ready", dueAt: new Date("2026-08-09T12:30:00Z") })).toBe("due-soon");
  });
});

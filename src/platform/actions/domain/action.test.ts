import { describe, expect, it } from "vitest";
import { createOutcomeId } from "../../outcomes";
import { PlatformAction, type ActionMutationContext } from "./action";
import { createActionAssignmentId } from "./action-assignment";
import { PlatformActionCollection } from "./action-collection";
import { ActionAlreadyAssigned, DuplicateActionSource, DuplicateOutcomeReference, InvalidActionSchedule, InvalidActionTransition, InvalidActionVersion, MissingActionSource } from "./action-errors";
import { createActionId, createWorkspaceId } from "./action-id";
import { ActionVersion } from "./action-version";

const workspaceId = createWorkspaceId("workspace-1");
const actor = { type: "user", id: "user-1" } as const;
const createdAt = new Date("2026-07-20T10:00:00.000Z");
const source = { type: "manual", recordedAt: createdAt, recordedBy: actor } as const;

function draft(overrides: Partial<Parameters<typeof PlatformAction.createDraft>[0]> = {}) {
  return PlatformAction.createDraft({ id: createActionId("action-1"), workspaceId, title: "Review operating plan", description: "Confirm the committed work.", actionType: "operations", priority: "normal", owner: { type: "team", id: "operations" }, sources: [source], createdAt, createdBy: actor, ...overrides });
}
function command(action: PlatformAction, minute: number, extra: Partial<ActionMutationContext> = {}): ActionMutationContext {
  return { workspaceId, expectedVersion: action.version, actor, occurredAt: new Date(`2026-07-20T10:${String(minute).padStart(2, "0")}:00.000Z`), ...extra };
}
function committed(): PlatformAction { return draft().commit(command(draft(), 1)); }
function ready(): PlatformAction { const value = committed(); return value.markReady(command(value, 2)); }
function started(): PlatformAction { const value = ready(); return value.start(command(value, 3)); }

describe("PlatformAction creation and identity", () => {
  it("creates valid draft and committed Actions with mandatory scope and provenance", () => {
    const first = draft(), second = PlatformAction.createCommitted({ workspaceId, title: "Publish plan", priority: "high", owner: { type: "system", id: "planner" }, sources: [{ type: "decision", sourceId: "decision-1", recordedAt: createdAt, recordedBy: actor }], createdAt, createdBy: actor });
    expect(first.status).toBe("draft"); expect(second.status).toBe("committed"); expect(first.version.value).toBe(1); expect(first.history).toHaveLength(1); expect(first.workspaceId).toBe(workspaceId); expect(first.createdBy).toEqual(actor);
  });
  it("rejects missing and duplicate sources", () => {
    expect(() => draft({ sources: [] })).toThrow(MissingActionSource);
    expect(() => draft({ sources: [source, { ...source }] })).toThrow(DuplicateActionSource);
  });
  it("rejects invalid versions", () => { for (const value of [0, -1, 1.5]) expect(() => ActionVersion.create(value)).toThrow(InvalidActionVersion); });
  it("reconstitutes complete state without generating history", () => {
    const value = draft(); const restored = PlatformAction.reconstitute({ id: value.id, workspaceId: value.workspaceId, title: value.title, description: value.description, actionType: value.actionType, status: value.status, priority: value.priority, owner: value.owner, assignments: value.assignments, schedule: value.scheduleValue, sources: value.sources, history: value.history, outcomeReferences: value.outcomeReferences, createdAt: value.createdAt, createdBy: value.createdBy, updatedAt: value.updatedAt, version: value.version });
    expect(restored.history).toHaveLength(1); expect(restored.version.equals(value.version)).toBe(true);
  });
});

describe("PlatformAction lifecycle and immutability", () => {
  it("supports the normal path and terminal archive", () => {
    const d = draft(), c = d.commit(command(d, 1)), r = c.markReady(command(c, 2)), s = r.start(command(r, 3)), done = s.complete(command(s, 4)), archived = done.archive(command(done, 5));
    expect([d.status, c.status, r.status, s.status, done.status, archived.status]).toEqual(["draft", "committed", "ready", "in-progress", "completed", "archived"]);
    expect(done.scheduleValue.completed?.toISOString()).toBe("2026-07-20T10:04:00.000Z"); expect(done.outcomeReferences).toHaveLength(0);
  });
  it("supports every approved blocked and cancellation path", () => {
    const c = committed(), cb = c.block(command(c, 2)), cr = cb.unblock({ ...command(cb, 3), resumeTo: "ready" });
    const s = started(), sb = s.block(command(s, 4)), resumed = sb.unblock({ ...command(sb, 5), resumeTo: "in-progress" });
    expect([cb.status, cr.status, sb.status, resumed.status]).toEqual(["blocked", "ready", "blocked", "in-progress"]);
    for (const value of [draft(), committed(), ready(), started(), cb]) expect(value.cancel(command(value, 9)).status).toBe("cancelled");
    const cancelled = draft().cancel(command(draft(), 1)); expect(cancelled.archive(command(cancelled, 2)).status).toBe("archived"); expect(draft().archive(command(draft(), 1)).status).toBe("archived");
  });
  it("rejects every unapproved transition and has no measured state", () => {
    expect(() => draft().start(command(draft(), 1))).toThrow(InvalidActionTransition);
    expect(() => committed().complete(command(committed(), 2))).toThrow(InvalidActionTransition);
    expect((PlatformAction.prototype as unknown as Record<string, unknown>).measure).toBeUndefined();
  });
  it("rejects every status-changing operation not present in the transition matrix", () => {
    const d = draft(), c = d.commit(command(d, 1)), r = c.markReady(command(c, 2)), running = r.start(command(r, 3)), blocked = running.block(command(running, 4)), done = running.complete(command(running, 4)), cancelled = r.cancel(command(r, 4)), archived = done.archive(command(done, 5));
    const states = [d, c, r, running, blocked, done, cancelled, archived] as const;
    const approved = new Set(["draft:committed", "draft:cancelled", "draft:archived", "committed:ready", "committed:blocked", "committed:cancelled", "ready:in-progress", "ready:blocked", "ready:cancelled", "in-progress:blocked", "in-progress:completed", "in-progress:cancelled", "blocked:ready", "blocked:in-progress", "blocked:cancelled", "completed:archived", "cancelled:archived"]);
    const targets = ["committed", "ready", "in-progress", "blocked", "completed", "cancelled", "archived"] as const;
    for (const state of states) for (const target of targets) {
      if (approved.has(`${state.status}:${target}`)) continue;
      const context = command(state, 9);
      const operation = () => {
        switch (target) {
          case "committed": return state.commit(context);
          case "ready": return state.status === "blocked" ? state.unblock({ ...context, resumeTo: "ready" }) : state.markReady(context);
          case "in-progress": return state.status === "blocked" ? state.unblock({ ...context, resumeTo: "in-progress" }) : state.start(context);
          case "blocked": return state.block(context);
          case "completed": return state.complete(context);
          case "cancelled": return state.cancel(context);
          case "archived": return state.archive(context);
        }
      };
      expect(operation, `${state.status} -> ${target}`).toThrow();
    }
  });
  it("increments once, appends once, and leaves the prior aggregate unchanged", () => {
    const before = draft(), after = before.commit(command(before, 1));
    expect(before.status).toBe("draft"); expect(before.version.value).toBe(1); expect(before.history).toHaveLength(1);
    expect(after.version.value).toBe(2); expect(after.history).toHaveLength(2); expect(after.id).toBe(before.id); expect(after.workspaceId).toBe(before.workspaceId); expect(after.createdAt).toEqual(before.createdAt);
  });
});

describe("PlatformAction assignment, ownership, and schedule", () => {
  it("assigns, queues, claims, releases, and retains assignment history", () => {
    const value = draft(), queued = value.assign({ ...command(value, 1), assignmentId: createActionAssignmentId("assignment-1"), assigneeType: "unknown", queue: "operations" });
    const claimed = queued.claim({ ...command(queued, 2), assigneeType: "user", assigneeId: "operator-1" }); const released = claimed.releaseAssignment(command(claimed, 3));
    const reassigned = released.assign({ ...command(released, 4), assigneeType: "automation", assigneeId: "scheduler" });
    expect(reassigned.assignments).toHaveLength(2); expect(reassigned.activeAssignment?.assigneeId).toBe("scheduler"); expect(reassigned.owner).toEqual(value.owner);
  });
  it("rejects a second active assignment and invalid claims", () => {
    const value = draft(), assigned = value.assign({ ...command(value, 1), assigneeType: "user", assigneeId: "operator" });
    expect(() => assigned.assign({ ...command(assigned, 2), assigneeType: "team", assigneeId: "ops" })).toThrow(ActionAlreadyAssigned);
    const claimed = assigned.claim({ ...command(assigned, 2), assigneeType: "user", assigneeId: "operator" }); expect(() => claimed.claim({ ...command(claimed, 3), assigneeType: "user", assigneeId: "other" })).toThrow();
  });
  it("validates scheduling independently from status", () => {
    const value = draft(), scheduled = value.schedule({ ...command(value, 1), startAfter: new Date("2026-07-21T10:00:00Z"), due: new Date("2026-07-22T10:00:00Z") });
    expect(scheduled.status).toBe("draft"); expect(scheduled.scheduleValue.due?.toISOString()).toBe("2026-07-22T10:00:00.000Z"); expect(scheduled.scheduleValue.completed).toBeUndefined();
    expect(() => value.schedule({ ...command(value, 1), startAfter: new Date("2026-07-22T10:00:00Z"), due: new Date("2026-07-21T10:00:00Z") })).toThrow(InvalidActionSchedule);
  });
});

describe("PlatformAction outcome references and collection", () => {
  it("links unique Outcomes without changing status or embedding Outcome content", () => {
    const value = draft(), outcomeId = createOutcomeId("outcome-1"), linked = value.linkOutcome({ ...command(value, 1), outcomeId, linkType: "result" });
    expect(linked.status).toBe("draft"); expect(linked.outcomeReferences).toHaveLength(1); expect(() => linked.linkOutcome({ ...command(linked, 2), outcomeId, linkType: "impact" })).toThrow(DuplicateOutcomeReference);
  });
  it("filters immutable collections by status, owner, source, activity, and due date", () => {
    const openDraft = draft({ id: createActionId("action-open") }); const open = openDraft.schedule({ ...command(openDraft, 1), due: new Date("2026-07-21T00:00:00Z") });
    const progressDraft = draft({ id: createActionId("action-progress") }); const progressCommitted = progressDraft.commit(command(progressDraft, 1)); const progressReady = progressCommitted.markReady(command(progressCommitted, 2)); const inProgress = progressReady.start(command(progressReady, 3));
    const completedDraft = draft({ id: createActionId("action-completed") }); const completedCommitted = completedDraft.commit(command(completedDraft, 1)); const completedReady = completedCommitted.markReady(command(completedCommitted, 2)); const completedStarted = completedReady.start(command(completedReady, 3)); const completed = completedStarted.complete(command(completedStarted, 4));
    const collection = PlatformActionCollection.create([open, inProgress, completed]);
    expect(collection.size).toBe(3); expect(collection.active().size).toBe(2); expect(collection.completed().size).toBe(1); expect(collection.overdue(new Date("2026-07-22T00:00:00Z")).size).toBe(1); expect(collection.filterByOwner({ type: "team", id: "operations" }).size).toBe(3); expect(collection.filterBySource(source).size).toBe(3); expect(collection.all()).not.toBe(collection.all());
  });
});

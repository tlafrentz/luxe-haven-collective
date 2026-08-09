import { describe, expect, it } from "vitest";
import {
  PlatformAction,
  createActionId,
  createWorkspaceId,
  type ActionActor,
  type ActionDependency,
} from "../domain";
import {
  ExecuteControlsService,
  type ExecuteControlAuthorization,
  type ExecuteControlMutation,
  type ExecuteControlRepository,
  type ExecuteControlState,
} from "./execute-controls";

const actor = { type: "user", id: "owner-1" } as const,
  reviewer = { type: "user", id: "reviewer-1" } as const,
  at = new Date("2026-08-09T15:00:00Z");
function ready(id = "action-1") {
  let action = PlatformAction.createCommitted({
    id: createActionId(id),
    workspaceId: createWorkspaceId("workspace-1"),
    title: id,
    priority: "high",
    owner: actor,
    sources: [{ type: "manual", recordedAt: at, recordedBy: actor }],
    createdAt: at,
    createdBy: actor,
  });
  const context = () => ({
    workspaceId: action.workspaceId,
    expectedVersion: action.version,
    actor,
    occurredAt: at,
  });
  action = action.assign({
    ...context(),
    assigneeType: "user",
    assigneeId: actor.id,
  });
  return action.markReady(context());
}
class MemoryRepository implements ExecuteControlRepository {
  public commits: ExecuteControlMutation[] = [];
  public state: ExecuteControlState;
  public constructor(
    action = ready(),
    policy: ExecuteControlState["evidencePolicy"] = { mode: "optional" },
    related = [action],
  ) {
    this.state = {
      action,
      evidencePolicy: policy,
      evidence: [],
      blockers: [],
      dependencies: [],
      relatedActions: related,
    };
  }
  public async get() {
    return this.state;
  }
  public async commit(
    _workspace: string,
    _action: string,
    expected: number,
    mutation: ExecuteControlMutation,
  ) {
    if (this.state.action.version.value !== expected) {
      const error = new Error();
      error.name = "40001";
      throw error;
    }
    this.commits.push(mutation);
    const remove = new Set(
      (mutation.dependencyDeletes ?? []).map(
        (item) => `${item.actionId}:${item.dependsOnActionId}`,
      ),
    );
    this.state = {
      ...this.state,
      action: mutation.action ?? this.state.action,
      evidence: merge(
        this.state.evidence,
        mutation.evidenceUpserts ?? [],
        (item) => item.id,
      ),
      blockers: merge(
        this.state.blockers,
        mutation.blockerUpserts ?? [],
        (item) => item.id,
      ),
      dependencies: merge(
        this.state.dependencies.filter(
          (item) => !remove.has(`${item.actionId}:${item.dependsOnActionId}`),
        ),
        mutation.dependencyUpserts ?? [],
        (item) => `${item.actionId}:${item.dependsOnActionId}`,
      ),
    };
    return this.state;
  }
}
function merge<T>(
  current: readonly T[],
  updates: readonly T[],
  key: (item: T) => string,
) {
  const values = new Map(current.map((item) => [key(item), item]));
  for (const item of updates) values.set(key(item), item);
  return [...values.values()];
}
const allow: ExecuteControlAuthorization = {
  canWork: async () => true,
  canReview: async () => true,
  canManage: async () => true,
  canAccessDependency: async () => true,
};
function setup(repository = new MemoryRepository()) {
  let id = 0;
  return {
    repository,
    service: new ExecuteControlsService({
      repository,
      authorization: allow,
      createId: () => `generated-${++id}`,
    }),
  };
}
function context(version: number, who: ActionActor = actor) {
  return {
    workspaceId: "workspace-1",
    actionId: "action-1",
    expectedVersion: version,
    actor: who,
    occurredAt: new Date(at.getTime() + version * 1000),
    correlationId: `command-${version}`,
  };
}

describe("EX-001B2 execution controls", () => {
  it("starts work and writes action, activity, and notification atomically", async () => {
    const { service, repository } = setup();
    const result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "start",
    });
    expect(result.ok && result.value.action.status).toBe("in-progress");
    expect(repository.commits[0]?.activity[0]?.eventType).toBe("action-start");
    expect(repository.commits[0]?.notifications).toHaveLength(1);
  });
  it("records blockers, requires explicit resolution and resume, and preserves history", async () => {
    const { service, repository } = setup();
    let result = await service.addBlocker({
      ...context(repository.state.action.version.value),
      blocker: {
        category: "awaiting-vendor",
        description: "Vendor confirmation",
        severity: "high",
      },
    });
    expect(result.ok && result.value.action.status).toBe("blocked");
    result = await service.resume(
      context(repository.state.action.version.value),
    );
    expect(result.ok).toBe(false);
    const blocker = repository.state.blockers[0]!;
    result = await service.resolveBlocker({
      ...context(repository.state.action.version.value),
      blockerId: blocker.id,
      resolutionNote: "Confirmed",
    });
    expect(result.ok && result.value.action.status).toBe("blocked");
    result = await service.resume(
      context(repository.state.action.version.value),
    );
    expect(result.ok && result.value.action.status).toBe("in-progress");
    expect(repository.state.blockers[0]?.resolutionNote).toBe("Confirmed");
  });
  it("enforces evidence submission, review, and completion", async () => {
    const repository = new MemoryRepository(ready(), {
      mode: "specific",
      requiredTypes: ["photo"],
      minimumPhotoCount: 1,
      reviewRequired: true,
    });
    const { service } = setup(repository);
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "start",
    });
    let result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(!result.ok && result.code).toBe("EVIDENCE_REQUIREMENT_UNMET");
    result = await service.attachEvidence({
      ...context(repository.state.action.version.value),
      evidence: {
        type: "photo",
        caption: "After",
        storageReference: "workspace-1/action-1/photo.jpg",
      },
    });
    expect(result.ok).toBe(true);
    const evidence = repository.state.evidence[0]!;
    await service.submitEvidence({
      ...context(repository.state.action.version.value),
      evidenceIds: [evidence.id],
    });
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "submit-for-review",
    });
    result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(!result.ok && result.code).toBe("EVIDENCE_REVIEW_REQUIRED");
    await service.reviewEvidence({
      ...context(repository.state.action.version.value, reviewer),
      evidenceId: evidence.id,
      accepted: true,
    });
    result = await service.transition({
      ...context(repository.state.action.version.value, reviewer),
      operation: "complete",
    });
    expect(result.ok && result.value.action.status).toBe("completed");
  });
  it("requires rejection reasons and preserves rejected evidence", async () => {
    const { service, repository } = setup();
    await service.attachEvidence({
      ...context(repository.state.action.version.value),
      evidence: {
        type: "document",
        referenceUrl: "https://example.test/document",
      },
    });
    const evidence = repository.state.evidence[0]!;
    await service.submitEvidence({
      ...context(repository.state.action.version.value),
      evidenceIds: [evidence.id],
    });
    let result = await service.reviewEvidence({
      ...context(repository.state.action.version.value, reviewer),
      evidenceId: evidence.id,
      accepted: false,
    });
    expect(result.ok).toBe(false);
    result = await service.reviewEvidence({
      ...context(repository.state.action.version.value, reviewer),
      evidenceId: evidence.id,
      accepted: false,
      reason: "Unreadable",
    });
    expect(result.ok && result.value.evidence[0]?.status).toBe("rejected");
    expect(repository.state.evidence[0]?.rejectionReason).toBe("Unreadable");
  });
  it("prevents completion until every checklist criterion is evidenced", async () => {
    const repository = new MemoryRepository();
    repository.state = {
      ...repository.state,
      completionCriteria: ["Lock tested", "Photo captured"],
    };
    const { service } = setup(repository);
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "start",
    });
    await service.attachEvidence({
      ...context(repository.state.action.version.value),
      evidence: {
        type: "checklist",
        checklist: { "Lock tested": true, "Photo captured": false },
      },
    });
    let result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(!result.ok && result.code).toBe("EVIDENCE_REQUIREMENT_UNMET");
    await service.attachEvidence({
      ...context(repository.state.action.version.value),
      evidence: {
        type: "checklist",
        checklist: { "Lock tested": true, "Photo captured": true },
      },
    });
    result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(result.ok && result.value.action.status).toBe("completed");
  });
  it("prevents dependency cycles and completion until dependency is resolved or overridden", async () => {
    const dependency = ready("action-2");
    const repository = new MemoryRepository(ready(), { mode: "optional" }, [
      ready(),
      dependency,
    ]);
    const { service } = setup(repository);
    await service.addDependency({
      ...context(repository.state.action.version.value),
      dependsOnActionId: "action-2",
    });
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "start",
    });
    let result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(!result.ok && result.code).toBe("ACTION_DEPENDENCY_UNRESOLVED");
    result = await service.overrideDependency({
      ...context(repository.state.action.version.value),
      dependsOnActionId: "action-2",
      reason: "Authorized operational exception",
    });
    expect(result.ok).toBe(true);
    result = await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    expect(result.ok && result.value.action.status).toBe("completed");
    const cyclic: ActionDependency = {
      workspaceId: "workspace-1",
      actionId: "action-2",
      dependsOnActionId: "action-1",
      createdById: actor.id,
      createdAt: at,
    };
    repository.state = { ...repository.state, dependencies: [cyclic] };
    result = await service.addDependency({
      ...context(repository.state.action.version.value),
      dependsOnActionId: "action-2",
    });
    expect(!result.ok && result.code).toBe("DEPENDENCY_CYCLE_DETECTED");
  });
  it("preserves failed/reopened history and reports optimistic conflicts", async () => {
    const { service, repository } = setup();
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "start",
    });
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "fail",
      reason: "Vendor no-show",
    });
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "retry",
      reason: "Vendor rescheduled",
    });
    await service.transition({
      ...context(repository.state.action.version.value),
      operation: "complete",
    });
    const completedVersion = repository.state.action.version.value;
    await service.transition({
      ...context(completedVersion),
      operation: "reopen",
      reason: "Inspection failed",
    });
    expect(repository.state.action.status).toBe("in-progress");
    expect(
      repository.state.action.history.map((item) => item.operation),
    ).toEqual(
      expect.arrayContaining(["failed", "retried", "completed", "reopened"]),
    );
    const conflict = await service.transition({
      ...context(completedVersion),
      operation: "complete",
    });
    expect(!conflict.ok && conflict.code).toBe("ACTION_VERSION_CONFLICT");
    expect(repository.commits.at(-1)?.activity[0]?.eventType).toBe(
      "action-reopen",
    );
  });
});

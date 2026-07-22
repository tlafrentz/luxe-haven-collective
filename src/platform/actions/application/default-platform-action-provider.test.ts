import { describe, expect, it, vi } from "vitest";
import { ActionVersion, PlatformAction, PlatformActionCollection, createActionAssignmentId, createActionId, createWorkspaceId, type ActionId } from "../domain";
import type { PlatformActionQuery, PlatformActionRepository } from ".";
import { DefaultPlatformActionProvider, PlatformActionNotFound, PlatformActionPersistenceFailure, PlatformActionWorkspaceMismatch, StalePlatformActionVersion } from ".";

const actor = { type: "user", id: "operator-1" } as const;
const workspaceId = createWorkspaceId("workspace-1");
const baseTime = new Date("2026-07-20T12:00:00.000Z");

class MemoryActionRepository implements PlatformActionRepository {
  public readonly findByIdCalls: Array<Readonly<{ workspaceId: typeof workspaceId; actionId: ActionId }>> = [];
  public readonly findCalls: PlatformActionQuery[] = [];
  public readonly addCalls: PlatformAction[] = [];
  public readonly replaceCalls: Array<Readonly<{ action: PlatformAction; expectedVersion: ActionVersion }>> = [];
  public current: PlatformAction | null = null;
  public addFailure?: Error;
  public replaceFailure?: Error;
  public async findById(input: Readonly<{ workspaceId: typeof workspaceId; actionId: ActionId }>): Promise<PlatformAction | null> { this.findByIdCalls.push(input); return this.current?.workspaceId.equals(input.workspaceId) && this.current.id.equals(input.actionId) ? this.current : null; }
  public async find(input: PlatformActionQuery): Promise<PlatformActionCollection> { this.findCalls.push(input); return this.current?.workspaceId.equals(input.workspaceId) ? PlatformActionCollection.create([this.current]) : PlatformActionCollection.empty(); }
  public async add(input: Readonly<{ action: PlatformAction }>): Promise<void> { this.addCalls.push(input.action); if (this.addFailure) throw this.addFailure; this.current = input.action; }
  public async replace(input: Readonly<{ action: PlatformAction; expectedVersion: ActionVersion }>): Promise<void> { this.replaceCalls.push(input); if (this.replaceFailure) throw this.replaceFailure; this.current = input.action; }
}

function setup(repository = new MemoryActionRepository()) {
  const createId = vi.fn(() => createActionId("generated-action"));
  const createAssignment = vi.fn(() => createActionAssignmentId("generated-assignment"));
  const now = vi.fn(() => new Date("2026-07-20T13:00:00.000Z"));
  return { repository, createId, createAssignment, now, provider: new DefaultPlatformActionProvider({ repository, createActionId: createId, createAssignmentId: createAssignment, now }) };
}

function createCommand(overrides: Partial<Parameters<DefaultPlatformActionProvider["createDraft"]>[0]> = {}) {
  return { workspaceId, title: "Canonical action", priority: "high" as const, owner: actor, sources: [{ type: "manual" as const, recordedAt: baseTime, recordedBy: actor }], actor, occurredAt: baseTime, commandId: "create-1", ...overrides };
}

function existing(action: PlatformAction) {
  return { workspaceId, actionId: action.id, expectedVersion: action.version, actor, occurredAt: new Date(action.updatedAt.getTime() + 60_000), commandId: `command-${action.version.value}` };
}

describe("DefaultPlatformActionProvider creation and queries", () => {
  it("creates and persists canonical draft and committed aggregates with injected IDs", async () => {
    for (const method of ["createDraft", "createCommitted"] as const) {
      const { provider, repository, createId } = setup();
      const action = await provider[method](createCommand());
      expect(action).toBe(repository.addCalls[0]);
      expect(action.id.value).toBe("generated-action");
      expect(action.status).toBe(method === "createDraft" ? "draft" : "committed");
      expect(action.history[0]?.commandId).toBe("create-1");
      expect(createId).toHaveBeenCalledOnce();
    }
  });

  it("uses an explicit command ID without invoking the ID factory and propagates duplicate persistence failures", async () => {
    const repository = new MemoryActionRepository(); repository.addFailure = new PlatformActionPersistenceFailure("duplicate", { metadata: { databaseCode: "23505" } });
    const { provider, createId } = setup(repository);
    await expect(provider.createDraft(createCommand({ actionId: createActionId("explicit") }))).rejects.toBe(repository.addFailure);
    expect(createId).not.toHaveBeenCalled();
  });

  it("uses the injected clock as the runtime fallback", async () => {
    const { provider, now } = setup();
    const command = { ...createCommand(), occurredAt: undefined } as unknown as Parameters<typeof provider.createDraft>[0];
    const action = await provider.createDraft(command);
    expect(action.createdAt).toEqual(new Date("2026-07-20T13:00:00.000Z"));
    expect(now).toHaveBeenCalledOnce();
  });

  it("forwards scoped canonical queries without enriching results", async () => {
    const { provider, repository } = setup(); const action = await provider.createDraft(createCommand());
    const found = await provider.findById({ workspaceId, actionId: action.id });
    const query = { workspaceId, statuses: ["draft"] as const, sourceType: "manual" as const, dueBefore: new Date("2026-08-01") };
    const collection = await provider.find(query);
    expect(repository.findByIdCalls[0]).toEqual({ workspaceId, actionId: action.id });
    expect(repository.findCalls[0]).toBe(query);
    expect(found).toBe(action); expect(collection.all()[0]).toBe(action); expect(Object.isFrozen(collection)).toBe(true);
  });
});

describe("DefaultPlatformActionProvider mutations", () => {
  it("coordinates every operation through one scoped replace with the expected version", async () => {
    const { provider, repository, createAssignment } = setup();
    let action = await provider.createDraft(createCommand());
    const apply = async (run: (command: ReturnType<typeof existing>) => Promise<PlatformAction>) => {
      const before = action, command = existing(before), writes = repository.replaceCalls.length;
      action = await run(command);
      expect(repository.findByIdCalls.at(-1)).toEqual({ workspaceId, actionId: before.id });
      expect(repository.replaceCalls).toHaveLength(writes + 1);
      expect(repository.replaceCalls.at(-1)?.expectedVersion).toBe(command.expectedVersion);
      expect(repository.replaceCalls.at(-1)?.action).toBe(action);
    };
    await apply((command) => provider.commit(command));
    await apply((command) => provider.assign({ ...command, assigneeType: "team", assigneeId: "team-1", queue: "operations" }));
    expect(action.activeAssignment?.id.value).toBe("generated-assignment"); expect(createAssignment).toHaveBeenCalledOnce();
    await apply((command) => provider.releaseAssignment(command));
    await apply((command) => provider.assign({ ...command, assigneeType: "team", assigneeId: "team-1", queue: "operations", assignmentId: createActionId("command-assignment") }));
    await apply((command) => provider.claim({ ...command, assigneeType: "user", assigneeId: "operator-1" }));
    await apply((command) => provider.schedule({ ...command, due: new Date("2026-08-01") }));
    await apply((command) => provider.markReady(command));
    await apply((command) => provider.start(command));
    await apply((command) => provider.block(command));
    await apply((command) => provider.unblock({ ...command, resumeTo: "in-progress" }));
    await apply((command) => provider.changePriority({ ...command, priority: "critical" }));
    await apply((command) => provider.changeOwner({ ...command, owner: { type: "team", id: "team-2" } }));
    await apply((command) => provider.linkOutcome({ ...command, outcomeId: createActionId("outcome-1"), linkType: "result" }));
    await apply((command) => provider.complete(command));
    await apply((command) => provider.archive(command));
    expect(action.status).toBe("archived");

    const cancelSetup = setup(); let cancelled = await cancelSetup.provider.createCommitted(createCommand());
    cancelled = await cancelSetup.provider.cancel(existing(cancelled));
    expect(cancelled.status).toBe("cancelled"); expect(cancelSetup.repository.replaceCalls).toHaveLength(1);
  });

  it("does not persist domain failures", async () => {
    const { provider, repository } = setup(); const action = await provider.createDraft(createCommand());
    await expect(provider.start(existing(action))).rejects.toThrow();
    expect(repository.replaceCalls).toHaveLength(0);
  });

  it("returns typed not-found, workspace-mismatch, and early stale-version failures", async () => {
    const missing = setup(); const id = createActionId("missing");
    await expect(missing.provider.commit({ workspaceId, actionId: id, expectedVersion: ActionVersion.initial(), actor, occurredAt: baseTime })).rejects.toBeInstanceOf(PlatformActionNotFound);

    const mismatchRepository = new MemoryActionRepository();
    const wrongWorkspace = createWorkspaceId("workspace-2");
    mismatchRepository.current = PlatformAction.createDraft({ ...createCommand(), id, createdAt: baseTime, createdBy: actor, workspaceId: wrongWorkspace });
    mismatchRepository.findById = async (input) => { mismatchRepository.findByIdCalls.push(input); return mismatchRepository.current; };
    await expect(setup(mismatchRepository).provider.commit({ workspaceId, actionId: id, expectedVersion: ActionVersion.initial(), actor, occurredAt: baseTime })).rejects.toBeInstanceOf(PlatformActionWorkspaceMismatch);
    expect(mismatchRepository.replaceCalls).toHaveLength(0);

    const stale = setup(); const action = await stale.provider.createDraft(createCommand());
    await expect(stale.provider.commit({ ...existing(action), expectedVersion: action.version.next() })).rejects.toBeInstanceOf(StalePlatformActionVersion);
    expect(stale.repository.replaceCalls).toHaveLength(0);
  });

  it("propagates repository concurrency failures from the atomic replace", async () => {
    const repository = new MemoryActionRepository(); const { provider } = setup(repository); const action = await provider.createDraft(createCommand());
    repository.replaceFailure = new StalePlatformActionVersion(action.id.value, action.version.value);
    await expect(provider.commit(existing(action))).rejects.toBe(repository.replaceFailure);
    expect(repository.replaceCalls).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { createActionId, createWorkspaceId } from "../../domain";
import type { PlatformActionPersistenceRows } from "./action-persistence-rows";
import { StalePlatformActionVersion } from "./action-persistence-errors";
import { SupabasePlatformActionRepository, type PlatformActionRpcClient, type SupabaseRpcError } from "./supabase-platform-action-repository";
import { persistedAction } from "./action-persistence-test-support";

class TransactionalActionRpcClient implements PlatformActionRpcClient {
  private readonly rows = new Map<string, PlatformActionPersistenceRows>();
  public async rpc(name: string, parameters: Readonly<Record<string, unknown>>): Promise<Readonly<{ data: unknown; error: SupabaseRpcError | null }>> {
    if (name === "platform_action_add") {
      const payload = clone(parameters.p_payload as PlatformActionPersistenceRows), key = this.key(payload.action.workspace_id, payload.action.id);
      if (this.rows.has(key)) return failure("23505", "duplicate Platform Action"); this.rows.set(key, payload); return success(null);
    }
    if (name === "platform_action_replace") {
      const payload = clone(parameters.p_payload as PlatformActionPersistenceRows), expected = parameters.p_expected_version as number, key = this.key(payload.action.workspace_id, payload.action.id), current = this.rows.get(key);
      if (!current || current.action.version !== expected || payload.action.version !== expected + 1) return failure("40001", "Stale Platform Action version");
      if (JSON.stringify(current.sources) !== JSON.stringify(payload.sources)) return failure("P0001", "Platform Action provenance cannot be rewritten");
      this.rows.set(key, payload); return success(null);
    }
    if (name === "platform_action_find_by_id") return success(cloneOrNull(this.rows.get(this.key(parameters.p_workspace_id as string, parameters.p_action_id as string))));
    if (name === "platform_action_find") {
      const workspace = parameters.p_workspace_id as string, query = parameters.p_query as Record<string, unknown>;
      const matches = [...this.rows.values()].filter((value) => value.action.workspace_id === workspace).filter((value) => !query.statuses || (query.statuses as string[]).includes(value.action.status));
      return success(clone(matches));
    }
    return failure("42883", `Unknown RPC ${name}`);
  }
  private key(workspace: string, action: string): string { return `${workspace}:${action}`; }
}

describe("SupabasePlatformActionRepository integration contract", () => {
  it("round-trips assignments, provenance, history, schedule, and Outcome references", async () => {
    const repository = new SupabasePlatformActionRepository(new TransactionalActionRpcClient()), action = persistedAction();
    await repository.add({ action }); const restored = await repository.findById({ workspaceId: action.workspaceId, actionId: action.id });
    expect(restored?.assignments).toHaveLength(1); expect(restored?.sources).toHaveLength(2); expect(restored?.history).toHaveLength(action.history.length); expect(restored?.outcomeReferences).toHaveLength(1); expect(restored?.scheduleValue.due).toEqual(action.scheduleValue.due);
  });
  it("scopes Action IDs and queries to the requested workspace", async () => {
    const repository = new SupabasePlatformActionRepository(new TransactionalActionRpcClient()), first = persistedAction("workspace-1", "shared-id"), second = persistedAction("workspace-2", "shared-id");
    await repository.add({ action: first }); await repository.add({ action: second });
    expect((await repository.findById({ workspaceId: first.workspaceId, actionId: first.id }))?.workspaceId.value).toBe("workspace-1");
    expect((await repository.find({ workspaceId: createWorkspaceId("workspace-2") })).all().map((value) => value.workspaceId.value)).toEqual(["workspace-2"]);
    expect(await repository.findById({ workspaceId: createWorkspaceId("workspace-3"), actionId: createActionId("shared-id") })).toBeNull();
  });
  it("replaces exactly one version and rejects stale writers explicitly", async () => {
    const repository = new SupabasePlatformActionRepository(new TransactionalActionRpcClient()), original = persistedAction(); await repository.add({ action: original });
    const changed = original.changePriority({ workspaceId: original.workspaceId, expectedVersion: original.version, actor: { type: "user", id: "operator-1" }, occurredAt: new Date("2026-07-20T11:00:00.000Z"), priority: "critical" });
    await repository.replace({ action: changed, expectedVersion: original.version });
    expect((await repository.findById({ workspaceId: changed.workspaceId, actionId: changed.id }))?.version.value).toBe(original.version.value + 1);
    await expect(repository.replace({ action: changed, expectedVersion: original.version })).rejects.toBeInstanceOf(StalePlatformActionVersion);
  });
  it("filters queries without accepting unscoped access", async () => {
    const repository = new SupabasePlatformActionRepository(new TransactionalActionRpcClient()), completed = persistedAction(), draft = persistedAction("workspace-1", "draft-action").archive({ workspaceId: createWorkspaceId("workspace-1"), expectedVersion: persistedAction("workspace-1", "draft-action").version, actor: { type: "user", id: "operator-1" }, occurredAt: new Date("2026-07-20T11:00:00.000Z") });
    await repository.add({ action: completed }); await repository.add({ action: draft });
    expect((await repository.find({ workspaceId: completed.workspaceId, statuses: ["completed"] })).all().map((value) => value.id.value)).toEqual(["action-1"]);
  });
});

function success(data: unknown): Readonly<{ data: unknown; error: null }> { return { data, error: null }; }
function failure(code: string, message: string): Readonly<{ data: null; error: SupabaseRpcError }> { return { data: null, error: { code, message } }; }
function clone<T>(value: T): T { return structuredClone(value); }
function cloneOrNull<T>(value: T | undefined): T | null { return value === undefined ? null : clone(value); }

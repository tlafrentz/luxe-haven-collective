import { describe, expect, it } from "vitest";
import type { ExecuteActivityEvent } from "../../application/execute-application";
import type { PlatformActionRepository } from "../../application/action-repository";
import { ActionPlan } from "../../domain";
import { persistedAction } from "./action-persistence-test-support";
import { SupabaseExecuteActivityRepository, SupabaseExecutePlanRepository, SupabaseExecuteUnitOfWork, type ExecuteSupabaseClient } from "./supabase-execute-application";

type Result = Readonly<{ data: unknown; error: Readonly<{ code?: string; message: string }> | null }>;

class Builder implements PromiseLike<Result> {
  private filters: Array<readonly [string, unknown]> = [];
  public constructor(private readonly rows: readonly Readonly<Record<string, unknown>>[]) {}
  public select(): Builder { return this; }
  public eq(column: string, value: unknown): Builder { this.filters.push([column, value]); return this; }
  public order(): Builder { return this; }
  public limit(): Builder { return this; }
  public then<TResult1 = Result, TResult2 = never>(fulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    const data = this.rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
    return Promise.resolve({ data, error: null }).then(fulfilled, rejected);
  }
}

class Client implements ExecuteSupabaseClient {
  public readonly calls: Array<Readonly<{ name: string; args: Readonly<Record<string, unknown>> }>> = [];
  public error: Readonly<{ code?: string; message: string }> | null = null;
  public constructor(public rows: Record<string, readonly Readonly<Record<string, unknown>>[]> = {}) {}
  public from(table: string): Builder { return new Builder(this.rows[table] ?? []); }
  public async rpc(name: string, args: Readonly<Record<string, unknown>>): Promise<Result> { this.calls.push({ name, args }); return { data: null, error: this.error }; }
}

const actor = { type: "user", id: "operator-1" } as const;
const now = new Date("2026-08-09T12:00:00.000Z");
const draft = () => ActionPlan.createDraft({ id: "plan-1", workspaceId: "workspace-1", title: "Improve arrival", origin: { type: "manual" }, scope: { type: "property", propertyIds: ["11111111-1111-4111-8111-111111111111"] }, owner: actor, priority: "high", successMetrics: [], actions: [{ id: "draft-1", position: 0, title: "Replace lock", owner: actor, dueAt: new Date("2026-08-12T12:00:00.000Z") }], createdBy: actor, createdAt: now });

describe("Supabase Execute application persistence", () => {
  it("persists a draft plan, Draft Actions, and activity through one RPC", async () => {
    const client = new Client(), plans = new SupabaseExecutePlanRepository(client), activity = new SupabaseExecuteActivityRepository(client);
    const unit = new SupabaseExecuteUnitOfWork({ client, plans, actions: emptyActions(), activity });
    await unit.execute(async (context) => {
      await context.plans.add(draft());
      await context.activity.append([event("plan-created")]);
    });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.name).toBe("save_execute_action_plan");
    expect(client.calls[0]?.args.p_draft_actions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "draft-1", position: 0 })]));
    expect(client.calls[0]?.args.p_activity_events).toEqual(expect.arrayContaining([expect.objectContaining({ event_type: "plan-created" })]));
  });

  it("uses the atomic activation RPC for canonical Actions, activity, and outbox", async () => {
    const client = new Client(), plans = new SupabaseExecutePlanRepository(client), activity = new SupabaseExecuteActivityRepository(client);
    const unit = new SupabaseExecuteUnitOfWork({ client, plans, actions: emptyActions(), activity });
    const active = draft().activate({ actor, occurredAt: now });
    await unit.execute(async (context) => {
      await context.plans.replace(active, 1);
      await context.actions.add({ action: persistedAction() });
      await context.activity.append([event("plan-activated")]);
      await context.notifications.add([{ id: "notice-1", workspaceId: "workspace-1", recipientType: "user", recipientId: "operator-1", eventType: "new-assignment", entityType: "action", entityId: "action-1", templateVariables: { title: "Action" }, channel: "in-app", status: "pending", idempotencyKey: "assignment:action-1", attemptCount: 0, createdAt: now }]);
    });
    expect(client.calls[0]?.name).toBe("activate_execute_action_plan");
    expect(client.calls[0]?.args.p_action_payloads).toHaveLength(1);
    expect(client.calls[0]?.args.p_notification_intents).toHaveLength(1);
  });

  it("translates a database race into a version conflict with the authorized current version", async () => {
    const current = planRow(4), client = new Client({ platform_action_plans: [current], platform_action_plan_draft_actions: [] });
    client.error = { code: "40001", message: "version conflict" };
    const plans = new SupabaseExecutePlanRepository(client), activity = new SupabaseExecuteActivityRepository(client);
    const unit = new SupabaseExecuteUnitOfWork({ client, plans, actions: emptyActions(), activity });
    await expect(unit.execute(async (context) => context.plans.replace(draft().updateDraft({ expectedVersion: 1, title: "Changed" }), 1))).rejects.toMatchObject({ name: "ExecutePersistenceConflict", currentVersion: 4 });
  });
});

function event(eventType: string): ExecuteActivityEvent { return { id: `event-${eventType}`, workspaceId: "workspace-1", entityType: "plan", entityId: "plan-1", eventType, actor, occurredAt: now, metadata: {}, correlationId: "correlation-1" }; }
function emptyActions(): PlatformActionRepository { return { findById: async () => null, find: async () => { throw new Error("unused"); }, add: async () => undefined, replace: async () => undefined }; }
function planRow(version: number): Readonly<Record<string, unknown>> { return { workspace_id: "workspace-1", id: "plan-1", title: "Current", description: null, origin_type: "manual", origin_id: null, source_capability: null, decision_id: null, scope_type: "organization", property_ids: [], owner_type: "user", owner_id: "operator-1", status: "draft", priority: "high", start_at: null, target_completion_at: null, expected_outcome: null, success_metrics: [], source_context: {}, created_by_type: "user", created_by_id: "operator-1", activated_by_id: null, activated_at: null, completed_at: null, cancelled_at: null, created_at: now.toISOString(), updated_at: now.toISOString(), version }; }

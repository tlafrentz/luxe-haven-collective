import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: false,
  workspacePermission: false,
  propertyAllowed: false,
  entitled: true,
  capabilityAvailable: true,
  rateLimitCount: 0,
  jobRows: new Map<string, Record<string, unknown>>(),
  createCreationJobCalls: [] as unknown[],
  reviewCreationFactCalls: [] as unknown[],
  cancelCreationJobCalls: [] as unknown[],
  enqueueCreationWorkCalls: [] as unknown[],
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({ user: state.authenticated ? { id: "actor-a" } : null }),
}));

vi.mock("@/features/workspace", () => ({
  evaluateWorkspacePermission: () => state.workspacePermission,
  evaluatePropertyAccess: () => state.propertyAllowed,
  resolveWorkspaceAccessContext: async () => ({ workspaceId: "workspace-a", role: "owner" }),
  SupabaseTeamAccessRepository: class {},
}));

function queryBuilder(resolve: () => { data?: unknown; count?: number; error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order"]) builder[method] = () => builder;
  builder.maybeSingle = async () => resolve();
  builder.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled);
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "guidebook_creation_jobs")
        return queryBuilder(() => ({ data: state.jobRows.get("job-a") ?? null, count: state.rateLimitCount, error: null }));
      return queryBuilder(() => ({ data: [], count: state.rateLimitCount, error: null }));
    },
    storage: { from: () => ({}) },
  }),
}));

vi.mock("@/features/guidebook-creation-assistant/application", () => ({
  createCreationJob: async (_deps: unknown, ctx: unknown, input: unknown) => {
    state.createCreationJobCalls.push({ ctx, input });
    return { job: { id: "job-a" }, duplicate: false };
  },
  reviewCreationFact: async (_deps: unknown, ctx: unknown, input: unknown) => {
    state.reviewCreationFactCalls.push({ ctx, input });
    return { ready: true };
  },
  cancelCreationJob: async (_deps: unknown, ctx: unknown, jobId: string) => {
    state.cancelCreationJobCalls.push({ ctx, jobId });
    return { id: jobId, state: "cancelled" };
  },
  uploadCreationSource: async () => ({ source: { id: "source-a" }, duplicate: false }),
}));

vi.mock("@/features/guidebook-creation-assistant/runtime", () => ({
  creationDependencies: () => ({}),
  enqueueCreationWork: async (input: unknown) => {
    state.enqueueCreationWorkCalls.push(input);
    return { id: "work-a", status: "queued" };
  },
  hasCreationEntitlement: async () => state.entitled,
  readCustomerCreationCapability: async () => ({ available: state.capabilityAvailable, reasons: state.capabilityAvailable ? [] : ["entitled"] }),
}));

import {
  cancelCustomerCreationJobAction,
  createCustomerCreationJobAction,
  enqueueCustomerExtractionAction,
  enqueueCustomerGenerationAction,
  getCustomerCreationProjectionAction,
  reviewCustomerCreationFactAction,
} from "./guidebook-ai-creation";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const FACT_ID = "44444444-4444-4444-8444-444444444444";

describe("customer AI creation-assistant transport authorization", () => {
  beforeEach(() => {
    state.authenticated = false;
    state.workspacePermission = false;
    state.propertyAllowed = false;
    state.entitled = true;
    state.capabilityAvailable = true;
    state.rateLimitCount = 0;
    state.jobRows.clear();
    state.createCreationJobCalls.length = 0;
    state.reviewCreationFactCalls.length = 0;
    state.cancelCreationJobCalls.length = 0;
    state.enqueueCreationWorkCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("rejects an unauthenticated caller creating a job", async () => {
    await expect(
      createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toMatchObject({ message: "unauthorized" });
    expect(state.createCreationJobCalls).toHaveLength(0);
  });

  it("rejects a caller without workspace manage permission", async () => {
    state.authenticated = true;
    state.workspacePermission = false;
    state.propertyAllowed = true;
    await expect(
      createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toMatchObject({ message: "unauthorized" });
    expect(state.createCreationJobCalls).toHaveLength(0);
  });

  it("rejects a caller without access to the specific property", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = false;
    await expect(
      createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toMatchObject({ message: "unauthorized" });
    expect(state.createCreationJobCalls).toHaveLength(0);
  });

  it("rejects job creation when the workspace is not entitled or infra is unavailable", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    state.capabilityAvailable = false;
    await expect(
      createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toThrow("CREATION_ASSISTANT_NOT_AVAILABLE");
    expect(state.createCreationJobCalls).toHaveLength(0);
  });

  it("rejects job creation once the per-workspace daily rate limit is hit", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    state.rateLimitCount = 5;
    await expect(
      createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toThrow("CREATION_RATE_LIMIT_EXCEEDED");
    expect(state.createCreationJobCalls).toHaveLength(0);
  });

  it("allows an authorized, entitled, under-limit caller to create a job", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    const result = await createCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, templateVersionId: WORKSPACE_ID, idempotencyKey: "idempotency-key-1" });
    expect(result).toEqual({ jobId: "job-a" });
    expect(state.createCreationJobCalls).toHaveLength(1);
    expect(state.createCreationJobCalls[0]).toMatchObject({ ctx: { workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, actorId: "actor-a" } });
  });

  it("rejects fact review and job cancellation for an unauthorized caller", async () => {
    for (const call of [
      reviewCustomerCreationFactAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID, factId: FACT_ID, status: "confirmed" as const, confirmHighRisk: false }),
      cancelCustomerCreationJobAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID }),
      enqueueCustomerExtractionAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID, idempotencyKey: "idempotency-key-1" }),
      enqueueCustomerGenerationAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID, idempotencyKey: "idempotency-key-1", title: "Guide" }),
    ])
      await expect(call).rejects.toMatchObject({ message: "unauthorized" });
    expect(state.reviewCreationFactCalls).toHaveLength(0);
    expect(state.cancelCreationJobCalls).toHaveLength(0);
    expect(state.enqueueCreationWorkCalls).toHaveLength(0);
  });

  it("scopes the projection read to the caller's own workspace and property", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    state.jobRows.set("job-a", { id: JOB_ID, state: "awaiting_review" });
    const result = await getCustomerCreationProjectionAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID });
    expect(result?.job).toMatchObject({ id: JOB_ID });
  });

  it("returns nothing for a job that does not belong to the authorized workspace/property", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    const result = await getCustomerCreationProjectionAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: "does-not-exist" });
    expect(result).toBeNull();
  });

  it("enforces separate rate-limit ceilings for extraction and generation enqueue", async () => {
    state.authenticated = true;
    state.workspacePermission = true;
    state.propertyAllowed = true;
    state.rateLimitCount = 15;
    await expect(
      enqueueCustomerExtractionAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID, idempotencyKey: "idempotency-key-1" }),
    ).rejects.toThrow("CREATION_RATE_LIMIT_EXCEEDED");
    await expect(
      enqueueCustomerGenerationAction({ workspaceId: WORKSPACE_ID, propertyId: PROPERTY_ID, jobId: JOB_ID, idempotencyKey: "idempotency-key-1", title: "Guide" }),
    ).rejects.toThrow("CREATION_RATE_LIMIT_EXCEEDED");
    expect(state.enqueueCreationWorkCalls).toHaveLength(0);
  });
});

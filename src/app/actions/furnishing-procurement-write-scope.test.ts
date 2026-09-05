import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "20000000-0000-4000-8000-000000000002";
const BASELINE_ID = "30000000-0000-4000-8000-000000000003";
const BATCH_ID = "40000000-0000-4000-8000-000000000004";
const LINE_ID = "50000000-0000-4000-8000-000000000005";
const ACTOR_ID = "actor-1";

const state = vi.hoisted(() => ({
  profileRole: "user" as string,
  membershipRole: "owner" as string,
  targetId: "" as string,
  release: {
    global_state: "internal" as string,
    global_kill_switch: false,
    configuration_valid: true,
  },
  workspace: {
    enabled: true,
    kill_switch: false,
    cohort: "internal" as string,
    expires_at: null as string | null,
    revoked_at: null as string | null,
  },
  capability: { enabled: true },
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    is: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
  };
  return builder;
}

function membershipChain() {
  let restricted: string[] | null = null;
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    in: (_column: string, roles: string[]) => {
      restricted = roles;
      return builder;
    },
    maybeSingle: async () => {
      if (restricted && !restricted.includes(state.membershipRole)) {
        return { data: null, error: null };
      }
      return { data: { role: state.membershipRole }, error: null };
    },
  };
  return builder;
}

function makeDb() {
  return {
    from(table: string) {
      switch (table) {
        case "workspace_memberships":
          return membershipChain();
        case "furnishing_projects":
          return chain({
            data: { id: PROJECT_ID, workspace_id: WORKSPACE_ID, properties: {} },
            error: null,
          });
        case "furnishing_activation_releases":
          return chain({ data: state.release, error: null });
        case "furnishing_activation_workspaces":
          return chain({ data: state.workspace, error: null });
        case "furnishing_activation_capabilities":
          return chain({ data: state.capability, error: null });
        case "furnishing_procurement_baselines":
          return chain({
            data: { project_id: PROJECT_ID, version: 1 },
            error: null,
          });
        case "furnishing_purchase_batches":
          return chain({
            data: { id: BATCH_ID, baseline_id: BASELINE_ID, version: 1 },
            error: null,
          });
        case "furnishing_procurement_lines":
          return chain({
            data: { id: LINE_ID, baseline_id: BASELINE_ID, revision: 1 },
            error: null,
          });
        default:
          return chain({ data: null, error: null });
      }
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({
    user: { id: ACTOR_ID },
    profile: { id: ACTOR_ID, role: state.profileRole },
  }),
}));
vi.mock("./furnishing-access", () => ({
  assertFurnishingEntitlement: async () => {},
}));
vi.mock("@/features/furnishing-studio/server-command-context", () => ({
  resolveFurnishingCommandContext: async () => ({
    targetId: state.targetId,
    correlationId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "test-idempotency-key-00000001",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return { data: { status: "ok", id: "result-id", version: 1 }, error: null };
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeDb(),
}));

import {
  authorizePurchaseBatchAction,
  recordExternalOrderAction,
  recordReceivingAction,
  saveProcurementBudgetAction,
  submitPurchaseBatchAction,
} from "./furnishing-procurement";

function fd(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

const cases = [
  {
    name: "submitPurchaseBatchAction",
    targetId: BASELINE_ID,
    rpc: "create_or_replay_procurement_batch",
    run: () =>
      submitPurchaseBatchAction(
        fd({ commandContextId: "cc", retailerId: "60000000-0000-4000-8000-000000000006" }),
      ),
  },
  {
    name: "authorizePurchaseBatchAction",
    targetId: BATCH_ID,
    rpc: "approve_furnishing_procurement_plan",
    run: () => authorizePurchaseBatchAction(fd({ commandContextId: "cc" })),
  },
  {
    name: "recordExternalOrderAction",
    targetId: BATCH_ID,
    rpc: "record_external_retailer_order",
    run: () =>
      recordExternalOrderAction(
        fd({ commandContextId: "cc", externalOrderId: "EXT-1", orderDate: "2026-01-01" }),
      ),
  },
  {
    name: "recordReceivingAction",
    targetId: LINE_ID,
    rpc: "record_furnishing_procurement_receipt",
    run: () =>
      recordReceivingAction(
        fd({
          commandContextId: "cc",
          receivedQuantity: "5",
          acceptedQuantity: "5",
          condition: "good",
        }),
      ),
  },
  {
    name: "saveProcurementBudgetAction",
    targetId: BASELINE_ID,
    rpc: "reconcile_furnishing_procurement_budget",
    run: () =>
      saveProcurementBudgetAction(
        fd({ commandContextId: "cc", baseAmount: "100", contingency: "10" }),
      ),
  },
];

describe("furnishing-procurement.ts write-scope authorization", () => {
  beforeEach(() => {
    state.profileRole = "user";
    state.membershipRole = "owner";
    state.release = {
      global_state: "internal",
      global_kill_switch: false,
      configuration_valid: true,
    };
    state.workspace = {
      enabled: true,
      kill_switch: false,
      cohort: "internal",
      expires_at: null,
      revoked_at: null,
    };
    state.capability = { enabled: true };
    state.rpcCalls = [];
  });

  for (const testCase of cases) {
    it(`denies an active member without a sufficient workspace role for ${testCase.name}`, async () => {
      state.targetId = testCase.targetId;
      state.membershipRole = "viewer";
      await expect(testCase.run()).rejects.toThrow(
        "FURNISHING_PROCUREMENT_ACCESS_DENIED",
      );
      expect(state.rpcCalls).toHaveLength(0);
    });

    it.each(["owner", "administrator", "operator", "contributor"])(
      `keeps %s access working for ${testCase.name}`,
      async (role) => {
        state.targetId = testCase.targetId;
        state.membershipRole = role;
        await expect(testCase.run()).resolves.not.toThrow();
        expect(state.rpcCalls).toContainEqual(
          expect.objectContaining({ name: testCase.rpc }),
        );
      },
    );

    it(`now enforces the FS-008A emergency kill switch for ${testCase.name}`, async () => {
      state.targetId = testCase.targetId;
      state.membershipRole = "owner";
      state.release = {
        ...state.release,
        global_kill_switch: true,
      };
      await expect(testCase.run()).rejects.toThrow(
        "FURNISHING_ACTIVATION_DISABLED",
      );
      expect(state.rpcCalls).toHaveLength(0);
    });
  }
});

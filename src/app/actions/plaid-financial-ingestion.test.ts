import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  legacyAllowed: false,
  privilegeAllowed: false,
  platformRpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({
    user: state.authenticated ? { id: "actor-a" } : null,
  }),
}));
vi.mock("@/features/workspace", () => ({
  evaluateWorkspacePermission: () => state.legacyAllowed,
  resolveWorkspaceAccessContext: async () => ({
    profileId: "actor-a",
    workspaceId: "11111111-1111-4111-8111-111111111111",
  }),
  SupabaseTeamAccessRepository: class {},
}));
// A chainable Supabase query-builder stub: every method call (eq/neq/order/
// update/select/...) returns itself, and awaiting it at any point resolves
// to a benign empty result. Avoids hand-modeling every query shape these
// actions and their downstream plaid-recovery.ts helpers build.
function chainableQuery(): unknown {
  const result = { data: [], error: null };
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then")
        return (resolve: (v: unknown) => void) => resolve(result);
      if (prop === "single" || prop === "maybeSingle")
        return async () => ({ data: { status: "healthy" }, error: null });
      return () => chainableQuery();
    },
  };
  return new Proxy({}, handler);
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.platformRpcCalls.push({ name, args });
      return {
        data: [
          {
            allowed: state.privilegeAllowed,
            reason_code: state.privilegeAllowed
              ? "PA_ALLOW"
              : "PA_DENY_NO_GRANT",
            matching_assignment_ids: [],
          },
        ],
        error: null,
      };
    },
    from: () => chainableQuery(),
  }),
}));

import {
  listPlaidConnectionsAction,
  syncPlaidTransactionsAction,
} from "./plaid-financial-ingestion";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";

describe("PA-004 plaid-financial-ingestion.ts additive privilege gating", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.legacyAllowed = true;
    state.privilegeAllowed = false;
    state.platformRpcCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps today's legacy access unchanged and never calls evaluate_privilege", async () => {
    state.legacyAllowed = true;
    await expect(listPlaidConnectionsAction(WORKSPACE_ID)).resolves.toEqual(
      [],
    );
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("lets a PA-001 connect_provider grant succeed where the legacy check alone would have failed", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = true;
    const result = await listPlaidConnectionsAction(WORKSPACE_ID);
    expect(result).toEqual([]);
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "financials.connection.connect_provider",
        p_workspace_id: WORKSPACE_ID,
      }),
    });
  });

  it("lets a PA-001 manage_connections grant succeed for the sync/disconnect group", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = true;
    await syncPlaidTransactionsAction({
      workspaceId: WORKSPACE_ID,
      connectionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "financials.connection.manage_connections",
        p_workspace_id: WORKSPACE_ID,
      }),
    });
  });

  it("fails closed when both the legacy check and the PA-001 grant deny", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = false;
    await expect(listPlaidConnectionsAction(WORKSPACE_ID)).resolves.toEqual(
      [],
    );
    expect(state.platformRpcCalls).toHaveLength(1);
  });
});

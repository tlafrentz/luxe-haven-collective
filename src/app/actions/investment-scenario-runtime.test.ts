import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  contextOk: true,
  authorizeAllowed: true,
  authorizeCalls: [] as Array<{ opportunityId: string; operation: string }>,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("./investment-opportunity-runtime", () => ({
  getInvestmentOpportunityRequestContext: async () =>
    state.contextOk
      ? {
          ok: true,
          authorizeOpportunity: async (opportunityId: string, operation: string) => {
            state.authorizeCalls.push({ opportunityId, operation });
            return state.authorizeAllowed;
          },
        }
      : { ok: false },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return { data: null, error: state.rpcError };
    },
  }),
}));

import { saveScenarioComparisonSelectionAction } from "./investment-scenario-runtime";

function formData(scenarioIds = ["scenario-a", "scenario-b"]) {
  const data = new FormData();
  data.set("opportunityId", "investment-opportunity-1");
  for (const id of scenarioIds) data.append("scenarioId", id);
  return data;
}

describe("saveScenarioComparisonSelectionAction", () => {
  beforeEach(() => {
    state.contextOk = true;
    state.authorizeAllowed = true;
    state.authorizeCalls = [];
    state.rpcCalls = [];
    state.rpcError = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("checks scenario.read authorization before calling the RPC, then redirects on success", async () => {
    await expect(saveScenarioComparisonSelectionAction(formData())).rejects.toThrow(
      /REDIRECT:/,
    );
    expect(state.authorizeCalls).toEqual([
      { opportunityId: "investment-opportunity-1", operation: "scenario.read" },
    ]);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "save_scenario_comparison_session",
      args: {
        p_opportunity_id: "investment-opportunity-1",
        p_scenario_ids: ["scenario-a", "scenario-b"],
      },
    });
  });

  it("fails closed without calling the RPC when the actor is not authorized", async () => {
    state.authorizeAllowed = false;
    await expect(saveScenarioComparisonSelectionAction(formData())).rejects.toThrow(
      "scenario_permission_denied",
    );
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("fails closed without calling the RPC when unauthenticated", async () => {
    state.contextOk = false;
    await expect(saveScenarioComparisonSelectionAction(formData())).rejects.toThrow(
      "scenario_permission_denied",
    );
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.authorizeCalls).toHaveLength(0);
  });

  it("surfaces the RPC's own permission denial as a clear message", async () => {
    state.rpcError = { message: "scenario_permission_denied" };
    await expect(saveScenarioComparisonSelectionAction(formData())).rejects.toThrow(
      "You don't have permission",
    );
  });
});

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
vi.mock("./investment-scenario-runtime", () => ({
  getInvestmentScenarioWorkspaceRequest: async () => ({ ok: false, code: "SCENARIO_NOT_FOUND" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return { data: null, error: state.rpcError };
    },
  }),
}));

import {
  addInvestmentScenarioObservationAction,
  recordInvestmentScenarioOutcomeAction,
} from "./investment-scenario-learning-runtime";

function outcomeFormData() {
  const data = new FormData();
  data.set("opportunityId", "investment-opportunity-1");
  data.set("scenarioId", "scenario-a");
  data.set("periodStart", "2026-01-01");
  data.set("periodEnd", "2026-01-31");
  data.set("annualRevenue", "120000");
  return data;
}
function observationFormData() {
  const data = new FormData();
  data.set("opportunityId", "investment-opportunity-1");
  data.set("scenarioId", "scenario-a");
  data.set("body", "Occupancy trended above the base case in month one.");
  return data;
}

describe("recordInvestmentScenarioOutcomeAction", () => {
  beforeEach(() => {
    state.contextOk = true;
    state.authorizeAllowed = true;
    state.authorizeCalls = [];
    state.rpcCalls = [];
    state.rpcError = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("checks scenario.modify authorization before calling the RPC, then redirects on success", async () => {
    await expect(
      recordInvestmentScenarioOutcomeAction(outcomeFormData()),
    ).rejects.toThrow(/REDIRECT:/);
    expect(state.authorizeCalls).toEqual([
      { opportunityId: "investment-opportunity-1", operation: "scenario.modify" },
    ]);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].name).toBe("record_investment_scenario_outcome");
  });

  it("fails closed without calling the RPC when the actor is not authorized", async () => {
    state.authorizeAllowed = false;
    await expect(
      recordInvestmentScenarioOutcomeAction(outcomeFormData()),
    ).rejects.toThrow("scenario_permission_denied");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("fails closed without calling the RPC when unauthenticated", async () => {
    state.contextOk = false;
    await expect(
      recordInvestmentScenarioOutcomeAction(outcomeFormData()),
    ).rejects.toThrow("scenario_permission_denied");
    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("addInvestmentScenarioObservationAction", () => {
  beforeEach(() => {
    state.contextOk = true;
    state.authorizeAllowed = true;
    state.authorizeCalls = [];
    state.rpcCalls = [];
    state.rpcError = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("checks scenario.modify authorization before calling the RPC, then redirects on success", async () => {
    await expect(
      addInvestmentScenarioObservationAction(observationFormData()),
    ).rejects.toThrow(/REDIRECT:/);
    expect(state.authorizeCalls).toEqual([
      { opportunityId: "investment-opportunity-1", operation: "scenario.modify" },
    ]);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].name).toBe("add_investment_scenario_observation");
  });

  it("fails closed without calling the RPC when the actor is not authorized", async () => {
    state.authorizeAllowed = false;
    await expect(
      addInvestmentScenarioObservationAction(observationFormData()),
    ).rejects.toThrow("scenario_permission_denied");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("fails closed without calling the RPC when unauthenticated", async () => {
    state.contextOk = false;
    await expect(
      addInvestmentScenarioObservationAction(observationFormData()),
    ).rejects.toThrow("scenario_permission_denied");
    expect(state.rpcCalls).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { createPurchaseLifecycleResult } from "@/features/investment-intelligence/application/__tests__/fixtures/investment-lifecycle.fixture";
import {
  compareInvestmentScenarios,
  createInvestmentOpportunity,
  getInvestmentScenarioWorkspace,
  saveOpportunityAnalysis,
} from "../application";
import { InMemoryInvestmentOpportunityRepository } from "../infrastructure";
import type { InvestmentScenario } from "../domain";

const at = new Date("2026-07-25T18:00:00.000Z");
const actor = { type: "user" as const, id: "00000000-0000-0000-0000-000000000001" };
const property = { marketPropertyId: "investment-platform-purchase", normalizedAddress: { address1: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201" }, displayAddress: "123 Main Street, Mesa, AZ 85201", resolutionStatus: "resolved" as const, capturedAt: at };
const sourceSummary = { userSuppliedCount: 3, learningSuppliedCount: 0, marketSuppliedCount: 2, defaultSuppliedCount: 1, overrides: [], marketEvidenceAvailable: true } as const;

describe("Investment scenario management", () => {
  it("projects immutable analyses as independent scenario revisions and marks current preferred", async () => {
    const opportunity = await opportunityWithTwoAnalyses();
    const workspace = getInvestmentScenarioWorkspace(opportunity, { actorId: actor.id, evaluatedAt: at });

    expect(workspace.scenarios.map(({ revision }) => revision)).toEqual([1, 2]);
    expect(workspace.scenarios[0].status).toBe("calculated");
    expect(workspace.scenarios[1].status).toBe("preferred");
    expect(workspace.preferredScenario?.id).toBe(workspace.scenarios[1].id);
    expect(workspace.scenarios[0].snapshot.calculationVersion).toBe("lifecycle-1");
    expect(Object.isFrozen(workspace.scenarios[0].snapshot.result)).toBe(true);
  });

  it("compares two to four scenarios and exposes changed assumptions and directional financial differences", async () => {
    const workspace = getInvestmentScenarioWorkspace(await opportunityWithTwoAnalyses(), { actorId: actor.id, evaluatedAt: at });
    const base = withValues(workspace.scenarios[0], "base", 68, 40000);
    const upside = withValues(workspace.scenarios[1], "upside", 74, 45000);
    const comparison = compareInvestmentScenarios([base, upside]);

    expect(comparison.changedAssumptions).toEqual([{
      key: "occupancy",
      values: [{ scenarioId: "base", value: 68 }, { scenarioId: "upside", value: 74 }],
    }]);
    expect(comparison.financialDifferences.find(({ metric }) => metric === "Annual cash flow")?.values[1]).toMatchObject({
      difference: 5000,
      state: "improved",
    });
    expect(Object.isFrozen(comparison)).toBe(true);
  });

  it("rejects invalid comparison cardinality and duplicates", async () => {
    const [scenario] = getInvestmentScenarioWorkspace(await opportunityWithTwoAnalyses(), { actorId: actor.id }).scenarios;
    expect(() => compareInvestmentScenarios([scenario])).toThrow("Select at least two scenarios.");
    expect(() => compareInvestmentScenarios([scenario, scenario])).toThrow("Select each scenario only once.");
    expect(() => compareInvestmentScenarios([scenario, withValues(scenario, "2"), withValues(scenario, "3"), withValues(scenario, "4"), withValues(scenario, "5")])).toThrow("Compare no more than four scenarios.");
  });
});

async function opportunityWithTwoAnalyses() {
  const repository = new InMemoryInvestmentOpportunityRepository();
  let opportunity = await createInvestmentOpportunity(repository, { authenticatedOwnerId: actor.id, route: "purchase", property, actor, occurredAt: at });
  opportunity = await saveOpportunityAnalysis(repository, { authenticatedOwnerId: actor.id, opportunityId: opportunity.id, expectedVersion: 1, actor, occurredAt: at, analysis: { lifecycleResult: createPurchaseLifecycleResult(), lifecycleResultId: "lifecycle-1", sourceSummary, analyzedAt: at } });
  return saveOpportunityAnalysis(repository, { authenticatedOwnerId: actor.id, opportunityId: opportunity.id, expectedVersion: 2, actor, occurredAt: at, analysis: { lifecycleResult: createPurchaseLifecycleResult(), lifecycleResultId: "lifecycle-2", sourceSummary, analyzedAt: at } });
}

function withValues(scenario: InvestmentScenario, id: string, occupancy = 68, cashFlow = scenario.snapshot.result.financials.annualCashFlow.amount): InvestmentScenario {
  return {
    ...scenario,
    id,
    snapshot: {
      ...scenario.snapshot,
      assumptions: { occupancy },
      result: {
        ...scenario.snapshot.result,
        financials: {
          ...scenario.snapshot.result.financials,
          annualCashFlow: { ...scenario.snapshot.result.financials.annualCashFlow, amount: cashFlow },
        },
      },
    },
  };
}

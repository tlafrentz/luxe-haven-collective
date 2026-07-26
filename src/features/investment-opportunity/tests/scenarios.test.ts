import { describe, expect, it } from "vitest";
import { createPurchaseLifecycleResult } from "@/features/investment-intelligence/application/__tests__/fixtures/investment-lifecycle.fixture";
import {
  compareInvestmentScenarios,
  createInvestmentOpportunity,
  getInvestmentScenarioWorkspace,
  saveOpportunityAnalysis,
} from "../application";
import { InMemoryInvestmentOpportunityRepository } from "../infrastructure";
import { buildScenarioLearningProjection, type InvestmentScenario } from "../domain";
import type { ScenarioOutcomeRevision } from "../domain";

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
    expect(comparison.projectionVersion).toBe("scenario-comparison-projection.v1");
    expect(comparison.executiveSummary.bestOverallScenarioId).toBe("upside");
    expect(comparison.metrics.find(({ key }) => key === "annualCashFlow")).toMatchObject({
      bestScenarioIds: ["upside"],
      worstScenarioIds: ["base"],
      values: [{ scenarioId: "base", state: "worst" }, { scenarioId: "upside", state: "best" }],
    });
    expect(comparison.metrics.find(({ key }) => key === "paybackPeriod")?.values.every(({ state }) => state === "unavailable")).toBe(true);
    expect(comparison.tradeoffs.find(({ scenarioId }) => scenarioId === "upside")?.benefits).toContain("Best annual cash flow among compared scenarios.");
    expect(Object.isFrozen(comparison)).toBe(true);
  });

  it("rejects invalid comparison cardinality and duplicates", async () => {
    const [scenario] = getInvestmentScenarioWorkspace(await opportunityWithTwoAnalyses(), { actorId: actor.id }).scenarios;
    expect(() => compareInvestmentScenarios([scenario])).toThrow("Select at least two scenarios.");
    expect(() => compareInvestmentScenarios([scenario, scenario])).toThrow("Select each scenario only once.");
    expect(() => compareInvestmentScenarios([scenario, withValues(scenario, "2"), withValues(scenario, "3"), withValues(scenario, "4"), withValues(scenario, "5")])).toThrow("Compare no more than four scenarios.");
  });

  it("evaluates immutable scenario hypotheses against append-only measured outcomes",async()=>{
    const workspace=getInvestmentScenarioWorkspace(await opportunityWithTwoAnalyses(),{actorId:actor.id,evaluatedAt:at});
    const scenario=withValues(workspace.scenarios[0],"measured",68,40000);
    const outcome:ScenarioOutcomeRevision={id:"outcome-1",scenarioId:scenario.id,opportunityId:scenario.opportunityId,revision:1,periodStart:"2026-01-01",periodEnd:"2026-12-31",actualMetrics:{annualRevenue:scenario.snapshot.result.financials.projectedAnnualRevenue.amount*1.1,occupancy:70,annualCashFlow:36000},recommendationOutcome:"successful",confidence:"high",evidence:[{source:"financial",label:"2026 reconciled operating statement",quality:"high"}],createdBy:actor.id,createdAt:at.toISOString()};
    const projection=buildScenarioLearningProjection(scenario,outcome,at.toISOString());
    expect(projection).toMatchObject({projectionVersion:"scenario-learning-projection.v1",state:"partial",outcomeRevision:1});
    expect(projection.metrics.find(item=>item.key==="annualRevenue")?.percentageVariance).toBeCloseTo(10);
    expect(projection.assumptionValidations).toContainEqual(expect.objectContaining({assumption:"occupancy",status:"validated",actual:70}));
    expect(projection.lessons.some(item=>item.statement.includes("Annual Revenue exceeded"))).toBe(true);
    expect(projection.recommendationValidation.outcome).toBe("successful");
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it("represents absent operational evidence explicitly instead of as zero",async()=>{
    const scenario=getInvestmentScenarioWorkspace(await opportunityWithTwoAnalyses(),{actorId:actor.id}).scenarios[0];
    const projection=buildScenarioLearningProjection(scenario);
    expect(projection.state).toBe("no-outcome");
    expect(projection.metrics.every(item=>item.actual===undefined&&item.direction==="unavailable")).toBe(true);
    expect(projection.confidenceCalibration.observedAccuracy).toBe("insufficient-evidence");
  });

  it("overlays operational metadata without changing immutable calculation results",async()=>{
    const opportunity=await opportunityWithTwoAnalyses(),analysis=opportunity.props.analyses[0],original=analysis.props.resultSnapshot.financials.annualCashFlow.amount;
    const workspace=getInvestmentScenarioWorkspace(opportunity,{actorId:actor.id,records:[{scenarioId:analysis.id.value,name:"Cash Purchase",scenarioType:"cash-purchase",notes:"Seller prefers a quick close.",status:"archived",revision:3,createdAt:at.toISOString(),updatedAt:at.toISOString(),archivedAt:at.toISOString()}],events:[{id:"event-1",scenarioId:analysis.id.value,eventType:"scenario-archived",safeSummary:"Scenario archived without deleting its history.",occurredAt:at.toISOString()}]});
    expect(workspace.scenarios[0]).toMatchObject({name:"Cash Purchase",type:"cash-purchase",status:"archived",metadataRevision:3,notes:"Seller prefers a quick close."});
    expect(workspace.scenarios[0].snapshot.result.financials.annualCashFlow.amount).toBe(original);
    expect(workspace.archivedScenarios).toHaveLength(1);
    expect(workspace.lifecycleEvents[0].type).toBe("scenario-archived");
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

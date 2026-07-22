import {
  describe,
  expect,
  it,
} from "vitest";

import {
  completeInvestmentAction,
  createInvestmentExecutionFixture,
} from "../__tests__/fixtures/investment-execution.fixture";
import {
  mapInvestmentFindingToOutcome,
} from "./map-investment-finding-to-outcome";

describe("mapInvestmentFindingToOutcome", () => {
  it("maps explicit business semantics and complete reasoning lineage without mutating the Action", () => {
    const fixture =
      createInvestmentExecutionFixture(
        "purchase",
      );
    const action = completeInvestmentAction(
      fixture.plan.actions[0],
    );
    const recommendation =
      fixture.platformAnalysis.recommendations
        .toArray()[0];
    const command = {
      action,
      platformAnalysis:
        fixture.platformAnalysis,
      decision: fixture.decision,
      finding: {
        disposition:
          "unfavorable" as const,
        summary:
          "The quote exceeds the underwriting assumption.",
      },
      actor: { id: "operator-007c" },
      context: {
        outcomeId: "outcome-adapter-007c",
        recordedAt:
          new Date("2026-02-02T13:00:00Z"),
      },
    };
    const measurements = [
      {
        key: "annual-premium",
        label: "Annual premium",
        value: 4800,
        assumedValue: 2400,
        variance: 2400,
        unit: "USD" as const,
        period: "annual" as const,
      },
    ];
    const lineage = {
      acquisitionType:
        fixture.plan.acquisitionType,
      actionId: action.id.value,
      decisionId:
        fixture.decision.id.value,
      recommendationId:
        recommendation.id.value,
      planId: fixture.plan.id,
      investmentRunId:
        fixture.plan.investmentRunId,
      subjectId: fixture.plan.subjectId,
      intentKey:
        fixture.plan.intents[0].key,
    };

    const outcome =
      mapInvestmentFindingToOutcome(
        command,
        command.finding,
        measurements,
        recommendation,
        lineage,
      );

    expect(outcome.status).toBe("completed");
    expect(outcome.successful).toBe(true);
    expect(outcome.result.disposition).toBe(
      "unfavorable",
    );
    expect(outcome.metrics).toMatchObject({
      "annual-premium": 4800,
      "annual-premium.assumed": 2400,
      "annual-premium.variance": 2400,
    });
    expect(outcome.lineage.actionIds).toEqual([
      action.id,
    ]);
    expect(
      outcome.lineage.evaluationIds
        .map(({ value }) => value),
    ).toEqual(
      recommendation.evaluationIds.map(
        ({ value }) => value,
      ),
    );
    expect(action.outcomeReferences).toEqual([]);
  });
});

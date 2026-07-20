import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createInvestmentDecision,
} from "../__tests__/fixtures/investment-decision.fixture";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

import {
  mapExpenseProjection,
} from "./map-expense-projection";

describe("mapExpenseProjection", () => {
  it("maps the complete expense projection", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapExpenseProjection(
        decision.expenseProjection,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(12);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .expenses.mortgage,
      ),
    ).toBe(24272);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .expenses.management,
      ),
    ).toBe(8966);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .expenses.totalOperatingExpenses,
      ),
    ).toBe(28451);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .expenses.confidence,
      ),
    ).toBe(80);

    expect(
      observations.every(
        (observation) =>
          observation.subject.id ===
          "property-001",
      ),
    ).toBe(true);
  });
});

function observationValue(
  observations: ReturnType<
    typeof mapExpenseProjection
  >,
  type: string,
): unknown {
  return observations.find(
    (observation) =>
      observation.type === type,
  )?.value;
}

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
  mapAcquisitionStrategy,
} from "./map-acquisition-strategy";

describe("mapAcquisitionStrategy", () => {
  it("maps the complete acquisition strategy", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapAcquisitionStrategy(
        decision.strategy,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(11);

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .strategy.targetOfferPrice,
      decision.strategy.targetOfferPrice.amount,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .strategy.requiredOccupancy,
      decision.strategy.requiredOccupancy.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .strategy.primaryOpportunity,
      decision.strategy.primaryOpportunity,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .strategy.primaryRisk,
      decision.strategy.primaryRisk,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .strategy.firstNinetyDayPriority,
      decision.strategy
        .firstNinetyDayPriorities,
    );
  });
});

function expectValue(
  observations: ReturnType<
    typeof mapAcquisitionStrategy
  >,
  type: string,
  expected: unknown,
): void {
  expect(
    observations.find(
      (observation) =>
        observation.type === type,
    )?.value,
  ).toEqual(expected);
}

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
  mapInvestmentScore,
} from "./map-investment-score";

describe("mapInvestmentScore", () => {
  it("maps the complete investment scorecard", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapInvestmentScore(
        decision.score,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(6);

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.overall,
      decision.score.overall.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.revenuePotential,
      decision.score.revenuePotential.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.financialStrength,
      decision.score.financialStrength.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.marketStrength,
      decision.score.marketStrength.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.competitivePosition,
      decision.score.competitivePosition.value,
    );

    expectValue(
      observations,
      INVESTMENT_OBSERVATION_TYPES
        .score.riskExposure,
      decision.score.riskExposure.value,
    );

    expect(
      observations.every(
        (observation) =>
          observation.unit?.type === "score",
      ),
    ).toBe(true);
  });
});

function expectValue(
  observations: ReturnType<
    typeof mapInvestmentScore
  >,
  type: string,
  expected: unknown,
): void {
  expect(
    observations.find(
      (observation) =>
        observation.type === type,
    )?.value,
  ).toBe(expected);
}

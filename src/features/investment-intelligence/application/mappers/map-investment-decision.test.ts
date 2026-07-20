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
  mapInvestmentDecision,
} from "./map-investment-decision";

describe("mapInvestmentDecision", () => {
  it("maps recommendation and confidence", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapInvestmentDecision(
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(2);

    expect(
      observations.find(
        (observation) =>
          observation.type ===
          INVESTMENT_OBSERVATION_TYPES
            .decision.recommendation,
      )?.value,
    ).toBe(decision.recommendation);

    expect(
      observations.find(
        (observation) =>
          observation.type ===
          INVESTMENT_OBSERVATION_TYPES
            .decision.confidence,
      )?.value,
    ).toBe(decision.confidence);

    expect(
      observations.every(
        (observation) =>
          observation.unit === undefined,
      ),
    ).toBe(true);
  });
});

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
  mapInvestmentRisks,
} from "./map-investment-risks";

describe("mapInvestmentRisks", () => {
  it("maps one observation per risk", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapInvestmentRisks(
        decision.risks,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(1);

    const observation = observations[0];

    expect(observation.type).toBe(
      INVESTMENT_OBSERVATION_TYPES
        .risk.item,
    );
    expect(observation.label).toBe(
      decision.risks[0].title,
    );
    expect(observation.value).toBe(
      decision.risks[0].description,
    );
    expect(observation.metadata).toEqual({
      riskId: "risk-001",
      severity: "medium",
      probability: 70,
      estimatedFinancialImpact: 6000,
      financialImpactCurrency: "USD",
      mitigation:
        "Use monthly pricing and extended-stay campaigns.",
    });
  });

  it("supports decisions without risks", () => {
    const decision =
      createInvestmentDecision();

    expect(
      mapInvestmentRisks(
        [],
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      ),
    ).toEqual([]);
  });
});

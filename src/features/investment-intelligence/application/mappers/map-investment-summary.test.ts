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
  mapInvestmentSummary,
} from "./map-investment-summary";

describe("mapInvestmentSummary", () => {
  it("maps one executive decision snapshot", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapInvestmentSummary(
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(1);

    const observation = observations[0];

    expect(observation.type).toBe(
      INVESTMENT_OBSERVATION_TYPES
        .summary.executive,
    );

    expect(observation.value).toEqual({
      acquisitionType: "purchase",
      recommendation:
        "buy-with-conditions",
      confidence: "high",
      overallScore: 78,
      projectedAnnualRevenue: 49812,
      netOperatingIncome: 21361,
      annualCashFlow: 7089,
      primaryOpportunity:
        "Improve shoulder-season occupancy.",
      primaryRisk:
        "Acquisition price leaves limited downside protection.",
      riskCount: 1,
      evidenceCount: 1,
    });

    expect(observation.metadata).toEqual({
      currency: "USD",
    });
  });
});

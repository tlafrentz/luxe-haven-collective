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
  mapFinancialPerformance,
} from "./map-financial-performance";

describe("mapFinancialPerformance", () => {
  it("maps the complete financial performance", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapFinancialPerformance(
        decision.financialPerformance,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(6);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial.netOperatingIncome,
      ),
    ).toBe(21361);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial.annualCashFlow,
      ),
    ).toBe(7089);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial.capRate,
      ),
    ).toBe(5.34);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial.cashOnCashReturn,
      ),
    ).toBe(6.07);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial
          .debtServiceCoverageRatio,
      ),
    ).toBe(1.49);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .financial.breakEvenOccupancy,
      ),
    ).toBe(55);
  });
});

function observationValue(
  observations: ReturnType<
    typeof mapFinancialPerformance
  >,
  type: string,
): unknown {
  return observations.find(
    (observation) =>
      observation.type === type,
  )?.value;
}

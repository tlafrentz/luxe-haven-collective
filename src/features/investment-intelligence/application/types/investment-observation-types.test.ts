import {
  describe,
  expect,
  it,
} from "vitest";

import {
  INVESTMENT_OBSERVATION_CAPABILITY,
  INVESTMENT_OBSERVATION_TYPES,
} from "./investment-observation-types";

describe("investment observation types", () => {
  it("defines the canonical capability name", () => {
    expect(
      INVESTMENT_OBSERVATION_CAPABILITY,
    ).toBe("investment-intelligence");
  });

  it("groups observation types by investment concern", () => {
    expect(
      INVESTMENT_OBSERVATION_TYPES
        .revenue.projectedAnnualRevenue,
    ).toBe(
      "investment.revenue.projected-annual",
    );

    expect(
      INVESTMENT_OBSERVATION_TYPES
        .financial.netOperatingIncome,
    ).toBe(
      "investment.financial.net-operating-income",
    );

    expect(
      INVESTMENT_OBSERVATION_TYPES
        .decision.recommendation,
    ).toBe(
      "investment.decision.recommendation",
    );

    expect(
      INVESTMENT_OBSERVATION_TYPES
        .summary.executive,
    ).toBe("investment.summary");
  });
});

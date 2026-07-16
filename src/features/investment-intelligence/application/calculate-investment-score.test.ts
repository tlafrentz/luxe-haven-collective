import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ConfidenceLevel,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  RevenueProjection,
} from "../domain";

import {
  calculateInvestmentScore,
} from "./calculate-investment-score";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createRevenueProjection(
  overrides: Partial<RevenueProjection> = {},
): RevenueProjection {
  return {
    projectedAdr: usd(200),
    projectedOccupancy: {
      value: 75,
    },
    projectedMonthlyRevenue:
      usd(4562.5),
    projectedAnnualRevenue:
      usd(54750),
    confidence: {
      value: 85,
    },
    ...overrides,
  };
}

function createFinancialPerformance(
  overrides: Partial<FinancialPerformance> = {},
): FinancialPerformance {
  return {
    netOperatingIncome: usd(29750),
    annualCashFlow: usd(11750),
    capRate: {
      value: 7.44,
    },
    cashOnCashReturn: {
      value: 11.75,
    },
    debtServiceCoverageRatio: 1.65,
    breakEvenOccupancy: {
      value: 58.9,
    },
    ...overrides,
  };
}

function createComparableAnalysis(
  overrides: Partial<ComparableAnalysis> = {},
): ComparableAnalysis {
  return {
    comparables: [],
    medianAverageDailyRate:
      usd(180),
    medianOccupancy: {
      value: 70,
    },
    marketPositionScore: {
      value: 55,
      max: 100,
    },
    projectedRevenueUpside:
      usd(8760),
    competitiveAdvantages: [],
    competitiveDisadvantages: [],
    confidence:
      ConfidenceLevel.Low,
    ...overrides,
  };
}

describe("calculateInvestmentScore", () => {
  it("calculates all investment score dimensions", () => {
    const result =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 30,
          max: 100,
        },
      });

    expect(result).toEqual({
      overall: {
        value: 75,
        max: 100,
      },
      revenuePotential: {
        value: 62,
        max: 100,
      },
      financialStrength: {
        value: 88,
        max: 100,
      },
      marketStrength: {
  value: 87,
  max: 100,
},
      competitivePosition: {
        value: 55,
        max: 100,
      },
      riskExposure: {
        value: 30,
        max: 100,
      },
    });
  });

  it("rewards stronger financial performance", () => {
    const baseline =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 30,
          max: 100,
        },
      });

    const stronger =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            capRate: {
              value: 10,
            },
            cashOnCashReturn: {
              value: 18,
            },
            debtServiceCoverageRatio: 2,
            breakEvenOccupancy: {
              value: 40,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 30,
          max: 100,
        },
      });

    expect(
      stronger.financialStrength.value,
    ).toBeGreaterThan(
      baseline.financialStrength.value,
    );

    expect(
      stronger.overall.value,
    ).toBeGreaterThan(
      baseline.overall.value,
    );
  });

  it("penalizes higher risk exposure", () => {
    const lowRisk =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 10,
          max: 100,
        },
      });

    const highRisk =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 90,
          max: 100,
        },
      });

    expect(
      lowRisk.overall.value,
    ).toBeGreaterThan(
      highRisk.overall.value,
    );
  });

  it("preserves risk exposure as an actual exposure score", () => {
    const result =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 80,
          max: 100,
        },
      });

    expect(
      result.riskExposure.value,
    ).toBe(80);
  });

  it("clamps dimension scores at 100", () => {
    const result =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection({
            projectedAdr: usd(500),
            projectedOccupancy: {
              value: 100,
            },
            projectedAnnualRevenue:
              usd(182500),
          }),
        financialPerformance:
          createFinancialPerformance({
            capRate: {
              value: 25,
            },
            cashOnCashReturn: {
              value: 40,
            },
            debtServiceCoverageRatio: 5,
            breakEvenOccupancy: {
              value: 10,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis({
            medianAverageDailyRate:
              usd(150),
            medianOccupancy: {
              value: 50,
            },
            marketPositionScore: {
              value: 150,
              max: 100,
            },
            projectedRevenueUpside:
              usd(100000),
            confidence:
              ConfidenceLevel.VeryHigh,
          }),
        riskExposure: {
          value: 0,
          max: 100,
        },
      });

    expect(
      result.revenuePotential.value,
    ).toBeLessThanOrEqual(100);

    expect(
      result.financialStrength.value,
    ).toBeLessThanOrEqual(100);

    expect(
      result.competitivePosition.value,
    ).toBe(100);

    expect(
      result.overall.value,
    ).toBeLessThanOrEqual(100);
  });

  it("supports a custom scoring policy", () => {
    const result =
      calculateInvestmentScore({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        riskExposure: {
          value: 30,
          max: 100,
        },
        policy: {
          targetCapRate: 6,
          targetCashOnCashReturn: 8,
          targetDebtServiceCoverageRatio: 1.2,
          targetMarketOccupancy: 60,
          fullRevenueUpsidePercentage: 10,
        },
      });

    expect(
      result.financialStrength.value,
    ).toBeGreaterThanOrEqual(90);

    expect(
      result.marketStrength.value,
    ).toBeGreaterThanOrEqual(85);
  });

  it.each([
    -1,
    101,
  ])(
    "rejects risk exposure outside the 0 to 100 range: %s",
    (value) => {
      expect(() =>
        calculateInvestmentScore({
          revenueProjection:
            createRevenueProjection(),
          financialPerformance:
            createFinancialPerformance(),
          comparableAnalysis:
            createComparableAnalysis(),
          riskExposure: {
            value,
            max: 100,
          },
        }),
      ).toThrow(
        "Risk exposure must be between 0 and 100.",
      );
    },
  );

  it("is deterministic for identical inputs", () => {
    const input = {
      revenueProjection:
        createRevenueProjection(),
      financialPerformance:
        createFinancialPerformance(),
      comparableAnalysis:
        createComparableAnalysis(),
      riskExposure: {
        value: 30,
        max: 100 as const,
      },
    };

    expect(
      calculateInvestmentScore(input),
    ).toEqual(
      calculateInvestmentScore(input),
    );
  });
});

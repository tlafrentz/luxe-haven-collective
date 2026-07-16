import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ConfidenceLevel,
  MarketTrend,
  RiskSeverity,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  MarketSnapshot,
  RevenueProjection,
} from "../domain";

import {
  assessInvestmentRisks,
} from "./assess-investment-risks";

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
      ConfidenceLevel.Moderate,
    ...overrides,
  };
}

function createMarketSnapshot(
  overrides: Partial<MarketSnapshot> = {},
): MarketSnapshot {
  return {
    market: "Mesa",
    submarket: "Downtown Mesa",
    medianAdr: usd(180),
    medianOccupancy: {
      value: 70,
    },
    trend: MarketTrend.Stable,
    ...overrides,
  };
}

describe("assessInvestmentRisks", () => {
  it("returns no risks for a financially healthy, well-supported investment", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
      });

    expect(result).toEqual({
      risks: [],
      riskExposure: {
        value: 0,
        max: 100,
      },
    });
  });

  it("identifies negative annual cash flow and quantifies the projected impact", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            annualCashFlow:
              usd(-12500),
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
      });

    expect(result.risks).toContainEqual({
      id: "negative-annual-cash-flow",
      title:
        "Negative annual cash flow",
      description:
        "Projected operating performance does not cover operating expenses and annual debt service.",
      severity:
        RiskSeverity.Critical,
      probability: {
        value: 90,
      },
      estimatedFinancialImpact:
        usd(12500),
      mitigation:
        "Reduce the acquisition price, improve the operating plan, increase revenue assumptions only with supporting evidence, or change the financing structure.",
    });

    expect(
      result.riskExposure.value,
    ).toBeGreaterThan(0);
  });

  it("identifies insufficient debt-service coverage", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            debtServiceCoverageRatio:
              0.9,
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
      });

    const risk = result.risks.find(
      ({ id }) =>
        id ===
        "insufficient-debt-service-coverage",
    );

    expect(risk?.severity).toBe(
      RiskSeverity.Critical,
    );
  });

  it("identifies limited debt-service buffer before coverage becomes insufficient", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            debtServiceCoverageRatio:
              1.15,
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
      });

    expect(
      result.risks.map(
        ({ id }) => id,
      ),
    ).toContain(
      "limited-debt-service-buffer",
    );

    expect(
      result.risks.map(
        ({ id }) => id,
      ),
    ).not.toContain(
      "insufficient-debt-service-coverage",
    );
  });

  it.each([
    {
      occupancy: 60,
      expectedId:
        "elevated-break-even-occupancy",
      expectedSeverity:
        RiskSeverity.Medium,
    },
    {
      occupancy: 70,
      expectedId:
        "high-break-even-occupancy",
      expectedSeverity:
        RiskSeverity.High,
    },
    {
      occupancy: 80,
      expectedId:
        "critical-break-even-occupancy",
      expectedSeverity:
        RiskSeverity.Critical,
    },
  ])(
    "identifies break-even occupancy risk at $occupancy percent",
    ({
      occupancy,
      expectedId,
      expectedSeverity,
    }) => {
      const result =
        assessInvestmentRisks({
          revenueProjection:
            createRevenueProjection(),
          financialPerformance:
            createFinancialPerformance({
              breakEvenOccupancy: {
                value: occupancy,
              },
            }),
          comparableAnalysis:
            createComparableAnalysis(),
          market:
            createMarketSnapshot(),
        });

      const risk = result.risks.find(
        ({ id }) => id === expectedId,
      );

      expect(risk?.severity).toBe(
        expectedSeverity,
      );
    },
  );

  it("identifies aggressive ADR and occupancy assumptions", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection({
            projectedAdr: usd(250),
            projectedOccupancy: {
              value: 85,
            },
          }),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis({
            medianAverageDailyRate:
              usd(180),
            medianOccupancy: {
              value: 70,
            },
          }),
        market:
          createMarketSnapshot(),
      });

    expect(
      result.risks.map(
        ({ id }) => id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "aggressive-adr-assumption",
        "aggressive-occupancy-assumption",
      ]),
    );
  });

  it("identifies limited comparable confidence", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis({
            confidence:
              ConfidenceLevel.VeryLow,
          }),
        market:
          createMarketSnapshot(),
      });

    const risk = result.risks.find(
      ({ id }) =>
        id ===
        "limited-comparable-confidence",
    );

    expect(risk?.severity).toBe(
      RiskSeverity.Medium,
    );
  });

  it("identifies declining market conditions", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot({
            trend:
              MarketTrend.Declining,
          }),
      });

    expect(
      result.risks.map(
        ({ id }) => id,
      ),
    ).toContain(
      "declining-market-demand",
    );
  });

  it("produces higher exposure when severe risks accumulate", () => {
    const moderateResult =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            breakEvenOccupancy: {
              value: 62,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
      });

    const severeResult =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            annualCashFlow:
              usd(-15000),
            debtServiceCoverageRatio:
              0.8,
            breakEvenOccupancy: {
              value: 85,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis({
            confidence:
              ConfidenceLevel.VeryLow,
          }),
        market:
          createMarketSnapshot({
            trend:
              MarketTrend.Declining,
          }),
      });

    expect(
      severeResult.riskExposure.value,
    ).toBeGreaterThan(
      moderateResult.riskExposure.value,
    );

    expect(
      severeResult.riskExposure.value,
    ).toBeLessThanOrEqual(100);
  });

  it("supports a custom risk policy", () => {
    const result =
      assessInvestmentRisks({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            capRate: {
              value: 7.44,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
        policy: {
          minimumDebtServiceCoverageRatio:
            1.5,
          warningDebtServiceCoverageRatio:
            1.75,
          criticalBreakEvenOccupancy:
            70,
          highBreakEvenOccupancy: 60,
          warningBreakEvenOccupancy:
            50,
          minimumCapRate: 8,
          maximumAdrPremiumPercentage:
            10,
          maximumOccupancyPremiumPoints:
            5,
        },
      });

    expect(
      result.risks.map(
        ({ id }) => id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "limited-debt-service-buffer",
        "elevated-break-even-occupancy",
        "low-cap-rate",
        "aggressive-adr-assumption",
      ]),
    );
  });
});


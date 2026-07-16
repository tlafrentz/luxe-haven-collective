import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ConfidenceLevel,
  EvidenceDirection,
  MarketTrend,
  RiskSeverity,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  InvestmentRisk,
  MarketSnapshot,
  RevenueProjection,
} from "../domain";

import {
  buildSupportingEvidence,
} from "./build-supporting-evidence";

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
    netOperatingIncome: usd(32000),
    annualCashFlow: usd(15000),
    capRate: {
      value: 8.5,
    },
    cashOnCashReturn: {
      value: 15,
    },
    debtServiceCoverageRatio: 1.7,
    breakEvenOccupancy: {
      value: 55,
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
      value: 68,
    },
    marketPositionScore: {
      value: 60,
      max: 100,
    },
    projectedRevenueUpside:
      usd(8500),
    competitiveAdvantages: [],
    competitiveDisadvantages: [],
    confidence:
      ConfidenceLevel.High,
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
      value: 68,
    },
    trend: MarketTrend.Growing,
    ...overrides,
  };
}

function createRisk(): InvestmentRisk {
  return {
    id: "elevated-break-even-occupancy",
    title:
      "Elevated break-even occupancy",
    description:
      "The projected break-even point leaves a limited operating cushion.",
    severity: RiskSeverity.Medium,
    probability: {
      value: 65,
    },
    mitigation:
      "Validate lower-occupancy scenarios.",
  };
}

describe("buildSupportingEvidence", () => {
  it("builds positive evidence from strong financial performance", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
        risks: [],
      });

    const evidenceIds = result.map(
      ({ id }) => id,
    );

    expect(evidenceIds).toEqual(
      expect.arrayContaining([
        "strong-cap-rate",
        "strong-cash-on-cash-return",
        "healthy-debt-service-coverage",
        "strong-annual-cash-flow",
      ]),
    );

    expect(
      result
        .filter(
          ({ id }) =>
            evidenceIds.includes(id),
        )
        .every(
          ({ direction }) =>
            direction ===
            EvidenceDirection.Positive,
        ),
    ).toBe(true);
  });

  it("builds positive evidence from comparable outperformance", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
        risks: [],
      });

    expect(
      result.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "meaningful-revenue-upside",
        "above-market-adr",
        "above-market-occupancy",
        "strong-comparable-confidence",
      ]),
    );
  });

  it("builds positive evidence for growing market conditions", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot({
            trend: MarketTrend.Growing,
          }),
        risks: [],
      });

    expect(
      result.map(({ id }) => id),
    ).toContain("growing-market");
  });

  it("does not create strong financial evidence below policy thresholds", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection({
            projectedAdr: usd(175),
            projectedOccupancy: {
              value: 65,
            },
          }),
        financialPerformance:
          createFinancialPerformance({
            annualCashFlow: usd(5000),
            capRate: {
              value: 5,
            },
            cashOnCashReturn: {
              value: 6,
            },
            debtServiceCoverageRatio:
              1.1,
          }),
        comparableAnalysis:
          createComparableAnalysis({
            medianAverageDailyRate:
              usd(180),
            medianOccupancy: {
              value: 68,
            },
            projectedRevenueUpside:
              usd(0),
            confidence:
              ConfidenceLevel.Moderate,
          }),
        market:
          createMarketSnapshot({
            trend: MarketTrend.Stable,
          }),
        risks: [],
      });

    expect(
      result.map(({ id }) => id),
    ).not.toEqual(
      expect.arrayContaining([
        "strong-cap-rate",
        "strong-cash-on-cash-return",
        "healthy-debt-service-coverage",
        "strong-annual-cash-flow",
        "meaningful-revenue-upside",
        "above-market-adr",
        "above-market-occupancy",
        "growing-market",
        "strong-comparable-confidence",
      ]),
    );
  });

  it("converts identified risks into cautionary evidence", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
        risks: [
          createRisk(),
        ],
      });

    expect(result).toContainEqual({
      id:
        "risk-elevated-break-even-occupancy",
      type:
        expect.any(String),
      direction:
        EvidenceDirection.Caution,
      title:
        "Elevated break-even occupancy",
      description:
        "The projected break-even point leaves a limited operating cushion.",
      source:
        "Investment risk assessment",
      confidence:
        ConfidenceLevel.Moderate,
    });
  });

  it("assigns higher evidence confidence to higher-probability risks", () => {
    const highProbabilityRisk = {
      ...createRisk(),
      id: "high-probability-risk",
      probability: {
        value: 90,
      },
    };

    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
        market:
          createMarketSnapshot(),
        risks: [
          highProbabilityRisk,
        ],
      });

    const evidence = result.find(
      ({ id }) =>
        id ===
        "risk-high-probability-risk",
    );

    expect(evidence?.confidence).toBe(
      ConfidenceLevel.High,
    );
  });

  it("supports custom evidence thresholds", () => {
    const result =
      buildSupportingEvidence({
        revenueProjection:
          createRevenueProjection(),
        financialPerformance:
          createFinancialPerformance({
            annualCashFlow: usd(9000),
            capRate: {
              value: 6,
            },
            cashOnCashReturn: {
              value: 8,
            },
            debtServiceCoverageRatio:
              1.3,
          }),
        comparableAnalysis:
          createComparableAnalysis({
            projectedRevenueUpside:
              usd(3000),
          }),
        market:
          createMarketSnapshot(),
        risks: [],
        policy: {
          strongCapRate: 5,
          strongCashOnCashReturn: 7,
          healthyDebtServiceCoverageRatio:
            1.2,
          strongAnnualCashFlow: 8000,
          meaningfulRevenueUpside: 2500,
          materialAdrPremiumPercentage:
            3,
          materialOccupancyPremiumPoints:
            3,
        },
      });

    expect(
      result.map(({ id }) => id),
    ).toEqual(
      expect.arrayContaining([
        "strong-cap-rate",
        "strong-cash-on-cash-return",
        "healthy-debt-service-coverage",
        "strong-annual-cash-flow",
        "meaningful-revenue-upside",
      ]),
    );
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      revenueProjection:
        createRevenueProjection(),
      financialPerformance:
        createFinancialPerformance(),
      comparableAnalysis:
        createComparableAnalysis(),
      market:
        createMarketSnapshot(),
      risks: [
        createRisk(),
      ],
    };

    expect(
      buildSupportingEvidence(input),
    ).toEqual(
      buildSupportingEvidence(input),
    );
  });
});

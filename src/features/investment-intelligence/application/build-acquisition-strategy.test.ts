import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  AcquisitionType,
} from "../domain";

import type {
  BuildAcquisitionStrategyInput,
} from "./build-acquisition-strategy";

import {
  buildAcquisitionStrategy,
} from "./build-acquisition-strategy";

const input = {
  property: {
    id: "purchase-property-1",
    purchasePrice: {
      amount: 400000,
      currency: "USD",
    },
    closingCosts: {
      amount: 12000,
      currency: "USD",
    },
    furnishingBudget: {
      amount: 18000,
      currency: "USD",
    },
  },
  assumptions: {
    acquisitionType:
      AcquisitionType.Purchase,
    downPayment: {
      value: 20,
    },
    interestRate: {
      value: 6.5,
    },
    loanTermYears: 30,
  },
  revenueProjection: {
    projectedAdr: {
      amount: 200,
      currency: "USD",
    },
    projectedOccupancy: {
      value: 75,
    },
    projectedAnnualRevenue: {
      amount: 54750,
      currency: "USD",
    },
  },
  expenseProjection: {
    mortgage: {
      amount: 24271.41,
      currency: "USD",
    },
  },
  financialPerformance: {
    netOperatingIncome: {
      amount: 36000,
      currency: "USD",
    },
    annualCashFlow: {
      amount: 11728.59,
      currency: "USD",
    },
    debtServiceCoverageRatio: 1.48,
    breakEvenOccupancy: {
      value: 58.9,
    },
  },
  score: {
    overall: {
      value: 82,
      max: 100,
    },
    revenuePotential: {
      value: 85,
      max: 100,
    },
    financialStrength: {
      value: 80,
      max: 100,
    },
    marketStrength: {
      value: 78,
      max: 100,
    },
    competitivePosition: {
      value: 75,
      max: 100,
    },
    riskExposure: {
      value: 25,
      max: 100,
    },
  },
  recommendation:
    AcquisitionRecommendation.Buy,
  risks: [],
  supportingEvidence: [],
} as unknown as BuildAcquisitionStrategyInput;

describe(
  "buildAcquisitionStrategy",
  () => {
    it("builds financially constrained acquisition pricing", () => {
      const strategy =
        buildAcquisitionStrategy(input);

      expect(
        strategy.maximumPurchasePrice
          .amount,
      ).toBeGreaterThan(0);

      expect(
        strategy.targetOfferPrice.amount,
      ).toBeLessThan(
        strategy.maximumPurchasePrice
          .amount,
      );

      expect(
        strategy.walkAwayPrice.amount,
      ).toBeGreaterThan(
        strategy.maximumPurchasePrice
          .amount,
      );
    });

    it("derives required operating targets from underwriting", () => {
      const strategy =
        buildAcquisitionStrategy(input);

      expect(
        strategy.requiredOccupancy.value,
      ).toBe(58.9);

      expect(
        strategy.requiredAverageDailyRate
          .amount,
      ).toBeGreaterThan(0);

      expect(
        strategy.requiredAnnualRevenue
          .amount,
      ).toBeGreaterThan(0);

      expect(
        strategy.requiredNetOperatingIncome
          .amount,
      ).toBeGreaterThan(0);
    });

    it("produces an actionable acquisition plan", () => {
      const strategy =
        buildAcquisitionStrategy(input);

      expect(
        strategy.primaryOpportunity
          .length,
      ).toBeGreaterThan(0);

      expect(
        strategy.primaryRisk.length,
      ).toBeGreaterThan(0);

      expect(
        strategy
          .firstNinetyDayPriorities
          .length,
      ).toBeGreaterThan(0);

      expect(
        strategy.expectedAnnualUpside
          .amount,
      ).toBeGreaterThanOrEqual(0);
    });
  },
);

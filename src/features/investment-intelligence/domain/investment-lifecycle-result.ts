import type {
  InvestmentDecision,
} from "./investment-decision";

import type {
  InvestmentScenario,
  PurchaseFailurePoints,
  PurchaseScenario,
  RentalArbitrageFailurePoints,
  RentalArbitrageStressTestSummary,
} from "./entities";

import type {
  RentalArbitrageInvestmentAnalysis,
} from "./rental-arbitrage-investment-analysis";

import {
  AcquisitionType,
} from "./enums";

export type PurchaseInvestmentDerivedAnalysis =
  Readonly<{
    scenarios:
      readonly PurchaseScenario[];
    failurePoints: PurchaseFailurePoints;
  }>;

export type RentalArbitrageInvestmentDerivedAnalysis =
  Readonly<{
    scenarios:
      readonly InvestmentScenario[];
    failurePoints:
      RentalArbitrageFailurePoints;
    stressTests:
      RentalArbitrageStressTestSummary;
  }>;

export type PurchaseInvestmentLifecycleResult =
  Readonly<{
    acquisitionType:
      AcquisitionType.Purchase;
    analysis: InvestmentDecision &
      Readonly<{
        acquisitionType:
          AcquisitionType.Purchase;
      }>;
    derivedAnalysis:
      PurchaseInvestmentDerivedAnalysis;
  }>;

export type RentalArbitrageInvestmentLifecycleResult =
  Readonly<{
    acquisitionType:
      AcquisitionType.RentalArbitrage;
    analysis:
      RentalArbitrageInvestmentAnalysis;
    derivedAnalysis:
      RentalArbitrageInvestmentDerivedAnalysis;
  }>;

/** Canonical result returned by Investment Intelligence orchestration. */
export type InvestmentLifecycleResult =
  | PurchaseInvestmentLifecycleResult
  | RentalArbitrageInvestmentLifecycleResult;

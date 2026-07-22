import type {
  InvestmentDecision,
} from "./investment-decision";

import type {
  RentalArbitrageInvestmentAnalysis,
} from "./rental-arbitrage-investment-analysis";

import {
  AcquisitionType,
} from "./enums";

export type PurchaseInvestmentLifecycleResult =
  Readonly<{
    acquisitionType:
      AcquisitionType.Purchase;
    analysis: InvestmentDecision;
  }>;

export type RentalArbitrageInvestmentLifecycleResult =
  Readonly<{
    acquisitionType:
      AcquisitionType.RentalArbitrage;
    analysis:
      RentalArbitrageInvestmentAnalysis;
  }>;

/** Canonical result returned by Investment Intelligence orchestration. */
export type InvestmentLifecycleResult =
  | PurchaseInvestmentLifecycleResult
  | RentalArbitrageInvestmentLifecycleResult;

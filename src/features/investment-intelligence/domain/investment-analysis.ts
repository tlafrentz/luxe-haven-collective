import type {
  PurchaseInvestmentAnalysis,
} from "./purchase-investment-analysis";

import type {
  RentalArbitrageInvestmentAnalysis,
} from "./rental-arbitrage-investment-analysis";

/**
 * Strategy-aware investment analysis result.
 *
 * Narrow using `acquisitionType` before accessing strategy-specific
 * expense or performance fields.
 */
export type InvestmentAnalysis =
  | PurchaseInvestmentAnalysis
  | RentalArbitrageInvestmentAnalysis;

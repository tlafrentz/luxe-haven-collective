import type {
  PropertyProfile,
  RentalArbitrageAssumptions,
  RentalArbitrageExpenseProjection,
  RentalArbitrageFinancialPerformance,
} from "./entities";

import {
  AcquisitionType,
} from "./enums";

import type {
  InvestmentAnalysisBase,
} from "./investment-analysis-base";

/**
 * A physical property profile used for lease-based underwriting.
 *
 * Purchase price and closing costs are excluded because the operator
 * is evaluating a lease commitment rather than acquiring the asset.
 */
export type RentalArbitragePropertyProfile =
  Omit<
    PropertyProfile,
    "purchasePrice" | "closingCosts"
  >;

/**
 * Rental Arbitrage underwriting result.
 *
 * This model is intentionally free of purchase-only metrics such as:
 * - mortgage
 * - cap rate
 * - debt-service coverage ratio
 */
export type RentalArbitrageInvestmentAnalysis =
  InvestmentAnalysisBase<
    AcquisitionType.RentalArbitrage,
    RentalArbitragePropertyProfile,
    RentalArbitrageAssumptions,
    RentalArbitrageExpenseProjection,
    RentalArbitrageFinancialPerformance
  >;

import type {
  ExpenseProjection,
  FinancialPerformance,
  InvestmentAssumptions,
  PropertyProfile,
} from "./entities";

import {
  AcquisitionType,
} from "./enums";

import type {
  InvestmentAnalysisBase,
} from "./investment-analysis-base";

/**
 * Purchase underwriting result.
 *
 * This retains the current ownership-specific economics:
 * - purchase price
 * - mortgage debt service
 * - NOI
 * - cap rate
 * - DSCR
 */
export type PurchaseInvestmentAnalysis =
  InvestmentAnalysisBase<
    AcquisitionType.Purchase,
    PropertyProfile,
    InvestmentAssumptions,
    ExpenseProjection,
    FinancialPerformance
  >;

import type {
  FinancialPerformance,
} from "./financial-performance";

/**
 * Explicit purchase-model name retained as an alias so existing
 * FinancialPerformance consumers remain backward compatible.
 */
export type PurchaseFinancialPerformance =
  FinancialPerformance;

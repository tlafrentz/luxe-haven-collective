import type {
  ExpenseProjection,
} from "./expense-projection";

/**
 * Explicit purchase-model name retained as an alias so existing
 * ExpenseProjection consumers remain backward compatible.
 */
export type PurchaseExpenseProjection =
  ExpenseProjection;

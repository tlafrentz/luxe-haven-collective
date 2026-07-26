export const CASH_CLASSIFICATION_POLICY_VERSION = "cash-classification-policy-v1";
export const INTERNAL_TRANSFER_POLICY_VERSION = "internal-transfer-policy-v1";
export const CASH_RECONCILIATION_POLICY_VERSION = "cash-reconciliation-policy-v1";
export const LIQUIDITY_POLICY_VERSION = "liquidity-policy-v1";
export const CASH_FLOW_POLICY = Object.freeze({
  reconciliationToleranceMinorUnits: 1, minimumAccountCoverage: .8, minimumObligationCoverage: .8,
  minimumTransferMatchCoverage: .8, minimumRunwayHistoryMonths: 3, materialMinorUnits: 10_000,
  tightRunwayMonths: 3, criticalRunwayMonths: 1, strongReserveCoverage: 1.5,
});

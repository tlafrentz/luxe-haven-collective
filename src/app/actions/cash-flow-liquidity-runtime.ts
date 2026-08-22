import "server-only";
import { financialPeriod, type FinancialPeriodPreset } from "./financial-overview-runtime";
import {
  CashFlowLiquidityError, CashFlowLiquidityProjectionAdapter, getCashFlowLiquidity,
  SupabaseCashBalanceReader, SupabaseCashTransactionReader, SupabaseFinancialOverviewSource,
} from "@/features/financial-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export async function getCashFlowLiquidityRouteState(input: Readonly<{
  workspaceId?: string; propertyIds?: readonly string[]; accountIds?: readonly string[]; portfolioId?: string;
  periodPreset: FinancialPeriodPreset; comparisonType: "previous-period" | "previous-year" | "forecast" | "none";
  obligationHorizonDays?: 7 | 30 | 60 | 90; customFrom?: string; customTo?: string; now?: Date;
}>) {
  const startedAt = Date.now();
  try {
    const { user } = await getSessionProfile();
    if (!user) return { ok: false as const, code: "permission" as const, message: "Sign in to view cash flow." };
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input.workspaceId);
    const evaluatedAt = input.now ?? new Date();
    const periodComparison = input.comparisonType === "forecast" ? "none" : input.comparisonType;
    const period = financialPeriod(input.periodPreset, periodComparison, evaluatedAt, input.customFrom, input.customTo);
    const source = new SupabaseFinancialOverviewSource();
    const view = await getCashFlowLiquidity(new CashFlowLiquidityProjectionAdapter(access, source, source, { balances: new SupabaseCashBalanceReader(), movements: new SupabaseCashTransactionReader() }), {
      workspaceId: access.workspaceId, propertyIds: input.propertyIds, accountIds: input.accountIds,
      portfolioId: input.portfolioId, period, comparisonType: input.comparisonType,
      obligationHorizonDays: input.obligationHorizonDays, evaluatedAt: evaluatedAt.toISOString(),
    });
    console.info("cash_flow_evaluated", {
      workspaceId: access.workspaceId, scopeType: view.scope.type, authorizedPropertyCount: view.scope.propertyCount,
      authorizedCashAccountCount: view.accounts.length, reportingPeriod: `${view.period.from}:${view.period.to}`,
      comparisonType: input.comparisonType, reportingCurrency: view.reportingCurrency,
      openingBalanceAvailable: Boolean(view.position.openingCash), closingBalanceAvailable: Boolean(view.position.closingCash),
      transactionCoverage: view.evidence.transactionCoverage, transferMatchRate: view.evidence.transferMatchCoverage,
      obligationCoverage: view.evidence.obligationCoverage, reconciliationStatus: view.evidence.reconciliation,
      reservePolicyStatus: view.reserves.overallStatus, confidence: view.confidence, freshness: view.freshness,
      evaluationDurationMs: Date.now() - startedAt,
    });
    return { ok: true as const, view };
  } catch (error) {
    const code = error instanceof CashFlowLiquidityError ? error.code : error instanceof Error && error.message === "CASH_FLOW_CURRENCY_MISMATCH" ? "currency" : "unexpected";
    console.error("cash_flow_failed", { errorType: code, evaluationDurationMs: Date.now() - startedAt });
    return { ok: false as const, code, message: error instanceof Error ? error.message : "Cash Flow could not be completed. No financial data was changed." };
  }
}

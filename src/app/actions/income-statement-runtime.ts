import "server-only";
import { financialPeriod, type FinancialPeriodPreset } from "./financial-overview-runtime";
import {
  getIncomeStatement, IncomeStatementError, IncomeStatementProjectionAdapter,
  SupabaseFinancialOverviewSource,
} from "@/features/financial-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export async function getIncomeStatementRouteState(input: Readonly<{
  workspaceId?: string; propertyIds?: readonly string[]; portfolioId?: string;
  periodPreset: FinancialPeriodPreset; comparisonType: "previous-period" | "previous-year" | "none";
  customFrom?: string; customTo?: string; now?: Date;
}>) {
  const startedAt = Date.now();
  try {
    const { user } = await getSessionProfile();
    if (!user) return { ok: false as const, code: "permission" as const, message: "Sign in to view profitability." };
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input.workspaceId);
    const evaluatedAt = input.now ?? new Date();
    const period = financialPeriod(input.periodPreset, input.comparisonType, evaluatedAt, input.customFrom, input.customTo);
    const source = new SupabaseFinancialOverviewSource();
    const statement = await getIncomeStatement(new IncomeStatementProjectionAdapter(access, source, source), {
      workspaceId: access.workspaceId, propertyIds: input.propertyIds, portfolioId: input.portfolioId,
      period, comparisonType: input.comparisonType, evaluatedAt: evaluatedAt.toISOString(),
    });
    console.info("income_statement_evaluated", {
      workspaceId: access.workspaceId, scopeType: statement.scope.type, authorizedPropertyCount: statement.scope.propertyCount,
      reportingPeriod: `${statement.period.from}:${statement.period.to}`, comparisonType: input.comparisonType,
      accountingBasis: statement.accountingBasis, reportingCurrency: statement.reportingCurrency,
      projectionVersion: statement.projectionVersion, revenueCoverage: statement.evidence.revenueCoverage,
      expenseCoverage: statement.evidence.expenseCoverage, categorizationCoverage: statement.evidence.categorizationCoverage,
      confidence: statement.confidence, freshness: statement.freshness, evaluationDurationMs: Date.now() - startedAt,
    });
    return { ok: true as const, statement };
  } catch (error) {
    const code = error instanceof IncomeStatementError ? error.code : "unexpected";
    console.error("income_statement_failed", { errorType: code, evaluationDurationMs: Date.now() - startedAt });
    return { ok: false as const, code, message: error instanceof IncomeStatementError ? error.message : "Income Statement could not be completed. No financial data was changed." };
  }
}

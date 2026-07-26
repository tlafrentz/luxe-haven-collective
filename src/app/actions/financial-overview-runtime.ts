import "server-only";
import {
  FinancialOverviewError, FinancialOverviewProjectionAdapter, SupabaseFinancialOverviewSource,
  getFinancialOverview, type FinancialPeriod,
} from "@/features/financial-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export type FinancialPeriodPreset = "this-month" | "last-month" | "qtd" | "ytd" | "12m" | "custom";
export type FinancialComparisonType = "previous-period" | "previous-year" | "budget" | "forecast" | "none";

export async function getFinancialOverviewRouteState(input: Readonly<{
  workspaceId?: string; propertyIds?: readonly string[]; portfolioId?: string;
  periodPreset: FinancialPeriodPreset; comparisonType: FinancialComparisonType;
  customFrom?: string; customTo?: string; now?: Date;
}>) {
  const startedAt = Date.now();
  try {
    const { user } = await getSessionProfile();
    if (!user) return { ok: false as const, code: "permission" as const, message: "Sign in to view Financial Intelligence." };
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input.workspaceId);
    const evaluated = input.now ?? new Date();
    const period = financialPeriod(input.periodPreset, input.comparisonType, evaluated, input.customFrom, input.customTo);
    const source = new SupabaseFinancialOverviewSource();
    const reader = new FinancialOverviewProjectionAdapter(access, source, source);
    const overview = await getFinancialOverview(reader, {
      workspaceId: access.workspaceId, propertyIds: input.propertyIds, portfolioId: input.portfolioId,
      period, comparisonType: input.comparisonType, evaluatedAt: evaluated.toISOString(),
    });
    console.info("financial_overview_evaluated", {
      workspaceId: access.workspaceId, scopeType: overview.scope.type, authorizedPropertyCount: overview.scope.propertyCount,
      capabilities: { overview: true, cash: overview.metrics.find(metric => metric.metric === "cash-balance")?.availability !== "restricted" },
      reportingPeriod: `${period.from}:${period.to}`, comparisonType: input.comparisonType,
      accountingBasis: overview.accountingBasis, reportingCurrency: overview.reportingCurrency,
      projectionVersion: overview.projectionVersion, transactionCoverage: overview.evidence.accountCoverage,
      metricAvailability: overview.metrics.map(metric => `${metric.metric}:${metric.availability}`),
      confidence: overview.confidence, freshness: overview.freshness, evaluationDurationMs: Date.now() - startedAt,
    });
    return { ok: true as const, overview };
  } catch (error) {
    const typed = error instanceof FinancialOverviewError ? error.code : "unexpected";
    console.error("financial_overview_failed", { errorType: typed, evaluationDurationMs: Date.now() - startedAt });
    const message = error instanceof FinancialOverviewError ? error.message : "Financial Overview could not be completed. No financial data was changed.";
    return { ok: false as const, code: typed, message };
  }
}

export function financialPeriod(preset: FinancialPeriodPreset, comparisonType: FinancialComparisonType, now: Date, customFrom?: string, customTo?: string): FinancialPeriod {
  const today = iso(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const current = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo }
    : preset === "last-month" ? previousMonth(now)
      : preset === "qtd" ? { from: quarterStart(now), to: today }
        : preset === "ytd" ? { from: `${now.getUTCFullYear()}-01-01`, to: today }
          : preset === "12m" ? { from: iso(addDays(now, -364)), to: today }
            : { from: monthStart, to: today };
  const comparison = comparisonType === "previous-year" ? { from: addYears(current.from, -1), to: addYears(current.to, -1) }
    : comparisonType === "previous-period" ? previousRange(current.from, current.to) : undefined;
  const kind = preset === "qtd" ? "quarter" as const : preset === "ytd" || preset === "12m" ? "year" as const : preset === "custom" ? "custom" as const : "month" as const;
  return Object.freeze({ kind, ...current, ...(comparison ? { comparison } : {}), reportingCalendar: "fiscal" });
}
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setUTCDate(value.getUTCDate() + amount); return value; }
function addYears(value: string, amount: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + amount); return iso(date); }
function previousRange(from: string, to: string) { const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1; const end = addDays(new Date(`${from}T00:00:00Z`), -1); return { from: iso(addDays(end, -(days - 1))), to: iso(end) }; }
function previousMonth(now: Date) { const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)); return { from: iso(first), to: iso(last) }; }
function quarterStart(now: Date) { return iso(new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1))); }

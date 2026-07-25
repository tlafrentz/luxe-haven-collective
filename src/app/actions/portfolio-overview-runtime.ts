import "server-only";
import { buildPortfolioProjection } from "@/features/portfolio/application/read-model";
import type { PortfolioComparison, PortfolioPeriod } from "@/features/portfolio";
import {
  buildPortfolioOverview,
  SupabasePortfolioExecutionSummaryReader,
  SupabasePortfolioProjectionSource,
} from "@/features/portfolio-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export async function getPortfolioOverviewRouteState(input: Readonly<{
  workspaceId?: string;
  propertyIds?: readonly string[];
  periodPreset: "30d" | "90d" | "ytd" | "12m";
  comparisonType: PortfolioComparison;
  now?: Date;
}>) {
  const started = Date.now();
  try {
    const { user } = await getSessionProfile();
    if (!user) return { ok: false as const, code: "permission" as const, message: "Sign in to view Portfolio Intelligence." };
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input.workspaceId);
    const now = input.now ?? new Date();
    const period = portfolioPeriod(input.periodPreset, input.comparisonType, now);
    const source = new SupabasePortfolioProjectionSource();
    const projection = await buildPortfolioProjection(source, { access, workspaceId: access.workspaceId, period, propertyIds: input.propertyIds, evaluatedAt: now.toISOString(), evidenceThreshold: 1 });
    const comparison = period.comparison ? await buildPortfolioProjection(source, {
      access, workspaceId: access.workspaceId,
      period: { current: period.comparison, comparisonType: "none" },
      propertyIds: input.propertyIds, evaluatedAt: now.toISOString(), evidenceThreshold: 1,
    }) : undefined;
    const execution = projection.scope.authorization.type === "workspace"
      ? await new SupabasePortfolioExecutionSummaryReader().read(access.workspaceId, projection.scope.propertyIds).catch(() => undefined)
      : undefined;
    const overview = buildPortfolioOverview({ projection, comparison, execution, historyLengthDays: days(period.current.from, period.current.to) });
    console.info("portfolio_overview_evaluated", { workspaceId: access.workspaceId, scopeType: projection.scope.authorization.type, authorizedPropertyCount: projection.scope.propertyCount, comparisonType: period.comparisonType, durationMilliseconds: Date.now() - started, confidence: overview.confidence, freshness: overview.freshness });
    return { ok: true as const, overview };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio Overview is unavailable.";
    console.error("portfolio_overview_failed", { errorType: error instanceof Error ? error.name : "unknown", durationMilliseconds: Date.now() - started });
    return { ok: false as const, code: message.includes("access") || message.includes("Authentication") ? "permission" as const : "unavailable" as const, message: "Your workspace remains available. No portfolio data was changed." };
  }
}

export function portfolioPeriod(preset: "30d" | "90d" | "ytd" | "12m", comparisonType: PortfolioComparison, now: Date): PortfolioPeriod {
  const end = iso(now);
  const currentFrom = preset === "ytd" ? `${now.getUTCFullYear()}-01-01` : iso(addDays(now, preset === "30d" ? -29 : preset === "90d" ? -89 : -364));
  const length = days(currentFrom, end);
  const comparison = comparisonType === "none" ? undefined : comparisonType === "previous-year"
    ? { from: iso(addYears(new Date(`${currentFrom}T00:00:00Z`), -1)), to: iso(addYears(now, -1)) }
    : { from: iso(addDays(new Date(`${currentFrom}T00:00:00Z`), -length)), to: iso(addDays(new Date(`${currentFrom}T00:00:00Z`), -1)) };
  return Object.freeze({ current: { from: currentFrom, to: end }, comparison, comparisonType });
}
function iso(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: Date, amount: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + amount); return result; }
function addYears(value: Date, amount: number) { const result = new Date(value); result.setUTCFullYear(result.getUTCFullYear() + amount); return result; }
function days(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1; }

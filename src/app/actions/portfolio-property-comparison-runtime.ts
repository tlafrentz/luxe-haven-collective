import "server-only";
import { buildPortfolioProjection } from "@/features/portfolio/application/read-model";
import type { PortfolioComparison } from "@/features/portfolio";
import {
  getPortfolioPropertyComparison,
  comparisonCapabilitiesForRole,
  SupabasePortfolioProjectionSource,
  SupabasePropertyComparisonContextReader,
  type PropertyComparisonView,
  type PropertyGrouping,
  type PropertyMetricFamily,
  type PropertyNormalization,
} from "@/features/portfolio-intelligence";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";
import { portfolioPeriod } from "./portfolio-overview-runtime";

export async function getPortfolioPropertyComparisonRouteState(input: Readonly<{
  workspaceId?: string; propertyIds?: readonly string[]; periodPreset: "30d" | "90d" | "ytd" | "12m";
  comparisonType: PortfolioComparison; metricFamily: PropertyMetricFamily; normalization: PropertyNormalization;
  grouping: PropertyGrouping; view: PropertyComparisonView; selectedPropertyId?: string;
  sortBy?: "name" | "revenue" | "revenue-change" | "occupancy" | "revpar" | "burden" | "confidence";
  sortDirection?: "ascending" | "descending"; now?: Date;
}>) {
  const started = Date.now();
  try {
    const { user } = await getSessionProfile();
    if (!user) return { ok: false as const, code: "permission" as const, message: "Sign in to compare portfolio properties." };
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input.workspaceId);
    const now = input.now ?? new Date();
    const period = portfolioPeriod(input.periodPreset, input.comparisonType, now);
    const source = new SupabasePortfolioProjectionSource();
    const projection = await buildPortfolioProjection(source, { access, workspaceId: access.workspaceId, period, propertyIds: input.propertyIds, evaluatedAt: now.toISOString(), evidenceThreshold: 1 });
    const comparison = period.comparison ? await buildPortfolioProjection(source, {
      access, workspaceId: access.workspaceId, period: { current: period.comparison, comparisonType: "none" },
      propertyIds: input.propertyIds, evaluatedAt: now.toISOString(), evidenceThreshold: 1,
    }) : undefined;
    const contexts = await new SupabasePropertyComparisonContextReader().read(access.workspaceId, projection.scope.propertyIds, period.current);
    const model = getPortfolioPropertyComparison({
      projection, comparison, capabilities: comparisonCapabilitiesForRole(access.role),
      contexts,
      selectedPropertyId: input.selectedPropertyId, metricFamily: input.metricFamily,
      normalization: input.normalization, grouping: input.grouping, view: input.view,
      sortBy: input.sortBy, sortDirection: input.sortDirection,
    });
    console.info("portfolio_property_comparison_evaluated", {
      workspaceId: access.workspaceId, authorizedPropertyCount: projection.scope.propertyCount,
      eligiblePropertyCounts: Object.fromEntries(model.rankings.map(({ metric, eligiblePropertyCount }) => [metric, eligiblePropertyCount])),
      comparisonType: input.comparisonType, metricFamily: input.metricFamily, normalization: input.normalization,
      durationMilliseconds: Date.now() - started, freshness: model.freshness, confidence: model.confidence,
      projectionVersion: "portfolio-projection-v1",
    });
    return { ok: true as const, comparison: model };
  } catch (error) {
    console.error("portfolio_property_comparison_failed", { errorType: error instanceof Error ? error.name : "unknown", durationMilliseconds: Date.now() - started });
    return { ok: false as const, code: "unavailable" as const, message: "Your workspace remains available. No comparison data was changed." };
  }
}

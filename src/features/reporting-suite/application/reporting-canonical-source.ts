import "server-only";
import {
  buildPortfolioProjection,
  type BuildPortfolioProjectionQuery,
} from "@/features/portfolio/application/read-model";
import { SupabasePortfolioProjectionSource } from "@/features/portfolio-intelligence";
import {
  REPORT_METRIC_SOURCE_MATRIX,
  type CanonicalReportScope,
  type CanonicalReportSourceData,
} from "@/platform/reporting";

type ReportingPeriod = Readonly<{
  startDate: string;
  endDate: string;
}>;

export async function loadCanonicalReportingSource(input: {
  scope: CanonicalReportScope;
  period: ReportingPeriod;
  comparisonPeriod?: ReportingPeriod;
  access: BuildPortfolioProjectionQuery["access"];
}): Promise<CanonicalReportSourceData> {
  if (
    input.scope.kind === "investment_opportunity" ||
    input.scope.kind === "investment_comparison"
  )
    return unavailableInvestmentSource(input.scope);

  const propertyIds =
      input.scope.kind === "property"
        ? [input.scope.propertyId]
        : "propertyIds" in input.scope
          ? input.scope.propertyIds
          : undefined,
    source = new SupabasePortfolioProjectionSource(),
    current = await buildPortfolioProjection(source, {
      access: input.access,
      workspaceId: input.scope.tenantId,
      period: {
        current: {
          from: input.period.startDate,
          to: input.period.endDate,
        },
        comparisonType: "none",
      },
      ...(propertyIds ? { propertyIds } : {}),
      evidenceThreshold: 1,
    }),
    comparison = input.comparisonPeriod
      ? await buildPortfolioProjection(source, {
          access: input.access,
          workspaceId: input.scope.tenantId,
          period: {
            current: {
              from: input.comparisonPeriod.startDate,
              to: input.comparisonPeriod.endDate,
            },
            comparisonType: "none",
          },
          ...(propertyIds ? { propertyIds } : {}),
          evidenceThreshold: 1,
        })
      : undefined;

  return {
    metrics: mapPortfolioProjectionToReportSourceMetrics(current),
    ...(comparison
      ? {
          comparisonMetrics:
            mapPortfolioProjectionToReportSourceMetrics(comparison),
        }
      : {}),
  };
}

export function mapPortfolioProjectionToReportSourceMetrics(
  projection: Awaited<ReturnType<typeof buildPortfolioProjection>>,
): CanonicalReportSourceData["metrics"] {
  const values: Record<string, number | null> = {
      "gross-revenue": projection.performance.grossRevenue,
      "occupancy-rate": projection.performance.occupancy,
      "average-daily-rate": projection.performance.adr,
      revpar: projection.performance.revpar,
      "total-bookings": projection.performance.bookingCount,
    },
    freshness = {
      status:
        projection.freshness === "current"
          ? ("current" as const)
          : projection.freshness === "unknown"
            ? ("unknown" as const)
            : ("stale" as const),
      observedAt: projection.generatedAt,
      retrievedAt: projection.generatedAt,
    },
    lineage = projection.evidence.items.map((item) => ({
      sourceType:
        item.kind === "bookings"
          ? ("booking_record" as const)
          : ("platform_metric" as const),
      sourceId: item.id,
      observedAt: item.observedAt,
      retrievedAt: projection.generatedAt,
    }));

  return Object.fromEntries(
    REPORT_METRIC_SOURCE_MATRIX.map((metric) => {
      const value = values[metric.metricKey];
      return [
        metric.metricKey,
        value !== undefined && value !== null
          ? { status: "available" as const, value, freshness, lineage }
          : {
              status: "missing" as const,
              freshness,
              lineage,
              reasonCode: "CANONICAL_SOURCE_UNAVAILABLE",
            },
      ];
    }),
  );
}

function unavailableInvestmentSource(
  scope: Extract<
    CanonicalReportScope,
    { kind: "investment_opportunity" | "investment_comparison" }
  >,
): CanonicalReportSourceData {
  const versionIds =
      scope.kind === "investment_opportunity"
        ? [scope.analysisVersionId]
        : scope.analysisVersionIds,
    lineage = versionIds.map((sourceVersionId) => ({
      sourceType: "investment_analysis" as const,
      sourceVersionId,
    }));
  return {
    metrics: Object.fromEntries(
      REPORT_METRIC_SOURCE_MATRIX.map((metric) => [
        metric.metricKey,
        {
          status: "missing" as const,
          freshness: { status: "unknown" as const },
          lineage,
          reasonCode: "CANONICAL_SOURCE_UNAVAILABLE",
        },
      ]),
    ),
  };
}

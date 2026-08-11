"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCanonicalReport,
  getGenerationOptions,
  requireReportingContext,
} from "@/features/reporting-suite/application/reporting-workspace-composition";
import {
  REPORT_METRIC_SOURCE_MATRIX,
  ReportFoundationError,
  ReportGenerator,
  SupabaseCanonicalReportRepository,
  normalizeCustomReportConfiguration,
  type CanonicalReportScope as ReportScope,
  type CanonicalReportSourceData as ReportSourceData,
} from "@/platform/reporting";

export async function generateCanonicalReportAction(form: FormData) {
  const options = await getGenerationOptions();
  if (!options) redirect("/login");
  const definitionId = String(form.get("definitionId") ?? ""),
    definition = options.definitions.find(
      (item) => item.definition.definitionId === definitionId,
    )?.definition;
  if (!definition)
    throw new ReportFoundationError(
      "REPORT_SCOPE_FORBIDDEN",
      "This report is unavailable.",
    );
  const scope = parseScope(form, definitionId, options.access.workspaceId),
    period = {
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      timezone: String(form.get("timezone") ?? "America/Chicago"),
    };
  const comparison = form.get("comparisonStartDate")
    ? {
        kind: "custom" as const,
        startDate: String(form.get("comparisonStartDate")),
        endDate: String(form.get("comparisonEndDate")),
        timezone: period.timezone,
      }
    : undefined;
  const admin = createAdminClient(),
    repository = new SupabaseCanonicalReportRepository(admin);
  const generator = new ReportGenerator({
    repository,
    authorization: {
      authorize: async ({ scope: requested }) => {
        const requestedIds =
            requested.kind === "property"
              ? [requested.propertyId]
              : "propertyIds" in requested
                ? requested.propertyIds
                : [],
          allowedIds = options.properties.map((item) => item.id),
          investmentAllowed =
            requested.kind === "investment_opportunity"
              ? options.analyses.some(
                  (item) =>
                    item.id === requested.analysisVersionId &&
                    item.opportunity_id === requested.opportunityId,
                )
              : requested.kind === "investment_comparison"
                ? requested.analysisVersionIds.length >= 2 &&
                  requested.analysisVersionIds.every((id, index) =>
                    options.analyses.some(
                      (item) =>
                        item.id === id &&
                        item.opportunity_id === requested.opportunityIds[index],
                    ),
                  )
                : true;
        return {
          allowed:
            requested.tenantId === options.access.workspaceId &&
            requestedIds.every((id) => allowedIds.includes(id)) &&
            investmentAllowed,
          authorizedPropertyIds: requestedIds.length
            ? requestedIds
            : allowedIds,
        };
      },
    },
    providers: {
      get: () => ({ load: async (input) => sourceFor(input.scope) }),
    },
  });
  const title = String(form.get("title") ?? "") || definition.title,
    sectionKeys = form.getAll("sectionKeys").map(String);
  const customConfiguration =
    definition.family === "custom"
      ? normalizeCustomReportConfiguration({
          title,
          introductoryNote:
            String(form.get("introductoryNote") ?? "") || undefined,
          visibility:
            String(form.get("visibility") ?? "internal") === "owner_safe"
              ? "owner_safe"
              : "internal",
          scopeKind: scope.kind,
          sections: sectionKeys.map((sectionKey, order) => ({
            sectionKey,
            order,
            metricKeys: form.getAll(`metricKeys:${sectionKey}`).map(String),
          })),
          presentation: {
            includeCoverPage: true,
            includeTableOfContents: true,
            includeDataQualitySection: true,
            includeLineageAppendix:
              form.get("includeLineageAppendix") !== "false",
          },
        })
      : undefined;
  const result = await generator.execute(
    {
      definitionId,
      scope,
      period,
      ...(comparison ? { comparisonPeriod: comparison } : {}),
      title,
      ...(customConfiguration ? { customConfiguration } : {}),
      idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
    },
    options.actor,
  );
  revalidatePath("/dashboard/reports");
  redirect(
    `/dashboard/reports/${result.reportId}/versions/${result.versionId}`,
  );
}
export async function archiveCanonicalReportAction(form: FormData) {
  const context = await requireReportingContext();
  if (!context) redirect("/login");
  const id = String(form.get("reportId") ?? ""),
    model = await getCanonicalReport(id),
    options = await getGenerationOptions();
  if (
    !model ||
    !options?.definitions.some(
      (item) => item.definition.definitionId === model.version.definitionId,
    )
  )
    throw new ReportFoundationError(
      "REPORT_SCOPE_FORBIDDEN",
      "This report is unavailable.",
    );
  const operation = String(form.get("operation") ?? "archive"),
    repository = new SupabaseCanonicalReportRepository(createAdminClient());
  if (operation === "restore")
    await repository.restoreReport(id, context.actor);
  else await repository.archiveReport(id, context.actor);
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reports/${id}`);
}
export async function regenerateCanonicalReportAction(form: FormData) {
  const reportId = String(form.get("reportId") ?? ""),
    model = await getCanonicalReport(reportId),
    options = await getGenerationOptions();
  if (
    !model ||
    !options ||
    !options.definitions.some(
      (item) => item.definition.definitionId === model.version.definitionId,
    )
  )
    throw new ReportFoundationError(
      "REPORT_SCOPE_FORBIDDEN",
      "This report is unavailable.",
    );
  const generator = createGenerator(options),
    normalized = (
      model.version.snapshot as
        | {
            generation?: {
              normalizedRequest?: {
                customConfiguration?: Record<string, unknown>;
              };
            };
          }
        | undefined
    )?.generation?.normalizedRequest;
  const result = await generator.regenerate(
    reportId,
    {
      definitionId: model.version.definitionId,
      definitionVersion: model.version.definitionVersion,
      scope: model.version.scope,
      period: model.version.period,
      ...(model.version.comparisonPeriod
        ? { comparisonPeriod: model.version.comparisonPeriod }
        : {}),
      title: model.version.title,
      ...(normalized?.customConfiguration
        ? { customConfiguration: normalized.customConfiguration }
        : {}),
      idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
    },
    options.actor,
  );
  revalidatePath(`/dashboard/reports/${reportId}`);
  redirect(`/dashboard/reports/${reportId}/versions/${result.versionId}`);
}
function parseScope(
  form: FormData,
  definitionId: string,
  tenantId: string,
): ReportScope {
  const propertyIds = form.getAll("propertyIds").map(String).filter(Boolean);
  if (definitionId === "custom.report.v1")
    return propertyIds.length === 1
      ? { kind: "property", tenantId, propertyId: propertyIds[0]! }
      : propertyIds.length > 1
        ? { kind: "selected_properties", tenantId, propertyIds }
        : { kind: "portfolio", tenantId };
  if (
    definitionId === "executive.performance-brief.v1" ||
    definitionId === "operations.performance-report.v1"
  )
    return propertyIds.length
      ? { kind: "selected_properties", tenantId, propertyIds }
      : { kind: "portfolio", tenantId };
  if (definitionId === "owner.performance-report.v1") {
    const ownerId = String(form.get("ownerId") ?? "");
    return propertyIds.length > 1
      ? { kind: "owner_portfolio", tenantId, ownerId, propertyIds }
      : { kind: "property", tenantId, propertyId: propertyIds[0] ?? "" };
  }
  const selected = form
      .getAll("analysisSelections")
      .map(String)
      .map((value) => value.split("|", 2)),
    opportunityIds = selected.map((item) => item[0] ?? ""),
    analysisVersionIds = selected.map((item) => item[1] ?? "");
  return definitionId === "investment.comparison-report.v1"
    ? {
        kind: "investment_comparison",
        tenantId,
        opportunityIds,
        analysisVersionIds,
      }
    : {
        kind: "investment_opportunity",
        tenantId,
        opportunityId: opportunityIds[0] ?? "",
        analysisVersionId: analysisVersionIds[0] ?? "",
      };
}
function sourceFor(scope: ReportScope): ReportSourceData {
  const analysisIds =
    scope.kind === "investment_opportunity"
      ? [scope.analysisVersionId]
      : scope.kind === "investment_comparison"
        ? scope.analysisVersionIds
        : [];
  const lineage = analysisIds.map((sourceVersionId) => ({
    sourceType: "investment_analysis" as const,
    sourceVersionId,
  }));
  return {
    metrics: Object.fromEntries(
      REPORT_METRIC_SOURCE_MATRIX.map((metric) => [
        metric.metricKey,
        {
          status: "missing",
          freshness: { status: "unknown" },
          lineage,
          reasonCode: "CANONICAL_SOURCE_UNAVAILABLE",
        },
      ]),
    ),
  };
}
function createGenerator(
  options: NonNullable<Awaited<ReturnType<typeof getGenerationOptions>>>,
) {
  const repository = new SupabaseCanonicalReportRepository(createAdminClient());
  return new ReportGenerator({
    repository,
    authorization: {
      authorize: async ({ scope: requested }) => {
        const requestedIds =
            requested.kind === "property"
              ? [requested.propertyId]
              : "propertyIds" in requested
                ? requested.propertyIds
                : [],
          allowedIds = options.properties.map((item) => item.id),
          investmentAllowed =
            requested.kind === "investment_opportunity"
              ? options.analyses.some(
                  (item) =>
                    item.id === requested.analysisVersionId &&
                    item.opportunity_id === requested.opportunityId,
                )
              : requested.kind === "investment_comparison"
                ? requested.analysisVersionIds.length >= 2 &&
                  requested.analysisVersionIds.every((id, index) =>
                    options.analyses.some(
                      (item) =>
                        item.id === id &&
                        item.opportunity_id === requested.opportunityIds[index],
                    ),
                  )
                : true;
        return {
          allowed:
            requested.tenantId === options.access.workspaceId &&
            requestedIds.every((id) => allowedIds.includes(id)) &&
            investmentAllowed,
          authorizedPropertyIds: requestedIds.length
            ? requestedIds
            : allowedIds,
        };
      },
    },
    providers: {
      get: () => ({ load: async (input) => sourceFor(input.scope) }),
    },
  });
}

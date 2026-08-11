import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  standardReportCatalog,
  type CanonicalReport as Report,
  type CanonicalReportActor as ReportActor,
  type CanonicalReportVersion as ReportVersion,
} from "@/platform/reporting";
import {
  definitionAvailability,
  definitionsForRole,
  toLibraryItem,
} from "./view-models";
import {
  getReportingProductionConfiguration,
  reportingCapabilities,
} from "./reporting-production-configuration";

export async function requireReportingContext() {
  if (!getReportingProductionConfiguration().reportingEnabled) return null;
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser();
  if (!user) return null;
  const teams = new SupabaseTeamAccessRepository(),
    access = await teams.resolve(user.id);
  if (!access || access.status !== "active") return null;
  const listed = await teams.properties(access),
    allowed =
      access.propertyAccess.type === "selected"
        ? new Set(access.propertyAccess.propertyIds)
        : null,
    properties = listed.filter((item) => !allowed || allowed.has(item.id));
  const permissions =
    access.role === "owner"
      ? ["reports.owner.read", "reports.custom.read"]
      : standardReportCatalog.definitions.map(
          (item) => item.requiredPermissions[0]!,
        );
  return Object.freeze({
    client,
    user,
    access,
    actor: {
      userId: user.id,
      tenantId: access.workspaceId,
      authenticated: true,
    } satisfies ReportActor,
    properties,
    permissions,
    capabilities: reportingCapabilities(),
  });
}

export async function getGenerationOptions() {
  const context = await requireReportingContext();
  if (!context) return null;
  const { data: opportunities } = await context.client
    .from("investment_opportunities")
    .select("id,name")
    .order("updated_at", { ascending: false })
    .limit(100);
  const ids = (opportunities ?? []).map((item) => item.id),
    { data: analyses } = ids.length
      ? await context.client
          .from("investment_opportunity_analyses")
          .select("id,opportunity_id,sequence,route,created_at,result_snapshot")
          .in("opportunity_id", ids)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] };
  const definitions = definitionsForRole(
    context.access.role,
    context.permissions,
  ).map((definition) => ({
    definition,
    availability: definitionAvailability(
      definition,
      context.properties.length,
      analyses?.length ?? 0,
    ),
  }));
  return Object.freeze({
    ...context,
    definitions: definitions.filter(
      (item) =>
        item.definition.family !== "custom" ||
        reportingCapabilities().customReportsAvailable,
    ),
    opportunities: opportunities ?? [],
    analyses: analyses ?? [],
    capabilities: reportingCapabilities(),
  });
}

export async function getReportLibrary(
  input: Readonly<{
    includeArchived?: boolean;
    q?: string;
    type?: string;
    status?: string;
    sort?: string;
    page?: number;
  }> = {},
) {
  const context = await requireReportingContext();
  if (!context) return null;
  const page = Math.max(1, input.page ?? 1),
    size = 25;
  let query = context.client
    .from("canonical_reports")
    .select("*")
    .eq("workspace_id", context.access.workspaceId)
    .range((page - 1) * size, page * size - 1);
  if (!input.includeArchived) query = query.is("archived_at", null);
  if (input.type) query = query.eq("definition_id", input.type);
  if (input.q?.trim())
    query = query.ilike(
      "definition_id",
      `%${input.q.replace(/[%_,()]/g, "")}%`,
    );
  query = query.order(input.sort === "title" ? "definition_id" : "created_at", {
    ascending: input.sort === "oldest" || input.sort === "title",
  });
  const { data: reportRows, error } = await query;
  if (error)
    return Object.freeze({
      ...context,
      definitions: definitionsForRole(context.access.role, context.permissions),
      items: [],
      unavailable: true,
      message: "Reporting storage is not available in this environment.",
    });
  const reportIds = (reportRows ?? []).map((row) => row.id),
    { data: versionRows } = reportIds.length
      ? await context.client
          .from("canonical_report_versions")
          .select("*")
          .in("report_id", reportIds)
          .order("version_number", { ascending: false })
      : { data: [] };
  const versions = (versionRows ?? []).map(mapVersion),
    latest = new Map<string, ReportVersion>();
  for (const version of versions)
    if (!latest.has(version.reportId)) latest.set(version.reportId, version);
  const items = (reportRows ?? [])
    .map(mapReport)
    .flatMap((report) =>
      latest.get(report.reportId)
        ? [toLibraryItem(report, latest.get(report.reportId)!)]
        : [],
    )
    .filter(
      (item) => !input.status || item.latestVersion.status === input.status,
    );
  return Object.freeze({
    ...context,
    definitions: definitionsForRole(context.access.role, context.permissions),
    items,
    unavailable: false,
    message: undefined,
  });
}

export async function getCanonicalReport(reportId: string, versionId?: string) {
  const context = await requireReportingContext();
  if (!context) return null;
  const { data: reportRow } = await context.client
    .from("canonical_reports")
    .select("*")
    .eq("workspace_id", context.access.workspaceId)
    .eq("id", reportId)
    .maybeSingle();
  if (!reportRow) return null;
  const { data: rows } = await context.client
    .from("canonical_report_versions")
    .select("*")
    .eq("workspace_id", context.access.workspaceId)
    .eq("report_id", reportId)
    .order("version_number", { ascending: false });
  const versions = (rows ?? []).map(mapVersion),
    selected = versionId
      ? versions.find((item) => item.reportVersionId === versionId)
      : (versions.find((item) => item.status === "ready") ?? versions[0]);
  if (
    selected &&
    !definitionsForRole(context.access.role, context.permissions).some(
      (definition) => definition.definitionId === selected.definitionId,
    )
  )
    return null;
  if (!selected) return null;
  const { data: exportRows } = await context.client
    .from("canonical_report_exports")
    .select(
      "id,format,status,requested_at,completed_at,expires_at,failure_code,failure_message,file_name,byte_size,renderer_version",
    )
    .eq("workspace_id", context.access.workspaceId)
    .eq("report_version_id", selected.reportVersionId)
    .order("requested_at", { ascending: false });
  return Object.freeze({
    ...context,
    report: mapReport(reportRow),
    version: selected,
    versions,
    exports: (exportRows ?? []).map((row) => ({
      id: String(row.id),
      format: String(row.format),
      status: String(row.status),
      requestedAt: String(row.requested_at),
      ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
      ...(row.expires_at ? { expiresAt: String(row.expires_at) } : {}),
      ...(row.failure_code ? { failureCode: String(row.failure_code) } : {}),
      ...(row.failure_message
        ? { failureMessage: String(row.failure_message) }
        : {}),
      ...(row.file_name ? { fileName: String(row.file_name) } : {}),
      ...(row.byte_size != null ? { byteSize: Number(row.byte_size) } : {}),
      rendererVersion: String(row.renderer_version),
    })),
  });
}

function mapReport(row: Record<string, unknown>): Report {
  return {
    reportId: String(row.id),
    tenantId: String(row.workspace_id),
    family: row.family as Report["family"],
    reportType: String(row.report_type),
    definitionId: String(row.definition_id),
    createdBy: String(row.created_by_profile_id),
    createdAt: String(row.created_at),
    ...(row.archived_at ? { archivedAt: String(row.archived_at) } : {}),
  };
}
function mapVersion(row: Record<string, unknown>): ReportVersion {
  return {
    reportId: String(row.report_id),
    reportVersionId: String(row.id),
    versionNumber: Number(row.version_number),
    definitionId: String(row.definition_id),
    definitionVersion: Number(row.definition_version),
    family: row.family as ReportVersion["family"],
    reportType: String(row.report_type),
    title: String(row.title),
    tenantId: String(row.workspace_id),
    requestedBy: String(row.requested_by_profile_id),
    scope: row.scope_snapshot as ReportVersion["scope"],
    authorizedPropertyIds: (row.property_ids as string[] | null) ?? [],
    status: row.status as ReportVersion["status"],
    period: row.period_snapshot as ReportVersion["period"],
    ...(row.comparison_period_snapshot
      ? {
          comparisonPeriod:
            row.comparison_period_snapshot as ReportVersion["comparisonPeriod"],
        }
      : {}),
    ...(row.content_snapshot
      ? { snapshot: row.content_snapshot as ReportVersion["snapshot"] }
      : {}),
    requestedAt: String(row.requested_at),
    ...(row.generation_started_at
      ? { generationStartedAt: String(row.generation_started_at) }
      : {}),
    ...(row.generated_at ? { generatedAt: String(row.generated_at) } : {}),
    ...(row.failure_code ? { failureCode: String(row.failure_code) } : {}),
    ...(row.failure_message
      ? { failureMessage: String(row.failure_message) }
      : {}),
  };
}

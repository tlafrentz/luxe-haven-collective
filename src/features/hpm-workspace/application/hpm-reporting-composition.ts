import { createHpmReportExport, createHpmReportService, getHpmReportDefinition, listHpmReportDefinitions, projectHpmOperationalHealth, type HpmReportExport, type HpmReportKey, type HpmReportResult } from "@/platform/hpm";
import type { HpmWorkspaceQuery } from "./hpm-workspace-context";
import { getHpmWorkspaceProjection } from "./hpm-workspace-composition";

export type HpmReportingResult = Readonly<{ ok: true; report: HpmReportResult; workspace: Extract<Awaited<ReturnType<typeof getHpmWorkspaceProjection>>, { ok: true }>["value"] } | { ok: false; code: string; message: string; correlationId: string }>;

export async function listAuthorizedHpmReports(query: HpmWorkspaceQuery) {
  const workspace = await getHpmWorkspaceProjection(query);
  if (!workspace.ok) return workspace;
  if (!workspace.value.features.reports) return { ok: false as const, code: "HPM_REPORT_ACCESS_DENIED", message: "HPM standard reports are not enabled for this environment.", correlationId: workspace.value.correlationId };
  return { ok: true as const, definitions: listHpmReportDefinitions(query.scopeType), workspace: workspace.value };
}

export async function runAuthorizedHpmReport(query: HpmWorkspaceQuery, reportKey: HpmReportKey): Promise<HpmReportingResult> {
  const workspace = await getHpmWorkspaceProjection(query);
  if (!workspace.ok) return workspace;
  if (!workspace.value.features.reports) return { ok: false, code: "HPM_REPORT_ACCESS_DENIED", message: "HPM standard reports are not enabled for this environment.", correlationId: workspace.value.correlationId };
  const definition = getHpmReportDefinition(reportKey);
  if (!definition) return { ok: false, code: "HPM_REPORT_NOT_FOUND", message: "The requested HPM report is unavailable.", correlationId: workspace.value.correlationId };
  const result = createHpmReportService().run({ request: { reportKey, actor: workspace.value.actor, scope: workspace.value.lifecycle.scope, dateMode: "period", from: `${query.from}T00:00:00.000Z`, to: `${query.to}T23:59:59.999Z`, timeZone: workspace.value.lifecycle.scope.timeZone, asOf: query.asOf, filters: {}, dimensions: [], locale: "en-US", currency: "USD", correlationId: workspace.value.correlationId }, lifecycle: workspace.value.lifecycle, attention: workspace.value.attention });
  return result.ok ? { ok: true, report: result.report, workspace: workspace.value } : result;
}

export async function exportAuthorizedHpmReport(query: HpmWorkspaceQuery, reportKey: HpmReportKey, format: "csv" | "print"): Promise<Readonly<{ ok: true; export: HpmReportExport } | { ok: false; code: string; message: string; correlationId: string }>> {
  const result = await runAuthorizedHpmReport(query, reportKey);
  if (!result.ok) return result;
  if (!result.workspace.features.exports) return { ok: false, code: "HPM_EXPORT_NOT_ALLOWED", message: "HPM report exports are not enabled for this environment.", correlationId: result.workspace.correlationId };
  return { ok: true, export: createHpmReportExport(result.report, format) };
}

export async function getAuthorizedHpmOperationalHealth(query: HpmWorkspaceQuery) {
  const workspace = await getHpmWorkspaceProjection(query);
  if (!workspace.ok) return workspace;
  if (!workspace.value.features.operationalHealth || !workspace.value.actor.roleIds.some((role) => ["owner", "administrator", "admin"].includes(role))) return { ok: false as const, code: "HPM_REPORT_ACCESS_DENIED", message: "HPM operational health is unavailable for this actor.", correlationId: workspace.value.correlationId };
  return { ok: true as const, health: projectHpmOperationalHealth({ lifecycle: workspace.value.lifecycle, flags: { reports: workspace.value.features.reports, exports: workspace.value.features.exports, health: workspace.value.features.operationalHealth, operations: workspace.value.features.operationalCommands } }), workspace: workspace.value };
}

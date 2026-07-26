import type {
  GeneratedReport,
  ReportDefinition,
  ReportGenerationJob,
  ReportProjection,
  ReportRequest,
  ReportScope,
  ReportSectionSnapshot,
  ReportShare,
  ReportTemplate,
  ReportType,
} from "../domain";
import { ReportingError } from "../domain";

export const REPORT_SNAPSHOT_SCHEMA_VERSION = "report-snapshot.v1";
export const REPORT_RENDERER_VERSION = "luxe-haven-html.v1";

const definitions: readonly ReportDefinition[] = [
  definition("investment-decision", ["investment-scenario"], false, "investment.reports.generate", "investment-report-projection.v1", ["decision-summary","property-profile","market-intelligence","financial-performance","risk-analysis","investment-score","recommendation","evidence-methodology"], "allowed"),
  definition("property-performance", ["property"], true, "reports.generate", "property-report-projection.v1", ["performance-summary","revenue-metrics","booking-trends","operational-attention","evidence-methodology"], "workspace-policy"),
  definition("portfolio-performance", ["portfolio","workspace"], true, "portfolio.reports.generate", "portfolio-report-projection.v1", ["portfolio-condition","primary-metrics","property-contribution","risks-opportunities","evidence-methodology"], "workspace-policy"),
  definition("financial-performance", ["financial-scope"], true, "financial.reports.generate", "financial-report-projection.v1", ["financial-condition","income-statement","cash-flow","liquidity","budget-forecast","evidence-methodology"], "disabled"),
];

export const reportDefinitions = Object.freeze(definitions);

export function getReportDefinition(type: ReportType) {
  return definitions.find((item) => item.key === type) ?? null;
}

export function validateReportRequest(input: {
  request: ReportRequest;
  template: ReportTemplate;
  authorizedWorkspaceId: string;
  hasEntitlement: boolean;
}) {
  const definitionValue = getReportDefinition(input.request.reportType);
  if (!definitionValue) throw new ReportingError("report_definition_not_found", "The report definition is unavailable.");
  if (input.request.workspaceId !== input.authorizedWorkspaceId || input.request.scope.workspaceId !== input.authorizedWorkspaceId) throw new ReportingError("report_permission_denied", "The report scope is not authorized.");
  if (!definitionValue.supportedScopes.includes(input.request.scope.type)) throw new ReportingError("report_scope_invalid", "The selected scope is incompatible with this report.");
  if (definitionValue.supportsPeriods && !input.request.period) throw new ReportingError("report_scope_invalid", "A reporting period is required.");
  if (input.request.reportType === "investment-decision" && (!input.request.scope.opportunityId || !input.request.scope.scenarioId)) throw new ReportingError("report_source_not_ready", "A calculated Investment Scenario is required.");
  if (!input.hasEntitlement) throw new ReportingError("report_entitlement_required", definitionValue.requiredEntitlementKey);
  if (input.template.reportType !== input.request.reportType || input.template.status !== "active") throw new ReportingError("report_template_inactive", "The selected template is not active for this report type.");
  const omitted = new Set(input.request.sectionConfiguration.filter((item) => !item.included).map((item) => item.key));
  if (definitionValue.requiredSections.some((key) => omitted.has(key))) throw new ReportingError("report_projection_invalid", "Required report sections cannot be omitted.");
  return Object.freeze({ definition: definitionValue, template: input.template });
}

export function validateReportProjection(projection: ReportProjection, definitionValue: ReportDefinition) {
  if (projection.reportType !== definitionValue.key || !definitionValue.supportedScopes.includes(projection.scope.type)) throw new ReportingError("report_projection_invalid", "Projection identity is incompatible with the report definition.");
  const keys = new Set(projection.sections.filter((section) => section.status === "included").map((section) => section.key));
  if (definitionValue.requiredSections.some((key) => !keys.has(key))) throw new ReportingError("report_projection_invalid", "The projection is missing a required section.");
  if (!projection.projectionVersion || !projection.sourceVersions.length || !projection.evaluatedAt) throw new ReportingError("report_projection_invalid", "Projection lineage is incomplete.");
  return projection;
}

export function createGeneratedReport(input: {
  id: string;
  reportNumber: string;
  request: ReportRequest;
  projection: ReportProjection;
  template: ReportTemplate;
  versionNumber: number;
  seriesKey: string;
  supersedesReportId?: string;
  generatedAt: string;
  maximumSnapshotBytes?: number;
}): GeneratedReport {
  const serialized = JSON.stringify(input.projection);
  if (new TextEncoder().encode(serialized).byteLength > (input.maximumSnapshotBytes ?? 2_000_000)) throw new ReportingError("report_snapshot_too_large", "The report snapshot exceeds the configured limit.");
  const report: GeneratedReport = {
    id: input.id, reportNumber: input.reportNumber, workspaceId: input.request.workspaceId,
    generatedByProfileId: input.request.requestedByProfileId, reportType: input.request.reportType,
    status: "generated", title: input.request.title?.trim() || input.projection.title,
    ...(input.request.subtitle?.trim() || input.projection.subtitle ? { subtitle: input.request.subtitle?.trim() || input.projection.subtitle } : {}),
    scopeSnapshot: clone(input.projection.scope),
    ...(input.projection.period ? { periodSnapshot: clone(input.projection.period) } : {}),
    sourceContextSnapshot: clone(input.request.sourceContext), projectionSnapshot: clone(input.projection),
    snapshotSchemaVersion: REPORT_SNAPSHOT_SCHEMA_VERSION, templateId: input.template.id,
    templateVersion: input.template.version, projectionVersion: input.projection.projectionVersion,
    sourceVersions: clone(input.projection.sourceVersions), confidence: input.projection.confidence,
    freshness: input.projection.freshness, versionNumber: input.versionNumber, seriesKey: input.seriesKey,
    ...(input.supersedesReportId ? { supersedesReportId: input.supersedesReportId } : {}),
    generatedAt: input.generatedAt,
  };
  return deepFreeze(report);
}

export function transitionReportStatus(current: GeneratedReport["status"], next: GeneratedReport["status"]) {
  const transitions: Record<GeneratedReport["status"], readonly GeneratedReport["status"][]> = {
    draft: ["queued"], queued: ["generating","generation-failed"], generating: ["generated","generation-failed"],
    generated: ["published","archived","superseded"], "generation-failed": ["queued","archived"],
    published: ["archived","superseded"], archived: ["generated","published"], superseded: ["archived"],
  };
  if (!transitions[current].includes(next)) throw new ReportingError("report_generation_conflict", `Report cannot transition from ${current} to ${next}.`);
  return next;
}

export function evaluateShareAccess(share: ReportShare, now = new Date()) {
  if (share.status === "revoked") throw new ReportingError("report_share_revoked", "This report share was revoked.");
  if (share.status === "expired" || (share.expiresAt && new Date(share.expiresAt) <= now)) throw new ReportingError("report_share_expired", "This report share expired.");
  if (share.maxViews !== undefined && share.viewCount >= share.maxViews) throw new ReportingError("report_share_limit_reached", "This report share reached its view limit.");
  return Object.freeze({ canView: true, canDownload: share.accessMode === "view-and-download" });
}

export function assertSharingAllowed(reportType: ReportType, authorized: boolean) {
  const definitionValue = getReportDefinition(reportType);
  if (!definitionValue || !authorized || definitionValue.externalSharing === "disabled") throw new ReportingError("report_share_not_allowed", "External sharing is not allowed for this report.");
}

export function classifyJobRetry(job: ReportGenerationJob, now = new Date()) {
  if (job.status !== "failed" && !(job.status === "processing" && job.leaseExpiresAt && new Date(job.leaseExpiresAt) <= now)) return Object.freeze({ retryable: false, reason: "Job is not eligible for retry." });
  const nonRetryable = new Set(["report_permission_denied","report_entitlement_required","report_scope_invalid","report_projection_invalid"]);
  return Object.freeze({ retryable: !job.failureCode || !nonRetryable.has(job.failureCode), reuseSnapshot: Boolean(job.generatedReportId) });
}

export function generateReportNumber(type: ReportType, sequence: number, year: number) {
  if (!Number.isInteger(sequence) || sequence <= 0) throw new RangeError("Report sequence must be a positive integer.");
  const prefix = { "investment-decision": "INV", "property-performance": "PRP", "portfolio-performance": "POR", "financial-performance": "FIN" }[type];
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
}

export function orderSections(sections: readonly ReportSectionSnapshot[], template: ReportTemplate) {
  const byKey = new Map(sections.map((section) => [section.key, section]));
  return Object.freeze(template.sectionKeys.flatMap((key, order) => {
    const section = byKey.get(key);
    return section ? [Object.freeze({ ...section, order })] : [];
  }));
}

export interface ReportProjectionPort {
  build(input: Readonly<{ scope: ReportScope; period?: ReportRequest["period"]; sourceContext: Readonly<Record<string, string>> }>): Promise<ReportProjection>;
}

export interface ReportDocumentRenderer {
  renderHtml(projection: ReportProjection, template: ReportTemplate): Promise<Readonly<{ content: string; checksum: string; sizeBytes: number }>>;
  renderPdf(html: string, metadata: Readonly<{ title: string; generatedAt: string }>): Promise<Readonly<{ bytes: Uint8Array; checksum: string; sizeBytes: number }>>;
}

function definition(key: ReportType, scopes: ReportDefinition["supportedScopes"], periods: boolean, entitlement: string, projection: string, requiredSections: readonly string[], sharing: ReportDefinition["externalSharing"]): ReportDefinition {
  const names = { "investment-decision": "Investment Decision Report", "property-performance": "Property Performance Report", "portfolio-performance": "Portfolio Performance Report", "financial-performance": "Financial Performance Report" };
  return Object.freeze({ id: `report-definition-${key}`, key, name: names[key], description: `Canonical ${names[key].toLowerCase()}.`, supportedScopes: Object.freeze(scopes), supportsPeriods: periods, requiredEntitlementKey: entitlement, requiredProjectionKey: projection, defaultTemplateId: `report-template-${key}-v1`, requiredSections: Object.freeze(requiredSections), optionalSections: Object.freeze(["actions","notes"]), externalSharing: sharing, status: "active" });
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((item) => deepFreeze(item));
  }
  return value;
}

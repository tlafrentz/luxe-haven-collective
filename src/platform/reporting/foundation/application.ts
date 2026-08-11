import type { ComparisonPeriod, Report, ReportPeriod, ReportScope, ReportSnapshot, ReportVersion } from "./model";
import { normalizeScope, ReportFoundationError, validatePeriod } from "./model";
import { standardReportRegistry, type ReportDefinition } from "./registry";

export type ReportActor = Readonly<{ userId: string; tenantId: string; authenticated: boolean }>;
export type GenerateReportRequest = Readonly<{ definitionId: string; definitionVersion?: number; scope: ReportScope; period: ReportPeriod; comparisonPeriod?: ComparisonPeriod; title?: string; customConfiguration?: Readonly<Record<string, unknown>>; idempotencyKey?: string }>;
export interface ReportAuthorization { authorize(input: Readonly<{ actor: ReportActor; definition: ReportDefinition; scope: ReportScope }>): Promise<Readonly<{ allowed: boolean; authorizedPropertyIds: readonly string[] }>>; }
export interface ReportRepository { createReport(input: Report): Promise<Report>; createVersion(input: ReportVersion): Promise<ReportVersion>; markGenerating(reportVersionId: string): Promise<void>; markReady(reportVersionId: string, snapshot: ReportSnapshot): Promise<void>; markFailed(reportVersionId: string, failure: Readonly<{ code: string; message: string }>): Promise<void>; getReport(reportId: string, actor: ReportActor): Promise<Report | null>; getVersion(reportId: string, reportVersionId: string, actor: ReportActor): Promise<ReportVersion | null>; listReports(actor: ReportActor): Promise<readonly Report[]>; listVersions(reportId: string, actor: ReportActor): Promise<readonly ReportVersion[]>; archiveReport(reportId: string, actor: ReportActor): Promise<void>; }
export interface ExecutiveReportDataProvider { load(input: Readonly<{ scope: ReportScope; period: ReportPeriod }>): Promise<unknown>; }
export type OwnerReportDataProvider = ExecutiveReportDataProvider;
export type InvestmentReportDataProvider = ExecutiveReportDataProvider;
export type OperationsReportDataProvider = ExecutiveReportDataProvider;

export async function validateGenerateReportRequest(input: GenerateReportRequest, actor: ReportActor, authorization: ReportAuthorization) {
  if (!actor.authenticated || !actor.userId || input.scope.tenantId !== actor.tenantId) throw new ReportFoundationError("REPORT_SCOPE_FORBIDDEN", "Report scope is forbidden.");
  const definition = standardReportRegistry.get(input.definitionId, input.definitionVersion), scope = normalizeScope(input.scope), period = validatePeriod(input.period);
  if (!definition.supportedScopes.includes(scope.kind)) throw new ReportFoundationError("REPORT_SCOPE_UNSUPPORTED", "Report scope is unsupported.");
  if (definition.periodPolicy === "unsupported") throw new ReportFoundationError("REPORT_PERIOD_UNSUPPORTED", "This report does not support a period.");
  if (definition.comparisonPolicy === "required" && !input.comparisonPeriod) throw new ReportFoundationError("REPORT_COMPARISON_INVALID", "A comparison period is required.");
  if (definition.comparisonPolicy === "unsupported" && input.comparisonPeriod) throw new ReportFoundationError("REPORT_COMPARISON_INVALID", "A comparison period is unsupported.");
  if (input.comparisonPeriod) validatePeriod(input.comparisonPeriod);
  if (input.customConfiguration && definition.family !== "custom") throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Custom configuration is unsupported.");
  if (input.title && (input.title.length > 160 || /<[^>]+>/.test(input.title))) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Report title must be plain text within 160 characters.");
  const grant = await authorization.authorize({ actor, definition, scope });
  if (!grant.allowed) throw new ReportFoundationError("REPORT_SCOPE_FORBIDDEN", "Report scope is forbidden.");
  const requestedProperties = scope.kind === "property" ? [scope.propertyId] : "propertyIds" in scope ? scope.propertyIds : [];
  if (requestedProperties.some(id => !grant.authorizedPropertyIds.includes(id))) throw new ReportFoundationError("REPORT_SCOPE_FORBIDDEN", "Every property must be authorized.");
  return Object.freeze({ definition, scope, period, comparisonPeriod: input.comparisonPeriod, authorizedPropertyIds: Object.freeze([...new Set(grant.authorizedPropertyIds)].sort()), title: input.title?.trim() });
}

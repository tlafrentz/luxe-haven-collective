export type ReportFamily = "executive" | "owner" | "investment" | "operations" | "custom";
export type ReportScopeKind = "portfolio" | "selected_properties" | "property" | "owner_portfolio" | "investment_opportunity" | "investment_comparison";
export type ReportStatus = "draft" | "generating" | "ready" | "failed" | "archived";
export type ReportVisibility = "standard" | "internal" | "owner_safe";

export type ReportScope =
  | Readonly<{ kind: "portfolio"; tenantId: string }>
  | Readonly<{ kind: "selected_properties"; tenantId: string; propertyIds: readonly string[] }>
  | Readonly<{ kind: "property"; tenantId: string; propertyId: string }>
  | Readonly<{ kind: "owner_portfolio"; tenantId: string; ownerId: string; propertyIds: readonly string[] }>
  | Readonly<{ kind: "investment_opportunity"; tenantId: string; opportunityId: string; analysisVersionId: string }>
  | Readonly<{ kind: "investment_comparison"; tenantId: string; opportunityIds: readonly string[]; analysisVersionIds: readonly string[] }>;

export type ReportPeriod = Readonly<{ startDate: string; endDate: string; timezone: string; granularity?: "day" | "week" | "month" | "quarter" | "year" }>;
export type ComparisonPeriod = Readonly<{ kind: "previous_period" | "previous_year" | "custom"; startDate: string; endDate: string; timezone: string }>;
export type DataFreshness = Readonly<{ observedAt?: string; retrievedAt?: string; staleAfter?: string; status: "current" | "stale" | "unknown" }>;
export type SourceLineage = Readonly<{ sourceType: "platform_metric" | "observation" | "decision" | "action" | "outcome" | "investment_analysis" | "property_record" | "booking_record" | "manual_input"; sourceId?: string; sourceVersionId?: string; sourceKey?: string; observedAt?: string; retrievedAt?: string }>;
export type ReportDataGap = Readonly<{ gapId: string; code: string; category: "missing" | "stale" | "incomplete" | "unsupported"; severity: "informational" | "limiting" | "blocking"; message: string; affectedMetricKeys: readonly string[]; sourceType?: string }>;
export type ReportMetricComparison = Readonly<{ requested: boolean; status: "available" | "unavailable" | "not_requested" | "not_calculable"; value?: number | string | boolean | null; absoluteChange?: number; percentageChange?: number; direction?: "increase" | "decrease" | "unchanged"; period?: ComparisonPeriod }>;
export type ReportMetric = Readonly<{ metricId: string; metricKey: string; label: string; value: number | string | boolean | null; valueType: "currency" | "percentage" | "decimal" | "integer" | "duration" | "text" | "boolean"; unit?: string; currency?: string; comparison?: ReportMetricComparison; status: "available" | "missing" | "stale" | "not_applicable"; freshness?: DataFreshness; lineage: readonly SourceLineage[] }>;
export type ReportFinding = Readonly<{ findingId: string; category: string; severity: "informational" | "positive" | "attention" | "critical"; title: string; summary: string; basis: "deterministic" | "ai_assisted"; supportingMetricKeys: readonly string[]; lineage: readonly SourceLineage[]; confidence?: "high" | "medium" | "low" | "unknown" }>;
export type ReportRecommendation = Readonly<{ recommendationId: string; category: string; priority: "low" | "medium" | "high" | "critical"; title: string; rationale: string; basis: "deterministic" | "ai_assisted"; supportingFindingIds: readonly string[]; relatedDecisionId?: string; relatedActionId?: string }>;
export type ReportTableColumn = Readonly<{ key: string; label: string; valueType: ReportMetric["valueType"]; unit?: string; currency?: string }>;
export type ReportTable = Readonly<{ tableId: string; title?: string; columns: readonly ReportTableColumn[]; rows: readonly Readonly<Record<string, number | string | boolean | null>>[]; lineage: readonly SourceLineage[] }>;
export type ReportSectionType = "summary" | "performance" | "comparison" | "property_ranking" | "risks" | "opportunities" | "decisions" | "actions" | "outcomes" | "assumptions" | "cash_flow" | "sensitivity" | "operations" | "guest_experience" | "data_quality" | "custom";
export type ReportSection = Readonly<{ sectionId: string; sectionType: ReportSectionType; title: string; description?: string; order: number; visibility: ReportVisibility; status: "available" | "partial" | "unavailable"; metrics: readonly ReportMetric[]; findings: readonly ReportFinding[]; recommendations: readonly ReportRecommendation[]; tables?: readonly ReportTable[]; dataGaps: readonly ReportDataGap[] }>;

export type ReportSnapshot = Readonly<{ schemaVersion: "rp001.report-snapshot.v1"; sections: readonly ReportSection[]; lineage: readonly SourceLineage[]; freshness: DataFreshness; dataGaps: readonly ReportDataGap[] }>;
export type Report = Readonly<{ reportId: string; tenantId: string; family: ReportFamily; reportType: string; definitionId: string; createdBy: string; createdAt: string; archivedAt?: string }>;
export type ReportVersion = Readonly<{ reportId: string; reportVersionId: string; versionNumber: number; definitionId: string; definitionVersion: number; family: ReportFamily; reportType: string; title: string; description?: string; tenantId: string; requestedBy: string; generatedForId?: string; scope: ReportScope; authorizedPropertyIds: readonly string[]; ownerId?: string; opportunityId?: string; status: ReportStatus; period: ReportPeriod; comparisonPeriod?: ComparisonPeriod; snapshot?: ReportSnapshot; requestedAt: string; generationStartedAt?: string; generatedAt?: string; failureCode?: string; failureMessage?: string }>;

export class ReportFoundationError extends Error {
  constructor(public readonly code: "REPORT_DEFINITION_NOT_FOUND" | "REPORT_DEFINITION_DISABLED" | "REPORT_SCOPE_UNSUPPORTED" | "REPORT_SCOPE_FORBIDDEN" | "REPORT_PERIOD_INVALID" | "REPORT_PERIOD_UNSUPPORTED" | "REPORT_COMPARISON_INVALID" | "REPORT_SOURCE_NOT_FOUND" | "REPORT_DATA_INSUFFICIENT" | "REPORT_VERSION_NOT_FOUND" | "REPORT_INVALID_CONFIGURATION", message: string) { super(message); }
}

export function normalizeScope(scope: ReportScope): ReportScope {
  const required = (value: string, label: string) => { if (!value.trim()) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", `${label} is required.`); return value.trim(); };
  const ids = (values: readonly string[], label: string) => { const result = [...new Set(values.map(value => value.trim()).filter(Boolean))].sort(); if (!result.length) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", `${label} must not be empty.`); return Object.freeze(result); };
  const tenantId = required(scope.tenantId, "Tenant");
  switch (scope.kind) {
    case "portfolio": return Object.freeze({ kind: scope.kind, tenantId });
    case "property": return Object.freeze({ kind: scope.kind, tenantId, propertyId: required(scope.propertyId, "Property") });
    case "selected_properties": return Object.freeze({ kind: scope.kind, tenantId, propertyIds: ids(scope.propertyIds, "Properties") });
    case "owner_portfolio": return Object.freeze({ kind: scope.kind, tenantId, ownerId: required(scope.ownerId, "Owner"), propertyIds: ids(scope.propertyIds, "Properties") });
    case "investment_opportunity": return Object.freeze({ kind: scope.kind, tenantId, opportunityId: required(scope.opportunityId, "Opportunity"), analysisVersionId: required(scope.analysisVersionId, "Analysis version") });
    case "investment_comparison": { const opportunityIds = ids(scope.opportunityIds, "Opportunities"), analysisVersionIds = ids(scope.analysisVersionIds, "Analysis versions"); if (opportunityIds.length !== analysisVersionIds.length) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Investment comparison lineage is incomplete."); return Object.freeze({ kind: scope.kind, tenantId, opportunityIds, analysisVersionIds }); }
  }
}

export function validatePeriod(period: ReportPeriod): ReportPeriod {
  if (!period.timezone.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(period.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(period.endDate) || period.startDate > period.endDate) throw new ReportFoundationError("REPORT_PERIOD_INVALID", "The reporting period is invalid.");
  try { new Intl.DateTimeFormat("en-US", { timeZone: period.timezone }); } catch { throw new ReportFoundationError("REPORT_PERIOD_INVALID", "The reporting timezone is invalid."); }
  return Object.freeze({ ...period });
}

export function assertSnapshot(snapshot: ReportSnapshot, registeredMetricKeys: ReadonlySet<string>) {
  if (snapshot.dataGaps.some(gap => gap.severity === "blocking")) throw new ReportFoundationError("REPORT_DATA_INSUFFICIENT", "Blocking data gaps prevent a ready report.");
  const orders = snapshot.sections.map(section => section.order);
  if (new Set(orders).size !== orders.length) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Section ordering must be deterministic.");
  for (const section of snapshot.sections) for (const metric of section.metrics) {
    if (!registeredMetricKeys.has(metric.metricKey)) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Metric key is not registered.");
    if (metric.valueType === "currency" && metric.status === "available" && !metric.currency) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Available currency metrics require a currency code.");
    if (metric.status !== "available" && metric.value !== null) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", "Unavailable metric values must remain null.");
  }
  return deepFreeze(JSON.parse(JSON.stringify(snapshot)) as ReportSnapshot);
}

export function transitionReportVersion(current: ReportStatus, next: ReportStatus) {
  const allowed: Record<ReportStatus, readonly ReportStatus[]> = { draft: ["generating", "archived"], generating: ["ready", "failed"], ready: ["archived"], failed: ["archived"], archived: [] };
  if (!allowed[current].includes(next)) throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION", `Report cannot transition from ${current} to ${next}.`);
  return next;
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }

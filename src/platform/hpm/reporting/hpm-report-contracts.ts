import type { HpmActorContext, HpmFreshness, HpmLifecycleProjection, HpmProjectionScope, HpmSourceCapability } from "../application";

export const HPM_REPORT_COMPLETENESS = ["complete", "partial", "stale", "degraded", "unavailable", "restricted", "unsupported-source-version"] as const;
export type HpmReportCompleteness = typeof HPM_REPORT_COMPLETENESS[number];
export type HpmReportKey = "executive-summary" | "portfolio-performance-attention" | "property-performance-lifecycle" | "decision-outcome-traceability" | "execution-health-blockers" | "measurement-learning-coverage" | "recommendation-pipeline-results" | "lifecycle-throughput-aging" | "data-quality-freshness" | "audit-lineage";
export type HpmMetricUnit = "count" | "percentage" | "duration-ms" | "classification";

export type HpmMetricDefinition = Readonly<{
  key: string; version: string; name: string; description: string; owner: HpmSourceCapability | "hpm";
  numerator: string; denominator: string; unit: HpmMetricUnit; aggregation: "count" | "ratio" | "median" | "percentile" | "classification";
  dimensions: readonly string[]; timeWindow: string; timeZoneTreatment: string; scopeRules: string;
  includedStatuses: readonly string[]; exclusions: readonly string[]; recordStateTreatment: Readonly<{ reopened: string; archived: string; superseded: string; expired: string; inaccessible: string }>;
  missingDataTreatment: string; partialSourceTreatment: string; confidencePolicy: string; asOfBehavior: string; minimumSample: number;
  sourceContractVersions: readonly string[]; policyVersion: string; effectiveAt: string; validationExamples: readonly Readonly<{ input: string; expected: string }>[];
}>;

export type HpmReportDefinition = Readonly<{
  id: string; key: HpmReportKey; name: string; description: string; category: "executive" | "portfolio" | "property" | "operations" | "learning" | "audit";
  version: string; supportedScopeTypes: readonly ("property" | "portfolio")[]; supportedDateModes: readonly ("period" | "current-as-of")[]; defaultDateMode: "period" | "current-as-of";
  supportedTimeZones: "iana"; requiredSources: readonly HpmSourceCapability[]; optionalSources: readonly HpmSourceCapability[];
  metricReferences: readonly Readonly<{ key: string; version: string }>[]; dimensions: readonly string[]; filters: readonly string[]; sorts: readonly string[];
  sections: readonly Readonly<{ key: string; title: string; metricKeys: readonly string[] }> []; drilldowns: readonly Readonly<{ metricKey: string; destination: "attention" | "lifecycle" | "source" }> [];
  exportFormats: readonly ("csv" | "print")[]; requiredAuthority: string; partialSourcePolicy: string; freshnessPolicy: string; inferenceProtectionPolicy: string; effectiveAt: string; superseded: boolean;
}>;

export type HpmReportRequest = Readonly<{
  reportKey: HpmReportKey; definitionVersion?: string; actor: HpmActorContext; scope: HpmProjectionScope;
  dateMode: "period" | "current-as-of"; from: string; to: string; timeZone: string; asOf: string;
  filters: Readonly<Record<string, readonly string[]>>; dimensions: readonly string[]; sort?: string; cursor?: string;
  comparison?: Readonly<{ from: string; to: string }>; locale: string; currency: string; correlationId: string;
}>;

export type HpmReportMetricValue = Readonly<{ metricKey: string; metricVersion: string; value: number | string | null; unit: HpmMetricUnit; state: "available" | "empty-population" | "unavailable" | "restricted"; numerator?: number; denominator?: number; explanation: string }>;
export type HpmReportRow = Readonly<{ id: string; label: string; values: readonly HpmReportMetricValue[]; drilldown?: string }>;
export type HpmReportSection = Readonly<{ key: string; title: string; metrics: readonly HpmReportMetricValue[]; rows: readonly HpmReportRow[] }>;
export type HpmReportResult = Readonly<{
  runId: string; definitionId: string; reportKey: HpmReportKey; definitionVersion: string; metricPolicyVersions: Readonly<Record<string, string>>;
  scope: Readonly<{ type: string; propertyCount: number }>; from: string; to: string; timeZone: string; asOf: string; generatedAt: string;
  sourceVersions: readonly Readonly<{ capability: HpmSourceCapability; contractVersion?: string; sourceVersion?: string }> [];
  sourceFreshness: readonly Readonly<{ capability: HpmSourceCapability; freshness: HpmFreshness }> [];
  coverage: Readonly<{ availableSources: number; applicableSources: number }>;
  completeness: HpmReportCompleteness; limitations: readonly string[]; caveats: readonly string[]; sections: readonly HpmReportSection[];
  drilldowns: readonly Readonly<{ metricKey: string; href: string }> []; exportEligibility: Readonly<{ csv: boolean; print: boolean }>;
  warnings: readonly string[]; resultChecksum: string; correlationId: string;
}>;

export type HpmReportFailureCode = "HPM_REPORT_NOT_FOUND" | "HPM_REPORT_VERSION_UNSUPPORTED" | "HPM_REPORT_ACCESS_DENIED" | "HPM_REPORT_SCOPE_INVALID" | "HPM_REPORT_FILTER_INVALID" | "HPM_REPORT_DIMENSION_INVALID" | "HPM_REPORT_DATE_RANGE_INVALID" | "HPM_REPORT_TIME_ZONE_INVALID" | "HPM_REPORT_COMPARISON_INVALID" | "HPM_REPORT_SOURCE_REQUIRED" | "HPM_REPORT_SOURCE_UNAVAILABLE" | "HPM_REPORT_SOURCE_VERSION_UNSUPPORTED" | "HPM_REPORT_SOURCE_STALE" | "HPM_REPORT_PARTIAL" | "HPM_REPORT_METRIC_DEFINITION_INVALID" | "HPM_REPORT_METRIC_VERSION_UNSUPPORTED" | "HPM_REPORT_RECONCILIATION_FAILED" | "HPM_REPORT_GENERATION_FAILED" | "HPM_REPORT_DRILLDOWN_NOT_ALLOWED" | "HPM_EXPORT_NOT_ALLOWED" | "HPM_EXPORT_FORMAT_UNSUPPORTED" | "HPM_EXPORT_GENERATION_FAILED" | "HPM_EXPORT_EXPIRED" | "HPM_REFRESH_NOT_ALLOWED" | "HPM_REFRESH_ALREADY_IN_PROGRESS" | "HPM_REFRESH_FAILED" | "HPM_REBUILD_NOT_ALLOWED" | "HPM_REBUILD_SCOPE_TOO_BROAD" | "HPM_REBUILD_ALREADY_IN_PROGRESS" | "HPM_REBUILD_FAILED" | "HPM_CACHE_INVALIDATION_NOT_ALLOWED" | "HPM_OPERATION_VERSION_CONFLICT" | "HPM_OPERATION_IDEMPOTENCY_CONFLICT" | "HPM_OPERATION_UNAVAILABLE" | "CONCURRENT_MODIFICATION";
export type HpmReportResultEnvelope = Readonly<{ ok: true; report: HpmReportResult } | { ok: false; code: HpmReportFailureCode; message: string; correlationId: string }>;

export type HpmOperationalHealth = Readonly<{ status: "healthy" | "partial" | "degraded" | "unavailable"; evaluatedAt: string; featureFlags: Readonly<{ reports: boolean; exports: boolean; health: boolean; operations: boolean }>; sources: HpmLifecycleProjection["sourceStates"]; projection: Readonly<{ completeness: string; projectedAt: string; failureCount: number }>; cache: Readonly<{ status: "available" | "disabled" | "degraded"; policyVersion: string; entries: number }>; reports: Readonly<{ status: "available" | "degraded"; definitionCount: number; recentFailures: readonly string[] }>; exports: Readonly<{ status: "available" | "disabled"; formats: readonly string[] }>; jobs: Readonly<{ status: "disabled" | "available"; active: number; oldestAgeMs: number | null }>; degradedModes: readonly string[]; runbook: string; validCommands: readonly string[] }>;

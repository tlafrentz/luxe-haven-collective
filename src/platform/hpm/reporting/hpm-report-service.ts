import { createHash } from "node:crypto";
import type { HpmAttentionProjection } from "../application";
import { HPM_LIFECYCLE_STAGES, type HpmLifecycleProjection } from "../application";
import { getHpmMetricDefinition } from "./hpm-metric-registry";
import { getHpmReportDefinition } from "./hpm-report-catalog";
import type { HpmMetricDefinition, HpmReportCompleteness, HpmReportMetricValue, HpmReportRequest, HpmReportResultEnvelope, HpmReportSection } from "./hpm-report-contracts";

export function createHpmReportService(dependencies: Readonly<{ now?: () => string }> = {}) {
  return Object.freeze({
    run(input: Readonly<{ request: HpmReportRequest; lifecycle: HpmLifecycleProjection; attention: HpmAttentionProjection }>): HpmReportResultEnvelope {
      const { request, lifecycle, attention } = input;
      const definition = getHpmReportDefinition(request.reportKey, request.definitionVersion ?? "v1");
      if (!definition) return failure("HPM_REPORT_NOT_FOUND", "The requested report definition is unavailable.", request);
      if (!request.actor.active || request.actor.tenantId !== request.scope.tenantId || request.scope.propertyIds.some((id) => !request.actor.propertyIds.includes(id))) return failure("HPM_REPORT_ACCESS_DENIED", "The report scope is not authorized.", request);
      if (request.scope.tenantId !== lifecycle.scope.tenantId || request.scope.type !== lifecycle.scope.type || request.scope.propertyIds.join(",") !== lifecycle.scope.propertyIds.join(",")) return failure("HPM_REPORT_SCOPE_INVALID", "The report projection does not match the authorized request scope.", request);
      if (!definition.supportedScopeTypes.includes(request.scope.type === "property" ? "property" : "portfolio")) return failure("HPM_REPORT_SCOPE_INVALID", "The report does not support this scope.", request);
      if (!validDateRange(request.from, request.to, request.asOf)) return failure("HPM_REPORT_DATE_RANGE_INVALID", "The report date range is invalid.", request);
      try { new Intl.DateTimeFormat("en", { timeZone: request.timeZone }).format(); } catch { return failure("HPM_REPORT_TIME_ZONE_INVALID", "The report time zone is invalid.", request); }
      if (request.dimensions.some((dimension) => !definition.dimensions.includes(dimension))) return failure("HPM_REPORT_DIMENSION_INVALID", "A report dimension is unsupported.", request);
      if (Object.keys(request.filters).some((filter) => !definition.filters.includes(filter))) return failure("HPM_REPORT_FILTER_INVALID", "A report filter is unsupported.", request);
      const definitions = definition.metricReferences.map(({ key, version }) => getHpmMetricDefinition(key, version));
      if (definitions.some((metric) => !metric)) return failure("HPM_REPORT_METRIC_DEFINITION_INVALID", "A metric definition is unavailable.", request);
      const metrics = new Map((definitions as HpmMetricDefinition[]).map((metric) => [metric.key, calculate(metric, lifecycle, attention)]));
      const stageRows = HPM_LIFECYCLE_STAGES.map((stage) => { const summary = lifecycle.stages.find((item) => item.stage === stage); const available = summary && ["available", "partial"].includes(summary.availability ?? ""); return Object.freeze({ id: stage, label: stage[0].toUpperCase() + stage.slice(1), values: Object.freeze([
        value("stage-visible-count", available ? summary!.visibleCount : null, available ? "available" : "unavailable", available ? "Authorized visible source records." : "The stage source is unavailable."),
        value("stage-attention-count", available ? summary!.attentionCount : null, available ? "available" : "unavailable", available ? "Authorized attention items." : "The stage source is unavailable."),
      ]), drilldown: `/dashboard/hpm/lifecycle?stage=${stage}` }); });
      const sections: HpmReportSection[] = definition.sections.map((section) => Object.freeze({ key: section.key, title: section.title, metrics: Object.freeze(section.metricKeys.flatMap((key) => metrics.get(key) ? [metrics.get(key)!] : [])), rows: section.key === "lifecycle" ? Object.freeze(stageRows) : Object.freeze([]) }));
      const completeness = reportCompleteness(lifecycle);
      const generatedAt = dependencies.now?.() ?? new Date().toISOString();
      const base = { definitionId: definition.id, reportKey: definition.key, definitionVersion: definition.version, metricPolicyVersions: Object.fromEntries((definitions as HpmMetricDefinition[]).map((metric) => [metric.key, metric.policyVersion])), scope: { type: request.scope.type, propertyCount: request.scope.propertyIds.length }, from: request.from, to: request.to, timeZone: request.timeZone, asOf: request.asOf, generatedAt,
        sourceVersions: lifecycle.sourceStates.map(({ capability, contractVersion, sourceVersion }) => ({ capability, contractVersion, sourceVersion })), sourceFreshness: lifecycle.sourceStates.map(({ capability, freshness }) => ({ capability, freshness })), coverage: { availableSources: lifecycle.coverage?.availableSources ?? lifecycle.sourceStates.filter(({ freshness }) => freshness === "current").length, applicableSources: lifecycle.coverage?.applicableSources ?? lifecycle.sourceStates.length }, completeness,
        limitations: lifecycle.coverage?.limitations ?? [], caveats: [definition.partialSourcePolicy, definition.inferenceProtectionPolicy], sections: Object.freeze(sections), drilldowns: definition.drilldowns.map(({ metricKey, destination }) => ({ metricKey, href: destination === "attention" ? "/dashboard/hpm/attention" : "/dashboard/hpm/lifecycle" })), exportEligibility: { csv: definition.exportFormats.includes("csv"), print: definition.exportFormats.includes("print") }, warnings: lifecycle.failures?.map(({ classification }) => classification) ?? [], correlationId: request.correlationId };
      const checksum = digest(base), runId = `hpm-run:${digest({ request: canonicalRequest(request), checksum }).slice(0, 24)}`;
      return Object.freeze({ ok: true, report: Object.freeze({ ...base, runId, resultChecksum: checksum }) });
    },
  });
}

function calculate(definition: HpmMetricDefinition, lifecycle: HpmLifecycleProjection, attention: HpmAttentionProjection): HpmReportMetricValue {
  const threads = lifecycle.threads;
  const values: Record<string, readonly [number | null, number?, number?]> = {
    "active-attention-count": [attention.totalAuthorizedCandidates], "critical-attention-count": [attention.items.filter(({ severity }) => severity === "critical").length], "lifecycle-thread-count": [threads.length],
    "healthy-thread-rate": [threads.length ? percent(threads.filter(({ health }) => health === "healthy").length, threads.length) : null, threads.filter(({ health }) => health === "healthy").length, threads.length],
    "blocked-thread-rate": [threads.length ? percent(threads.filter(({ health }) => health === "blocked").length, threads.length) : null, threads.filter(({ health }) => health === "blocked").length, threads.length],
    "stage-visible-count": [lifecycle.stages.reduce((sum, stage) => sum + stage.visibleCount, 0)], "stage-attention-count": [lifecycle.stages.reduce((sum, stage) => sum + stage.attentionCount, 0)],
    "source-coverage-rate": [(lifecycle.coverage?.applicableSources ?? 0) ? percent(lifecycle.coverage!.availableSources, lifecycle.coverage!.applicableSources) : null, lifecycle.coverage?.availableSources, lifecycle.coverage?.applicableSources],
    "current-source-count": [lifecycle.sourceStates.filter(({ freshness }) => freshness === "current").length], "limited-source-count": [lifecycle.sourceStates.filter(({ freshness }) => !["current", "not-applicable"].includes(freshness)).length],
    "lineage-edge-count": [lifecycle.lineage.length], "missing-lineage-thread-count": [threads.filter((thread) => thread.records.length > 1 && !thread.relationships.length).length],
    "execution-blocker-count": [threads.reduce((sum, thread) => sum + thread.blockers.length, 0)], "measurement-awaiting-count": [lifecycle.recentlyChanged.filter(({ presentationState }) => presentationState === "awaiting-measurement").length],
    "reevaluation-count": [lifecycle.recentlyChanged.filter(({ presentationState }) => presentationState === "needs-reevaluation").length],
  };
  const [metricValue, numerator, denominator] = values[definition.key] ?? [null];
  const state = metricValue === null ? (denominator === 0 || definition.key.includes("rate") ? "empty-population" : "unavailable") : "available";
  return value(definition.key, metricValue, state, state === "available" ? definition.description : state === "empty-population" ? "No eligible authorized records; this is not a zero rate." : definition.missingDataTreatment, numerator, denominator);
}
function value(metricKey: string, metricValue: number | null, state: HpmReportMetricValue["state"], explanation: string, numerator?: number, denominator?: number): HpmReportMetricValue { const definition = getHpmMetricDefinition(metricKey)!; return Object.freeze({ metricKey, metricVersion: definition.version, value: metricValue, unit: definition.unit, state, ...(numerator !== undefined ? { numerator } : {}), ...(denominator !== undefined ? { denominator } : {}), explanation }); }
function reportCompleteness(lifecycle: HpmLifecycleProjection): HpmReportCompleteness { if (lifecycle.failures?.some(({ classification }) => classification === "HPM_SOURCE_VERSION_CONFLICT")) return "unsupported-source-version"; if (lifecycle.sourceStates.some(({ freshness }) => freshness === "stale")) return "stale"; if (lifecycle.failures?.length) return "degraded"; return lifecycle.partial ? "partial" : "complete"; }
function percent(numerator: number, denominator: number) { return Math.round(numerator / denominator * 10_000) / 100; }
function validDateRange(from: string, to: string, asOf: string) { return ![from, to, asOf].some((value) => Number.isNaN(Date.parse(value))) && Date.parse(from) <= Date.parse(to); }
function canonicalRequest(request: HpmReportRequest) { return { reportKey: request.reportKey, definitionVersion: request.definitionVersion, actorId: request.actor.actorId, scope: { ...request.scope, propertyIds: [...request.scope.propertyIds].sort() }, dateMode: request.dateMode, from: request.from, to: request.to, timeZone: request.timeZone, asOf: request.asOf, filters: request.filters, dimensions: request.dimensions, sort: request.sort, cursor: request.cursor, comparison: request.comparison, locale: request.locale, currency: request.currency, correlationId: request.correlationId }; }
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function failure(code: Extract<HpmReportResultEnvelope, { ok: false }>["code"], message: string, request: HpmReportRequest): HpmReportResultEnvelope { return Object.freeze({ ok: false, code, message, correlationId: request.correlationId }); }

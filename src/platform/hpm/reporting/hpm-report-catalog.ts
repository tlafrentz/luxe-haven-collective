import { HPM_SOURCE_CAPABILITIES } from "../application";
import { getHpmMetricDefinition } from "./hpm-metric-registry";
import type { HpmReportDefinition, HpmReportKey } from "./hpm-report-contracts";

const ALL_METRICS = ["active-attention-count", "critical-attention-count", "lifecycle-thread-count", "healthy-thread-rate", "blocked-thread-rate", "stage-visible-count", "stage-attention-count", "source-coverage-rate", "current-source-count", "limited-source-count", "lineage-edge-count", "missing-lineage-thread-count", "execution-blocker-count", "measurement-awaiting-count", "reevaluation-count"];
const common = (key: HpmReportKey, name: string, description: string, category: HpmReportDefinition["category"], metrics: readonly string[], scopes: HpmReportDefinition["supportedScopeTypes"] = ["property", "portfolio"]): HpmReportDefinition => Object.freeze({
  id: `hpm-report:${key}:v1`, key, name, description, category, version: "v1", supportedScopeTypes: scopes, supportedDateModes: ["period", "current-as-of"], defaultDateMode: "period", supportedTimeZones: "iana",
  requiredSources: ["observations"], optionalSources: HPM_SOURCE_CAPABILITIES.filter((source) => source !== "observations"), metricReferences: metrics.map((metric) => ({ key: metric, version: getHpmMetricDefinition(metric)?.version ?? "v1" })),
  dimensions: ["stage", "capability", "property", "health", "freshness"], filters: ["stage", "capability", "health", "freshness"], sorts: ["canonical", "label"],
  sections: [{ key: "summary", title: "Summary", metricKeys: metrics }, { key: "lifecycle", title: "Lifecycle stages", metricKeys: ["stage-visible-count", "stage-attention-count"] }],
  drilldowns: metrics.map((metricKey) => ({ metricKey, destination: metricKey.includes("attention") ? "attention" as const : "lifecycle" as const })), exportFormats: ["csv", "print"], requiredAuthority: "view_hpm_reports",
  partialSourcePolicy: "Preserve authorized sections; unavailable values remain unavailable and limitations are shown.", freshnessPolicy: "Show source freshness and never silently promote stale data to current.", inferenceProtectionPolicy: "Authorize before aggregation; suppress inaccessible records and do not disclose excluded counts.", effectiveAt: "2026-08-09T00:00:00.000Z", superseded: false,
} satisfies HpmReportDefinition);

export const HPM_STANDARD_REPORTS: readonly HpmReportDefinition[] = Object.freeze([
  common("executive-summary", "Executive HPM Summary", "Lifecycle health, attention, coverage, and material cross-capability state without an unexplained score.", "executive", ALL_METRICS),
  common("portfolio-performance-attention", "Portfolio Performance and Attention", "Authorized portfolio lifecycle and attention comparison without ranking unavailable data.", "portfolio", ["active-attention-count", "critical-attention-count", "lifecycle-thread-count", "healthy-thread-rate", "source-coverage-rate"], ["portfolio"]),
  common("property-performance-lifecycle", "Property Performance and Lifecycle", "Property performance context, lifecycle threads, attention, lineage, freshness, and limitations.", "property", ["active-attention-count", "lifecycle-thread-count", "stage-visible-count", "source-coverage-rate", "lineage-edge-count"], ["property"]),
  common("decision-outcome-traceability", "Decision-to-Outcome Traceability", "Authorized cross-capability lineage with missing links visible and no causal inference.", "audit", ["lifecycle-thread-count", "lineage-edge-count", "missing-lineage-thread-count"]),
  common("execution-health-blockers", "Execution Health and Blockers", "Execute-owned work status projected with blockers, attention, and measurement handoff state.", "operations", ["execution-blocker-count", "blocked-thread-rate", "active-attention-count", "measurement-awaiting-count"]),
  common("measurement-learning-coverage", "Measurement and Learning Coverage", "Measurement and reviewed-learning coverage while preserving the outcome-to-lesson boundary.", "learning", ["measurement-awaiting-count", "reevaluation-count", "source-coverage-rate"]),
  common("recommendation-pipeline-results", "Recommendation Pipeline and Results", "Recommendation lifecycle visibility distinct from decisions, actions, outcomes, and lessons.", "learning", ["reevaluation-count", "active-attention-count", "source-coverage-rate"]),
  common("lifecycle-throughput-aging", "Lifecycle Throughput and Aging", "Current authorized lifecycle populations and stage age foundations; unavailable event populations remain unavailable.", "operations", ["stage-visible-count", "stage-attention-count", "lifecycle-thread-count", "missing-lineage-thread-count"]),
  common("data-quality-freshness", "Data Quality and Freshness", "Source compatibility, availability, freshness, coverage, failures, and degraded modes using safe metadata.", "operations", ["source-coverage-rate", "current-source-count", "limited-source-count", "missing-lineage-thread-count"]),
  common("audit-lineage", "HPM Audit and Lineage", "Definition, policy, source-version, lineage, and correlation metadata for authorized HPM assembly.", "audit", ["lineage-edge-count", "missing-lineage-thread-count", "lifecycle-thread-count", "source-coverage-rate"]),
]);

export function listHpmReportDefinitions(scopeType?: "property" | "portfolio") { return HPM_STANDARD_REPORTS.filter((definition) => !scopeType || definition.supportedScopeTypes.includes(scopeType)); }
export function getHpmReportDefinition(key: string, version = "v1") { return HPM_STANDARD_REPORTS.find((definition) => definition.key === key && definition.version === version); }
export function isHpmReportKey(value: string): value is HpmReportKey { return HPM_STANDARD_REPORTS.some(({ key }) => key === value); }

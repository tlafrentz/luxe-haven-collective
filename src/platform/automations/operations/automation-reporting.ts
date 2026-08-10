import { createHash } from "node:crypto";
import type { AutomationOperationsProjection } from "./automation-operations-contracts";

export const AUTOMATION_REPORT_KEYS = [
  "portfolio-summary",
  "reliability",
  "trigger-scheduling",
  "approval-governance",
  "execution-command-outcomes",
  "reconciliation-recovery",
  "value-outcomes",
  "operational-health",
] as const;
export type AutomationReportKey = (typeof AUTOMATION_REPORT_KEYS)[number];
export type AutomationReportDefinition = Readonly<{
  id: string;
  key: AutomationReportKey;
  version: "v1";
  name: string;
  purpose: string;
  audiences: readonly string[];
  scopes: readonly string[];
  metrics: readonly string[];
  sourceVersions: readonly string[];
  timeZonePolicy: string;
  freshnessPolicy: string;
  partialDataPolicy: string;
  inferenceProtection: string;
  exportFormats: readonly ("csv" | "print")[];
}>;
export type AutomationReportMetric = Readonly<{
  key: string;
  label: string;
  value: number | string | null;
  unit: "count" | "percentage" | "duration-ms" | "classification";
  state: "available" | "unavailable" | "restricted";
  numerator?: number;
  denominator?: number;
  explanation: string;
}>;
export type AutomationReportResult = Readonly<{
  reportId: string;
  key: AutomationReportKey;
  definitionVersion: string;
  generatedAt: string;
  timeZone: string;
  scopeLabel: string;
  from: string;
  to: string;
  completeness: "complete" | "partial" | "stale" | "unavailable";
  metrics: readonly AutomationReportMetric[];
  rows: readonly Readonly<Record<string, string | number | null>>[];
  limitations: readonly string[];
  sourceFreshness: AutomationOperationsProjection["freshness"];
  checksum: string;
}>;
export type AutomationReportExport = Readonly<{
  contentType: "text/csv";
  filename: string;
  content: string;
  rowCount: number;
  checksum: string;
  generatedAt: string;
  metadata: Readonly<{
    reportId: string;
    version: string;
    timeZone: string;
    scopeLabel: string;
  }>;
}>;

const define = (
  key: AutomationReportKey,
  name: string,
  purpose: string,
  metrics: readonly string[],
): AutomationReportDefinition =>
  Object.freeze({
    id: `automation-${key}`,
    key,
    version: "v1",
    name,
    purpose,
    audiences: Object.freeze([
      "owner",
      "administrator",
      "automation-operator",
      "auditor",
    ]),
    scopes: Object.freeze([
      "tenant",
      "portfolio",
      "property",
      "definition",
      "run",
    ]),
    metrics: Object.freeze(metrics),
    sourceVersions: Object.freeze([
      "au001a.v1",
      "au001b.v1",
      "au001c.v1",
      "au001e-operations.v1",
    ]),
    timeZonePolicy:
      "UTC source instants rendered in the explicitly selected IANA time zone.",
    freshnessPolicy:
      "Disclose the oldest source and never convert unavailable data to zero.",
    partialDataPolicy:
      "Exclude unauthorized records before aggregation and label missing or restricted sources.",
    inferenceProtection:
      "Observed automation and owning-capability outcomes do not establish causality or financial value.",
    exportFormats: Object.freeze(["csv", "print"] as const),
  });
export const AUTOMATION_STANDARD_REPORTS: readonly AutomationReportDefinition[] =
  Object.freeze([
    define(
      "portfolio-summary",
      "Automation Portfolio Summary",
      "Definition coverage, run volume, outcomes, and health.",
      ["definitions", "active-definitions", "run-volume", "overall-health"],
    ),
    define(
      "reliability",
      "Automation Reliability",
      "Success, retry, timeout, cancellation, quarantine, and failure rates.",
      [
        "terminal-runs",
        "success-rate",
        "failure-rate",
        "reconciliation-backlog",
      ],
    ),
    define(
      "trigger-scheduling",
      "Trigger and Scheduling Performance",
      "Trigger intake, deduplication, scheduling, and latency availability.",
      ["trigger-health", "scheduler-health", "expired-leases"],
    ),
    define(
      "approval-governance",
      "Approval Governance",
      "Approval requests, aging, dispositions, expiry, and governance evidence.",
      ["approval-backlog", "approval-oldest-age"],
    ),
    define(
      "execution-command-outcomes",
      "Execution and Command Outcomes",
      "Run and step results with owning-capability references.",
      ["run-volume", "terminal-runs", "command-failure-rate"],
    ),
    define(
      "reconciliation-recovery",
      "Reconciliation and Recovery",
      "Unknown outcomes, stuck work, intervention needs, and recovery state.",
      ["reconciliation-backlog", "human-review-backlog"],
    ),
    define(
      "value-outcomes",
      "Automation Value and Outcomes",
      "Measured outcomes when supplied by owning capabilities without invented attribution.",
      ["measured-outcomes-available"],
    ),
    define(
      "operational-health",
      "Operational Health and Service Levels",
      "Components, queues, breaches, incidents, and freshness.",
      ["overall-health", "degraded-components", "open-incidents"],
    ),
  ]);

export function getAutomationReportDefinition(key: string) {
  return AUTOMATION_STANDARD_REPORTS.find((item) => item.key === key);
}
export function generateAutomationReport(
  input: Readonly<{
    key: AutomationReportKey;
    projection: AutomationOperationsProjection;
    generatedAt: string;
  }>,
): AutomationReportResult {
  const definition = getAutomationReportDefinition(input.key);
  if (!definition) throw new Error("AUTOMATION_EXPORT_FAILED");
  const runQueue = input.projection.queues.find((q) => q.id === "in-progress"),
    approval = input.projection.queues.find((q) => q.id === "approvals"),
    failure = input.projection.serviceLevels.find(
      (s) => s.id === "command-failure-rate",
    );
  const metricMap: Readonly<Record<string, AutomationReportMetric>> =
    Object.freeze({
      "overall-health": metric(
        "overall-health",
        "Overall health",
        input.projection.overallHealth,
        "classification",
        "Deterministic precedence across authorized components.",
      ),
      "degraded-components": metric(
        "degraded-components",
        "Components needing attention",
        input.projection.components.filter((c) =>
          ["degraded", "unhealthy", "unknown"].includes(c.status),
        ).length,
        "count",
        "Components not proven healthy.",
      ),
      "open-incidents": metric(
        "open-incidents",
        "Open incidents",
        input.projection.incidents.filter((i) => i.status !== "resolved")
          .length,
        "count",
        "Projected operational incidents.",
      ),
      "run-volume": metric(
        "run-volume",
        "Current in-progress population",
        runQueue?.count ?? null,
        "count",
        runQueue
          ? "Authorized active run/step population."
          : "Run queue unavailable.",
        Boolean(runQueue),
      ),
      "approval-backlog": metric(
        "approval-backlog",
        "Approval backlog",
        approval?.count ?? null,
        "count",
        approval
          ? "Authorized pending approval population."
          : "Approval source unavailable.",
        Boolean(approval),
      ),
      "approval-oldest-age": metric(
        "approval-oldest-age",
        "Oldest approval age",
        approval?.oldestAgeMs ?? null,
        "duration-ms",
        approval
          ? "Age of the oldest authorized pending approval."
          : "Approval source unavailable.",
        Boolean(approval),
      ),
      "command-failure-rate": Object.freeze({
        key: "command-failure-rate",
        label: "Command failure rate",
        value: failure?.observedRate ?? null,
        unit: "percentage",
        state:
          failure?.observedRate === null || failure?.observedRate === undefined
            ? "unavailable"
            : "available",
        ...(failure ? { denominator: failure.population } : {}),
        explanation: failure?.explanation ?? "Execution source unavailable.",
      }),
      "reconciliation-backlog": metric(
        "reconciliation-backlog",
        "Reconciliation candidates",
        input.projection.reconciliation.candidateCount,
        "count",
        "Deterministically detected candidates; detection does not mutate source state.",
      ),
      "human-review-backlog": metric(
        "human-review-backlog",
        "Candidates requiring human review",
        input.projection.reconciliation.humanReviewCount,
        "count",
        "Unknown outcomes and unsafe recovery candidates.",
      ),
      "trigger-health": metric(
        "trigger-health",
        "Trigger intake health",
        input.projection.components.find((c) => c.id === "trigger-intake")
          ?.status ?? null,
        "classification",
        "Trigger source status; unavailable is not healthy.",
      ),
      "scheduler-health": metric(
        "scheduler-health",
        "Scheduler health",
        input.projection.components.find((c) => c.id === "scheduler")?.status ??
          null,
        "classification",
        "Scheduler and lease status.",
      ),
      "expired-leases": metric(
        "expired-leases",
        "Expired leases",
        input.projection.queues.find((q) => q.id === "expired-leases")?.count ??
          null,
        "count",
        "Leases expired without terminal work.",
      ),
      definitions: metric(
        "definitions",
        "Definitions",
        null,
        "count",
        "Definition total is unavailable in this derived operational source.",
        false,
      ),
      "active-definitions": metric(
        "active-definitions",
        "Active definitions",
        null,
        "count",
        "Active definition total is unavailable in this derived operational source.",
        false,
      ),
      "terminal-runs": metric(
        "terminal-runs",
        "Terminal runs",
        failure?.population ?? null,
        "count",
        "Terminal run denominator used for reliability.",
      ),
      "success-rate": metric(
        "success-rate",
        "Success rate",
        failure?.observedRate === null || failure?.observedRate === undefined
          ? null
          : 1 - failure.observedRate,
        "percentage",
        "One minus terminal failure rate.",
      ),
      "failure-rate": metric(
        "failure-rate",
        "Failure rate",
        failure?.observedRate ?? null,
        "percentage",
        failure?.explanation ?? "Unavailable.",
      ),
      "measured-outcomes-available": metric(
        "measured-outcomes-available",
        "Measured outcomes available",
        null,
        "count",
        "Owning-capability measurement adapter is not configured; no value is fabricated.",
        false,
      ),
    });
  const metrics = Object.freeze(
      definition.metrics.map((key) => metricMap[key]).filter(Boolean),
    ),
    rows = Object.freeze(
      metrics.map((item) =>
        Object.freeze({
          metric: item.label,
          value: item.value,
          unit: item.unit,
          state: item.state,
        }),
      ),
    );
  const base = {
    reportId: `${definition.id}:${input.generatedAt}`,
    key: input.key,
    definitionVersion: definition.version,
    generatedAt: input.generatedAt,
    timeZone: input.projection.scope.timeZone,
    scopeLabel: input.projection.scope.label,
    from: input.projection.scope.from,
    to: input.projection.scope.to,
    completeness:
      input.projection.freshness.status === "current"
        ? ("complete" as const)
        : input.projection.freshness.status === "stale"
          ? ("stale" as const)
          : input.projection.freshness.status === "unavailable"
            ? ("unavailable" as const)
            : ("partial" as const),
    metrics,
    rows,
    limitations: Object.freeze([
      ...input.projection.restrictions.map((r) => r.message),
      "Automation outcomes describe observed association and do not prove causality or financial value.",
    ]),
    sourceFreshness: input.projection.freshness,
  };
  return Object.freeze({ ...base, checksum: checksum(base) });
}
function metric(
  key: string,
  label: string,
  value: number | string | null,
  unit: AutomationReportMetric["unit"],
  explanation: string,
  available = value !== null,
): AutomationReportMetric {
  return Object.freeze({
    key,
    label,
    value,
    unit,
    state: available ? "available" : "unavailable",
    explanation,
  });
}
export function exportAutomationReportCsv(
  report: AutomationReportResult,
): AutomationReportExport {
  const columns = ["metric", "value", "unit", "state"],
    escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`,
    content =
      [
        columns.join(","),
        ...report.rows.map((row) =>
          columns.map((key) => escape(row[key])).join(","),
        ),
      ].join("\n") + "\n",
    digest = checksum({ reportChecksum: report.checksum, content });
  return Object.freeze({
    contentType: "text/csv",
    filename: `automation-${report.key}-${report.generatedAt.slice(0, 10)}.csv`,
    content,
    rowCount: report.rows.length,
    checksum: digest,
    generatedAt: report.generatedAt,
    metadata: Object.freeze({
      reportId: report.reportId,
      version: report.definitionVersion,
      timeZone: report.timeZone,
      scopeLabel: report.scopeLabel,
    }),
  });
}
function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

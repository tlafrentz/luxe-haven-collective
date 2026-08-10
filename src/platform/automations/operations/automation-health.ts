import type {
  AutomationRun,
  AutomationRunStep,
} from "../domain/automation-governed-execution";
import {
  AUTOMATION_HEALTH_POLICY_VERSION,
  AUTOMATION_OPERATIONS_PROJECTION_VERSION,
  type AutomationComponentHealth,
  type AutomationHealthStatus,
  type AutomationIntegrationHealth,
  type AutomationOperationScope,
  type AutomationOperationsPolicy,
  type AutomationOperationsProjection,
  type AutomationOperationsSource,
  type AutomationQueueHealth,
  type AutomationReconciliationCandidate,
  type AutomationServiceLevelProjection,
} from "./automation-operations-contracts";

export const DEFAULT_AUTOMATION_OPERATIONS_POLICY: AutomationOperationsPolicy =
  Object.freeze({
    version: AUTOMATION_HEALTH_POLICY_VERSION,
    staleAfterMs: 300_000,
    queueWarningMs: 900_000,
    queueCriticalMs: 3_600_000,
    approvalWarningMs: 86_400_000,
    approvalCriticalMs: 259_200_000,
    dispatchWarningMs: 300_000,
    runWarningMs: 3_600_000,
    reconciliationWarningMs: 3_600_000,
    failureRateWarning: 0.05,
    failureRateCritical: 0.2,
  });

const terminalRuns = new Set([
  "succeeded",
  "partially_succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "blocked",
  "expired",
]);
const terminalSteps = new Set([
  "succeeded",
  "failed_terminal",
  "cancelled",
  "skipped",
  "compensated",
  "compensation_failed",
]);
const age = (at: string, now: number) => Math.max(0, now - Date.parse(at));
const percentile = (values: readonly number[], ratio: number) =>
  values.length
    ? [...values].sort((a, b) => a - b)[
        Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))
      ]
    : null;

export function detectAutomationReconciliationCandidates(
  source: AutomationOperationsSource,
  nowIso: string,
): readonly AutomationReconciliationCandidate[] {
  const now = Date.parse(nowIso),
    candidates: AutomationReconciliationCandidate[] = [];
  for (const step of source.steps) {
    if (
      step.leaseExpiresAt &&
      Date.parse(step.leaseExpiresAt) < now &&
      ["leased", "dispatching"].includes(step.status)
    )
      candidates.push(
        candidate(
          "expired-lease",
          step.runId,
          step.id,
          nowIso,
          "The worker lease expired before a terminal result.",
          "release-lease",
          true,
          step.version,
        ),
      );
    if (step.status === "reconciliation_required")
      candidates.push(
        candidate(
          "unknown-outcome",
          step.runId,
          step.id,
          nowIso,
          "The owning command outcome is uncertain and must not be blindly retried.",
          "reconcile",
          true,
          step.version,
        ),
      );
  }
  for (const run of source.runs) {
    if (
      run.deadlineAt &&
      Date.parse(run.deadlineAt) < now &&
      !terminalRuns.has(run.status)
    )
      candidates.push(
        candidate(
          "execution-deadline",
          run.id,
          undefined,
          nowIso,
          "The run exceeded its execution deadline without a terminal state.",
          "reconcile",
          true,
          run.version,
        ),
      );
    if (
      terminalRuns.has(run.status) &&
      !source.hpmPublishedRunIds.includes(run.id)
    )
      candidates.push(
        candidate(
          "missing-hpm-lineage",
          run.id,
          undefined,
          nowIso,
          "The terminal run has not been published through the HPM source boundary.",
          "rebuild-projection",
          false,
          run.version,
        ),
      );
  }
  for (const intent of source.notificationIntents)
    if (intent.status === "failed")
      candidates.push(
        candidate(
          "notification-failure",
          undefined,
          intent.id,
          nowIso,
          "A notification intent failed delivery and remains durable.",
          "retry-notification",
          false,
        ),
      );
  return Object.freeze(candidates.sort((a, b) => a.id.localeCompare(b.id)));
}

function candidate(
  type: AutomationReconciliationCandidate["type"],
  runId: string | undefined,
  stepId: string | undefined,
  detectedAt: string,
  reason: string,
  safeRecovery: AutomationReconciliationCandidate["safeRecovery"],
  requiresHumanReview: boolean,
  expectedVersion?: number,
): AutomationReconciliationCandidate {
  return Object.freeze({
    id: ["au-rec-v1", type, runId ?? "none", stepId ?? "none"].join(":"),
    type,
    ...(runId ? { runId } : {}),
    ...(stepId ? { stepId } : {}),
    detectedAt,
    reason,
    safeRecovery,
    requiresHumanReview,
    ...(expectedVersion !== undefined ? { expectedVersion } : {}),
  });
}

export function projectAutomationOperations(
  input: Readonly<{
    scope: AutomationOperationScope;
    source: AutomationOperationsSource;
    integrations: readonly AutomationIntegrationHealth[];
    now: string;
    policy?: AutomationOperationsPolicy;
    operationsEnabled: boolean;
    killSwitch: boolean;
    operatorAuthorized: boolean;
  }>,
): AutomationOperationsProjection {
  const policy = input.policy ?? DEFAULT_AUTOMATION_OPERATIONS_POLICY,
    now = Date.parse(input.now);
  if (!Number.isFinite(now))
    throw new Error("AUTOMATION_OPERATIONS_SCOPE_INVALID");
  const staleAge = age(input.source.generatedFromAt, now),
    missingSources = [
      !input.source.triggerSourceAvailable ? "trigger-intake" : "",
      ...input.integrations
        .filter((item) => item.required && item.status !== "healthy")
        .map((item) => item.id),
    ].filter(Boolean);
  const freshness = Object.freeze({
    status: missingSources.length
      ? ("partial" as const)
      : staleAge > policy.staleAfterMs
        ? ("stale" as const)
        : ("current" as const),
    generatedAt: input.now,
    oldestSourceAt: input.source.generatedFromAt,
    staleAfterMs: policy.staleAfterMs,
    missingSources: Object.freeze(missingSources),
    restrictedRecordCount: input.source.restrictedRecordCount,
  });
  const candidates = detectAutomationReconciliationCandidates(
      input.source,
      input.now,
    ),
    queues = projectQueues(input.source, input.now, policy),
    serviceLevels = projectServiceLevels(input.source, input.now, policy),
    components = projectComponents(
      input.source,
      input.integrations,
      queues,
      candidates,
      freshness.status,
      input.now,
      policy,
      input.operationsEnabled,
      input.killSwitch,
    );
  const overallHealth = overallAutomationHealth(components),
    restrictions = Object.freeze([
      ...(input.source.restrictedRecordCount
        ? [
            {
              code: "AUTHORIZED_SUBSET",
              message: `${input.source.restrictedRecordCount} inaccessible records were excluded before aggregation.`,
            },
          ]
        : []),
      ...(freshness.status !== "current"
        ? [
            {
              code: "PARTIAL_OR_STALE",
              message:
                "Missing or stale sources are disclosed and are not treated as zero.",
            },
          ]
        : []),
      ...(input.killSwitch
        ? [
            {
              code: "KILL_SWITCH_ACTIVE",
              message:
                "New work is stopped; inspection and explicitly safe recovery remain available.",
            },
          ]
        : []),
    ]);
  const validCommands = input.operatorAuthorized
    ? Object.freeze([
        {
          type: "refresh" as const,
          label: "Refresh projection",
          targetId:
            input.scope.runId ??
            input.scope.definitionId ??
            input.scope.tenantId,
          requiresReason: false,
          requiresConfirmation: false,
          requiresDryRun: false,
          idempotencyKey: `au-op-refresh:${input.scope.tenantId}:${input.now}`,
          consequence:
            "Re-read authorized canonical facts without mutating automation state.",
        },
        ...candidates.map((item) =>
          Object.freeze({
            type:
              item.safeRecovery === "release-lease"
                ? ("release-expired-lease" as const)
                : item.safeRecovery === "retry-notification"
                  ? ("retry-notification" as const)
                  : item.safeRecovery === "rebuild-projection"
                    ? ("rebuild" as const)
                    : ("reconcile" as const),
            label:
              item.safeRecovery === "reconcile"
                ? "Reconcile from owning result"
                : item.safeRecovery.replaceAll("-", " "),
            targetId: item.stepId ?? item.runId ?? item.id,
            ...(item.expectedVersion !== undefined
              ? { expectedVersion: item.expectedVersion }
              : {}),
            requiresReason: true,
            requiresConfirmation: true,
            requiresDryRun: item.safeRecovery === "rebuild-projection",
            idempotencyKey: `au-op:${item.id}`,
            consequence: item.reason,
          }),
        ),
      ])
    : Object.freeze([]);
  return Object.freeze({
    projectionVersion: AUTOMATION_OPERATIONS_PROJECTION_VERSION,
    generatedAt: input.now,
    scope: input.scope,
    freshness,
    overallHealth,
    components,
    queues,
    serviceLevels,
    incidents: Object.freeze(
      components
        .filter((item) => item.status === "unhealthy")
        .map((item) =>
          Object.freeze({
            id: `au-incident:${item.id}`,
            severity: item.critical
              ? ("critical" as const)
              : ("major" as const),
            status: "open" as const,
            componentIds: Object.freeze([item.id]),
            scopeLabel: input.scope.label,
            firstObservedAt: input.now,
            lastObservedAt: input.now,
            reason: item.reasons.join(" "),
            relatedRunIds: Object.freeze([]),
            correlationIds: Object.freeze([]),
            runbook: item.investigationHref,
          }),
        ),
    ),
    integrations: input.integrations,
    reconciliation: Object.freeze({
      candidateCount: candidates.length,
      humanReviewCount: candidates.filter((item) => item.requiresHumanReview)
        .length,
      ...(candidates[0] ? { oldestCandidateAt: candidates[0].detectedAt } : {}),
      candidates,
    }),
    validCommands,
    restrictions,
  });
}

export function overallAutomationHealth(
  components: readonly AutomationComponentHealth[],
): AutomationHealthStatus {
  if (
    !components.length ||
    components.some((item) => item.status === "unknown" && item.critical)
  )
    return "unknown";
  if (components.some((item) => item.status === "unhealthy" && item.critical))
    return "unhealthy";
  if (
    components.some((item) =>
      ["unhealthy", "degraded", "unknown"].includes(item.status),
    )
  )
    return "degraded";
  if (components.every((item) => item.status === "disabled")) return "disabled";
  return "healthy";
}

function projectQueues(
  source: AutomationOperationsSource,
  nowIso: string,
  policy: AutomationOperationsPolicy,
): readonly AutomationQueueHealth[] {
  const groups: readonly [
    string,
    string,
    readonly (AutomationRun | AutomationRunStep)[],
  ][] = [
    [
      "approvals",
      "Runs awaiting approval",
      source.runs.filter((r) => r.status === "awaiting_approval"),
    ],
    [
      "dispatch",
      "Approved work awaiting dispatch",
      source.runs.filter((r) => ["approved", "queued"].includes(r.status)),
    ],
    [
      "in-progress",
      "Leased and in-progress work",
      source.steps.filter((s) =>
        ["leased", "dispatching", "accepted"].includes(s.status),
      ),
    ],
    [
      "retry",
      "Retry-delayed steps",
      source.steps.filter((s) => s.status === "failed_retryable"),
    ],
    [
      "reconciliation",
      "Uncertain outcomes",
      source.steps.filter((s) =>
        ["reconciliation_required", "reconciling"].includes(s.status),
      ),
    ],
    [
      "expired-leases",
      "Expired leases",
      source.steps.filter(
        (s) =>
          Boolean(s.leaseExpiresAt) &&
          Date.parse(s.leaseExpiresAt!) < Date.parse(nowIso) &&
          !terminalSteps.has(s.status),
      ),
    ],
  ];
  return Object.freeze(
    groups.map(([id, label, rows]) =>
      queue(
        id,
        label,
        rows.map((row) =>
          age(
            "createdAt" in row
              ? row.createdAt
              : (row.leaseAcquiredAt ?? nowIso),
            Date.parse(nowIso),
          ),
        ),
        policy.queueWarningMs,
        policy.queueCriticalMs,
      ),
    ),
  );
}
function queue(
  id: string,
  label: string,
  ages: readonly number[],
  warning: number,
  critical: number,
): AutomationQueueHealth {
  const oldest = ages.length ? Math.max(...ages) : null,
    status: AutomationHealthStatus =
      oldest === null
        ? "healthy"
        : oldest >= critical
          ? "unhealthy"
          : oldest >= warning
            ? "degraded"
            : "healthy";
  return Object.freeze({
    id,
    label,
    count: ages.length,
    oldestAgeMs: oldest,
    p50AgeMs: percentile(ages, 0.5),
    p95AgeMs: percentile(ages, 0.95),
    arrivalRatePerHour: null,
    completionRatePerHour: null,
    capacity:
      status === "unhealthy"
        ? "exhausted"
        : status === "degraded"
          ? "constrained"
          : "available",
    status,
    thresholdMs: warning,
  });
}
function projectServiceLevels(
  source: AutomationOperationsSource,
  nowIso: string,
  policy: AutomationOperationsPolicy,
): readonly AutomationServiceLevelProjection[] {
  const approvalAges = source.approvals
      .filter((a) => a.status === "pending")
      .map((a) => age(a.requestedAt, Date.parse(nowIso))),
    completed = source.runs.filter((r) => terminalRuns.has(r.status)),
    failed = completed.filter((r) =>
      ["failed", "timed_out"].includes(r.status),
    ).length,
    rate = completed.length ? failed / completed.length : null;
  return Object.freeze([
    {
      id: "approval-wait",
      label: "Approval waiting time",
      policyVersion: policy.version,
      targetMs: policy.approvalWarningMs,
      observedMs: approvalAges.length ? Math.max(...approvalAges) : 0,
      population: approvalAges.length,
      status: approvalAges.some((a) => a >= policy.approvalCriticalMs)
        ? "breached"
        : approvalAges.some((a) => a >= policy.approvalWarningMs)
          ? "warning"
          : "met",
      explanation:
        "Oldest pending approval compared with the configured service target.",
    },
    {
      id: "command-failure-rate",
      label: "Terminal command failure rate",
      policyVersion: policy.version,
      targetRate: policy.failureRateWarning,
      observedRate: rate,
      population: completed.length,
      status:
        rate === null
          ? "unknown"
          : rate >= policy.failureRateCritical
            ? "breached"
            : rate >= policy.failureRateWarning
              ? "warning"
              : "met",
      explanation:
        rate === null
          ? "No completed runs are available for a reliable denominator."
          : "Failed and timed-out runs divided by terminal runs.",
    },
  ]);
}
function projectComponents(
  source: AutomationOperationsSource,
  integrations: readonly AutomationIntegrationHealth[],
  queues: readonly AutomationQueueHealth[],
  candidates: readonly AutomationReconciliationCandidate[],
  freshness: "current" | "stale" | "partial" | "unavailable",
  now: string,
  policy: AutomationOperationsPolicy,
  enabled: boolean,
  kill: boolean,
): readonly AutomationComponentHealth[] {
  const make = (
    id: string,
    name: string,
    critical: boolean,
    status: AutomationHealthStatus,
    reasons: readonly string[],
    href: string,
  ): AutomationComponentHealth =>
    Object.freeze({
      id,
      name,
      critical,
      status,
      evaluatedAt: now,
      policyVersion: policy.version,
      measures: Object.freeze({}),
      thresholds: Object.freeze({ queueWarningMs: policy.queueWarningMs }),
      reasons: Object.freeze(reasons),
      freshness,
      restrictions: Object.freeze([]),
      investigationHref: href,
    });
  const queueStatus = (id: string) =>
    queues.find((q) => q.id === id)?.status ?? "unknown";
  return Object.freeze([
    make(
      "definitions",
      "Definition configuration",
      false,
      source.definitionCount ? "healthy" : "unknown",
      source.definitionCount
        ? []
        : ["No authorized definition population is available."],
      "/dashboard/automations/definitions",
    ),
    make(
      "trigger-intake",
      "Trigger intake",
      true,
      !enabled || kill
        ? "disabled"
        : source.triggerSourceAvailable
          ? "healthy"
          : "unknown",
      source.triggerSourceAvailable
        ? []
        : ["Trigger intake telemetry is unavailable."],
      "/dashboard/automations",
    ),
    make(
      "scheduler",
      "Scheduler and leases",
      true,
      !enabled || kill
        ? "disabled"
        : !source.schedulerEnabled
          ? "unknown"
          : queueStatus("expired-leases"),
      source.schedulerEnabled
        ? []
        : ["Scheduler lease acquisition is not configured."],
      "/dashboard/automations/runs",
    ),
    make(
      "approvals",
      "Approval backlog",
      false,
      queueStatus("approvals"),
      [],
      "/dashboard/automations/approvals",
    ),
    make(
      "execution",
      "Worker execution",
      true,
      !enabled || kill
        ? "disabled"
        : worst(queueStatus("dispatch"), queueStatus("in-progress")),
      [],
      "/dashboard/automations/runs",
    ),
    make(
      "command-adapters",
      "Command adapters",
      true,
      integrations.some((i) => i.required && i.status === "unhealthy")
        ? "unhealthy"
        : integrations.some((i) => ["degraded", "unknown"].includes(i.status))
          ? "degraded"
          : "healthy",
      integrations
        .filter((i) => i.status !== "healthy" && i.status !== "disabled")
        .map((i) => `${i.id}: ${i.compatibility}`),
      "/dashboard/automations/operations",
    ),
    make(
      "reconciliation",
      "Reconciliation",
      true,
      candidates.some((c) => c.requiresHumanReview) ? "degraded" : "healthy",
      candidates.length
        ? [
            `${candidates.length} deterministic candidate(s) require evaluation.`,
          ]
        : [],
      "/dashboard/automations/operations",
    ),
    make(
      "notifications",
      "Notification intents",
      false,
      source.notificationIntents.some((i) => i.status === "failed")
        ? "degraded"
        : "healthy",
      [],
      "/dashboard/automations/operations",
    ),
    make(
      "reporting",
      "Reporting and projection freshness",
      false,
      !source.reportingAvailable
        ? "unknown"
        : freshness === "current"
          ? "healthy"
          : "degraded",
      !source.reportingAvailable
        ? ["Reporting source is unavailable."]
        : freshness === "current"
          ? []
          : ["Projection sources are partial or stale."],
      "/dashboard/automations/operations",
    ),
  ]);
}
function worst(
  a: AutomationHealthStatus,
  b: AutomationHealthStatus,
): AutomationHealthStatus {
  const order: AutomationHealthStatus[] = [
    "healthy",
    "disabled",
    "degraded",
    "unknown",
    "unhealthy",
  ];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

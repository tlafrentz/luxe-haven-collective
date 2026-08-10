import type {
  AutomationRun,
  AutomationRunStep,
} from "../domain/automation-governed-execution";

export const AUTOMATION_OPERATIONS_PROJECTION_VERSION = "au001e-operations.v1";
export const AUTOMATION_HEALTH_POLICY_VERSION = "au001e-health.v1";
export const AUTOMATION_INTEGRATION_REGISTRY_VERSION = "au001e-integrations.v1";

export type AutomationHealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown"
  | "disabled";
export type AutomationOperationsFailureCode =
  | "AUTOMATION_OPERATIONS_UNAUTHORIZED"
  | "AUTOMATION_OPERATIONS_SCOPE_INVALID"
  | "AUTOMATION_PROJECTION_STALE"
  | "AUTOMATION_HEALTH_SOURCE_UNAVAILABLE"
  | "AUTOMATION_INTEGRATION_INCOMPATIBLE"
  | "AUTOMATION_INTEGRATION_UNAVAILABLE"
  | "AUTOMATION_RECONCILIATION_REQUIRED"
  | "AUTOMATION_RECONCILIATION_CONFLICT"
  | "AUTOMATION_RECOVERY_NOT_SAFE"
  | "AUTOMATION_REBUILD_ALREADY_RUNNING"
  | "AUTOMATION_REBUILD_LIMIT_EXCEEDED"
  | "AUTOMATION_EXPORT_FAILED"
  | "AUTOMATION_KILL_SWITCH_ACTIVE"
  | "CONCURRENT_MODIFICATION";

export type AutomationOperationScope = Readonly<{
  tenantId: string;
  type: "tenant" | "portfolio" | "property" | "definition" | "run";
  propertyIds: readonly string[];
  definitionId?: string;
  runId?: string;
  from: string;
  to: string;
  timeZone: string;
  label: string;
}>;

export type OperationsFreshness = Readonly<{
  status: "current" | "stale" | "partial" | "unavailable";
  generatedAt: string;
  oldestSourceAt?: string;
  staleAfterMs: number;
  missingSources: readonly string[];
  restrictedRecordCount: number;
}>;

export type AutomationComponentHealth = Readonly<{
  id: string;
  name: string;
  critical: boolean;
  status: AutomationHealthStatus;
  evaluatedAt: string;
  policyVersion: string;
  measures: Readonly<Record<string, number | string | null>>;
  thresholds: Readonly<Record<string, number | string>>;
  reasons: readonly string[];
  freshness: OperationsFreshness["status"];
  restrictions: readonly string[];
  investigationHref: string;
}>;

export type AutomationQueueHealth = Readonly<{
  id: string;
  label: string;
  count: number;
  oldestAgeMs: number | null;
  p50AgeMs: number | null;
  p95AgeMs: number | null;
  arrivalRatePerHour: number | null;
  completionRatePerHour: number | null;
  capacity: "available" | "constrained" | "exhausted" | "unknown";
  status: AutomationHealthStatus;
  thresholdMs: number;
}>;

export type AutomationServiceLevelProjection = Readonly<{
  id: string;
  label: string;
  policyVersion: string;
  targetMs?: number;
  targetRate?: number;
  observedMs?: number | null;
  observedRate?: number | null;
  population: number;
  status: "met" | "warning" | "breached" | "unknown" | "disabled";
  explanation: string;
}>;

export type AutomationOperationalIncident = Readonly<{
  id: string;
  severity: "warning" | "major" | "critical";
  status: "open" | "acknowledged" | "resolved";
  componentIds: readonly string[];
  scopeLabel: string;
  firstObservedAt: string;
  lastObservedAt: string;
  reason: string;
  relatedRunIds: readonly string[];
  correlationIds: readonly string[];
  owner?: string;
  runbook: string;
}>;

export type AutomationIntegrationHealth = Readonly<{
  id: string;
  owningCapability: string;
  direction: "inbound" | "outbound" | "bidirectional-read";
  required: boolean;
  configured: boolean;
  enabled: boolean;
  expectedVersions: readonly string[];
  observedVersion?: string;
  compatibility: "compatible" | "incompatible" | "unknown" | "disabled";
  status: AutomationHealthStatus;
  degradation: string;
  runbook: string;
}>;

export type AutomationReconciliationCandidate = Readonly<{
  id: string;
  type:
    | "expired-lease"
    | "execution-deadline"
    | "unknown-outcome"
    | "result-conflict"
    | "orphaned-request"
    | "missing-approval"
    | "duplicate-command"
    | "notification-failure"
    | "missing-hpm-lineage";
  runId?: string;
  stepId?: string;
  detectedAt: string;
  reason: string;
  safeRecovery:
    | "reconcile"
    | "release-lease"
    | "retry-notification"
    | "rebuild-projection"
    | "none";
  requiresHumanReview: boolean;
  expectedVersion?: number;
}>;

export type AutomationOperatorCommand = Readonly<{
  type:
    | "refresh"
    | "reevaluate"
    | "reconcile"
    | "release-expired-lease"
    | "retry-notification"
    | "quarantine"
    | "resume-adapter"
    | "rebuild"
    | "export-evidence";
  label: string;
  targetId: string;
  expectedVersion?: number;
  requiresReason: boolean;
  requiresConfirmation: boolean;
  requiresDryRun: boolean;
  idempotencyKey: string;
  consequence: string;
}>;

export type AutomationReconciliationSummary = Readonly<{
  candidateCount: number;
  humanReviewCount: number;
  oldestCandidateAt?: string;
  candidates: readonly AutomationReconciliationCandidate[];
}>;

export type ProjectionRestriction = Readonly<{ code: string; message: string }>;

export type AutomationOperationsProjection = Readonly<{
  projectionVersion: string;
  generatedAt: string;
  scope: AutomationOperationScope;
  freshness: OperationsFreshness;
  overallHealth: AutomationHealthStatus;
  components: readonly AutomationComponentHealth[];
  queues: readonly AutomationQueueHealth[];
  serviceLevels: readonly AutomationServiceLevelProjection[];
  incidents: readonly AutomationOperationalIncident[];
  integrations: readonly AutomationIntegrationHealth[];
  reconciliation: AutomationReconciliationSummary;
  validCommands: readonly AutomationOperatorCommand[];
  restrictions: readonly ProjectionRestriction[];
}>;

export type AutomationOperationsSource = Readonly<{
  runs: readonly AutomationRun[];
  steps: readonly AutomationRunStep[];
  approvals: readonly Readonly<{
    id: string;
    runId: string;
    status: string;
    requestedAt: string;
    expiresAt: string;
    version: number;
  }>[];
  notificationIntents: readonly Readonly<{
    id: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    attemptCount: number;
  }>[];
  definitionCount: number;
  activeDefinitionCount: number;
  triggerSourceAvailable: boolean;
  schedulerEnabled: boolean;
  reportingAvailable: boolean;
  hpmPublishedRunIds: readonly string[];
  generatedFromAt: string;
  restrictedRecordCount: number;
}>;

export type AutomationOperationsPolicy = Readonly<{
  version: string;
  staleAfterMs: number;
  queueWarningMs: number;
  queueCriticalMs: number;
  approvalWarningMs: number;
  approvalCriticalMs: number;
  dispatchWarningMs: number;
  runWarningMs: number;
  reconciliationWarningMs: number;
  failureRateWarning: number;
  failureRateCritical: number;
}>;

export type AutomationOperationsActor = Readonly<{
  actorId: string;
  tenantId: string;
  active: boolean;
  roleIds: readonly string[];
  propertyIds: readonly string[];
}>;

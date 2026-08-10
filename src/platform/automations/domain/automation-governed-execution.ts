import type { AutomationActor } from "./automation-definition";
import type { AutomationRunRequest, TriggerScope } from "./automation-triggering";

export const AUTOMATION_RUN_STATUSES = ["pending_policy_evaluation", "awaiting_approval", "approved", "queued", "running", "succeeded", "partially_succeeded", "failed", "timed_out", "cancellation_requested", "cancelled", "reconciliation_required", "reconciling", "blocked", "expired"] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];
export const AUTOMATION_STEP_STATUSES = ["pending", "awaiting_approval", "ready", "leased", "dispatching", "accepted", "succeeded", "failed_retryable", "failed_terminal", "timed_out", "cancellation_requested", "cancelled", "skipped", "reconciliation_required", "reconciling", "compensation_requested", "compensated", "compensation_failed"] as const;
export type AutomationStepStatus = (typeof AUTOMATION_STEP_STATUSES)[number];
export type AutomationPolicyDisposition = "permitted_without_additional_approval" | "approval_required" | "prohibited" | "insufficient_context" | "policy_unavailable";
export type AutomationContinuationRule = "all_succeeded" | "named_predecessor_succeeded" | "all_allowed_terminal" | "approved_after_partial_failure";

export type AutomationExecutionStepDefinition = Readonly<{
  key: string;
  owningCapability: string;
  commandType: string;
  commandContractVersion: string;
  dependencies: readonly string[];
  continuationRule: AutomationContinuationRule;
  namedPredecessor?: string;
  payload: Readonly<Record<string, unknown>>;
  expectedVersion?: number;
  approvalPolicyId: string;
  actorPolicyId: string;
  retryPolicyId: string;
  timeoutPolicyId: string;
  concurrencyGroup?: string;
  compensationCommandType?: string;
}>;

export type AutomationExecutionPlan = Readonly<{
  version: string;
  schemaVersion: "au001-execution-plan.v1";
  definitionVersionId: string;
  maximumSteps: number;
  steps: readonly AutomationExecutionStepDefinition[];
}>;

export type AutomationServiceActor = Readonly<{
  actorId: string;
  tenantId: string;
  policyId: string;
  active: boolean;
  grants: readonly Readonly<{ capability: string; commandType: string; propertyIds: readonly string[] }>[];
}>;

export type AutomationRun = Readonly<{
  id: string;
  tenantId: string;
  propertyIds: readonly string[];
  automationDefinitionId: string;
  automationDefinitionVersionId: string;
  automationDefinitionVersion: number;
  runRequestId: string;
  triggerOccurrenceId: string;
  executionPlanVersion: string;
  initiatingActorId: string;
  serviceActorPolicyId: string;
  correlationId: string;
  causationId: string;
  status: AutomationRunStatus;
  policyDecisionId?: string;
  createdAt: string;
  updatedAt: string;
  deadlineAt?: string;
  version: number;
}>;

export type AutomationRunStep = Readonly<{
  id: string;
  tenantId: string;
  runId: string;
  stepKey: string;
  owningCapability: string;
  commandType: string;
  commandContractVersion: string;
  dependencies: readonly string[];
  status: AutomationStepStatus;
  deterministicCommandId: string;
  idempotencyKey: string;
  expectedTargetVersion?: number;
  attemptCount: number;
  nextAttemptAt?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  version: number;
}>;

export type AutomationPolicyDecision = Readonly<{
  id: string;
  runId: string;
  disposition: AutomationPolicyDisposition;
  policyVersion: string;
  targetContextVersion: string;
  matchedRules: readonly string[];
  missingFacts: readonly string[];
  safeExplanation: string;
  evaluatedAt: string;
}>;

export type AutomationApproval = Readonly<{
  id: string;
  tenantId: string;
  runId: string;
  stepIds: readonly string[];
  definitionVersionId: string;
  commandFingerprint: string;
  targetContextVersion: string;
  policyVersion: string;
  status: "pending" | "approved" | "rejected" | "deferred" | "revision_requested" | "revoked" | "expired" | "invalidated";
  requestedAt: string;
  expiresAt: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  version: number;
}>;

export type AutomationCommandEnvelope = Readonly<{
  commandType: string;
  contractVersion: string;
  owningCapability: string;
  tenantId: string;
  propertyIds: readonly string[];
  targetType: string;
  targetId: string;
  payload: Readonly<Record<string, unknown>>;
  expectedTargetVersion?: number;
  commandId: string;
  idempotencyKey: string;
  runId: string;
  stepId: string;
  attemptId: string;
  definitionVersionId: string;
  executionPlanVersion: string;
  initiatingActorId: string;
  serviceActorId: string;
  approvalId?: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  issuedAt: string;
  deadlineAt: string;
  safeProvenance: Readonly<Record<string, string>>;
}>;

export type AutomationDispatchResult = Readonly<{
  classification: "accepted_async" | "succeeded_sync" | "authorization_rejected" | "validation_rejected" | "version_conflict" | "duplicate" | "retryable_failure" | "terminal_failure" | "known_not_accepted_timeout" | "uncertain" | "unsupported" | "target_unavailable";
  owningCommandId?: string;
  safeResultReference?: string;
  retryAfterMs?: number;
}>;

export type GovernedExecutionFailureCode =
  | "RUN_REQUEST_INELIGIBLE" | "RUN_ALREADY_EXISTS" | "DEFINITION_VERSION_UNAVAILABLE" | "EXECUTION_PLAN_INVALID" | "EXECUTION_PLAN_INCOMPATIBLE"
  | "AUTOMATION_NOT_ACTIVE" | "AUTOMATION_KILL_SWITCHED" | "POLICY_EVALUATION_FAILED" | "POLICY_PROHIBITED" | "APPROVAL_REQUIRED"
  | "APPROVAL_INVALID" | "APPROVAL_EXPIRED" | "APPROVAL_REVOKED" | "SERVICE_ACTOR_UNAUTHORIZED" | "TARGET_SCOPE_UNAUTHORIZED"
  | "COMMAND_CONTRACT_UNSUPPORTED" | "COMMAND_VALIDATION_FAILED" | "COMMAND_AUTHORIZATION_DENIED" | "EXPECTED_VERSION_CONFLICT"
  | "CONCURRENCY_LIMIT_REACHED" | "LEASE_CONFLICT" | "RETRY_BUDGET_EXHAUSTED" | "COMMAND_TIMED_OUT" | "COMMAND_OUTCOME_UNCERTAIN"
  | "RECONCILIATION_REQUIRED" | "RECONCILIATION_EXHAUSTED" | "CANCELLATION_UNSUPPORTED" | "COMPENSATION_UNSUPPORTED"
  | "DEPENDENCY_UNAVAILABLE" | "RUN_DEADLINE_EXCEEDED" | "CROSS_TENANT_ACCESS_DENIED" | "CROSS_PROPERTY_ACCESS_DENIED" | "CONCURRENT_MODIFICATION";

export class AutomationGovernedExecutionError extends Error {
  public constructor(public readonly code: GovernedExecutionFailureCode, message: string) { super(message); this.name = "AutomationGovernedExecutionError"; Object.freeze(this); }
}

const runTransitions: Readonly<Record<AutomationRunStatus, readonly AutomationRunStatus[]>> = Object.freeze({
  pending_policy_evaluation: ["awaiting_approval", "approved", "blocked", "expired"], awaiting_approval: ["approved", "blocked", "expired", "cancelled"],
  approved: ["queued", "cancelled", "expired"], queued: ["running", "cancellation_requested", "blocked", "expired"],
  running: ["succeeded", "partially_succeeded", "failed", "timed_out", "cancellation_requested", "reconciliation_required", "blocked"],
  cancellation_requested: ["cancelled", "partially_succeeded", "reconciliation_required"], reconciliation_required: ["reconciling", "blocked"],
  reconciling: ["running", "succeeded", "partially_succeeded", "failed", "blocked", "reconciliation_required"],
  succeeded: [], partially_succeeded: [], failed: [], timed_out: [], cancelled: [], blocked: [], expired: [],
});

const stepTransitions: Readonly<Record<AutomationStepStatus, readonly AutomationStepStatus[]>> = Object.freeze({
  pending: ["awaiting_approval", "ready", "skipped", "cancelled"], awaiting_approval: ["ready", "cancelled", "skipped"], ready: ["leased", "cancelled", "skipped"],
  leased: ["dispatching", "ready", "cancellation_requested", "reconciliation_required"], dispatching: ["accepted", "succeeded", "failed_retryable", "failed_terminal", "timed_out", "reconciliation_required"],
  accepted: ["succeeded", "failed_terminal", "timed_out", "cancellation_requested", "reconciliation_required"], failed_retryable: ["ready", "failed_terminal", "reconciliation_required"],
  timed_out: ["reconciliation_required", "failed_terminal"], cancellation_requested: ["cancelled", "reconciliation_required"], reconciliation_required: ["reconciling"],
  reconciling: ["succeeded", "failed_terminal", "ready", "reconciliation_required"], compensation_requested: ["compensated", "compensation_failed"],
  succeeded: ["compensation_requested"], failed_terminal: [], cancelled: [], skipped: [], compensated: [], compensation_failed: [],
});

export function transitionAutomationRun(run: AutomationRun, to: AutomationRunStatus, expectedVersion: number, at: string): AutomationRun {
  if (run.version !== expectedVersion) fail("CONCURRENT_MODIFICATION", "The automation run changed concurrently.");
  if (!runTransitions[run.status].includes(to)) fail("COMMAND_VALIDATION_FAILED", `Invalid run transition: ${run.status} to ${to}.`);
  instant(at, "Run transition timestamp");
  return Object.freeze({ ...run, status: to, updatedAt: at, version: run.version + 1 });
}

export function transitionAutomationStep(step: AutomationRunStep, to: AutomationStepStatus, expectedVersion: number): AutomationRunStep {
  if (step.version !== expectedVersion) fail("CONCURRENT_MODIFICATION", "The automation step changed concurrently.");
  if (!stepTransitions[step.status].includes(to)) fail("COMMAND_VALIDATION_FAILED", `Invalid step transition: ${step.status} to ${to}.`);
  return Object.freeze({ ...step, status: to, version: step.version + 1 });
}

export function validateExecutionPlan(plan: AutomationExecutionPlan): AutomationExecutionPlan {
  if (plan.schemaVersion !== "au001-execution-plan.v1" || !plan.version.trim() || !plan.definitionVersionId.trim()) fail("EXECUTION_PLAN_INCOMPATIBLE", "The execution plan contract is unsupported.");
  if (!Number.isSafeInteger(plan.maximumSteps) || plan.maximumSteps < 1 || plan.maximumSteps > 1000 || plan.steps.length > plan.maximumSteps) fail("EXECUTION_PLAN_INVALID", "The execution plan exceeds its bounded step limit.");
  const keys = new Set<string>();
  for (const step of plan.steps) {
    text(step.key, "Step key"); text(step.owningCapability, "Owning capability"); text(step.commandType, "Command type"); text(step.commandContractVersion, "Command contract version");
    if (keys.has(step.key)) fail("EXECUTION_PLAN_INVALID", "Execution plan step keys must be unique."); keys.add(step.key);
  }
  for (const step of plan.steps) for (const dependency of step.dependencies) if (!keys.has(dependency) || dependency === step.key) fail("EXECUTION_PLAN_INVALID", "Execution plan dependencies are invalid.");
  const visiting = new Set<string>(), visited = new Set<string>(), byKey = new Map(plan.steps.map((step) => [step.key, step]));
  const visit = (key: string) => { if (visiting.has(key)) fail("EXECUTION_PLAN_INVALID", "Execution plan dependencies contain a cycle."); if (visited.has(key)) return; visiting.add(key); for (const dependency of byKey.get(key)!.dependencies) visit(dependency); visiting.delete(key); visited.add(key); };
  for (const key of keys) visit(key);
  return Object.freeze({ ...plan, steps: Object.freeze(plan.steps.map((step) => Object.freeze({ ...step, dependencies: Object.freeze([...step.dependencies]), payload: Object.freeze({ ...step.payload }) }))) });
}

export function deterministicAutomationIdentity(parts: readonly string[]): string {
  if (!parts.length || parts.some((part) => !part.trim())) fail("COMMAND_VALIDATION_FAILED", "Deterministic identity inputs are incomplete.");
  return parts.map((part) => encodeURIComponent(part)).join(":");
}

export function materializeAutomationRun(input: Readonly<{ id: string; request: AutomationRunRequest; definitionVersionId: string; executionPlan: AutomationExecutionPlan; initiatingActor: AutomationActor; serviceActorPolicyId: string; now: string; deadlineAt?: string }>): Readonly<{ run: AutomationRun; steps: readonly AutomationRunStep[] }> {
  if (input.request.status !== "REQUESTED") fail("RUN_REQUEST_INELIGIBLE", "The run request is not eligible for execution.");
  if (input.initiatingActor.tenantId !== input.request.tenantId || !input.initiatingActor.active) fail("CROSS_TENANT_ACCESS_DENIED", "The initiating actor cannot access this run request.");
  const plan = validateExecutionPlan(input.executionPlan); if (plan.definitionVersionId !== input.definitionVersionId) fail("EXECUTION_PLAN_INCOMPATIBLE", "The execution plan is not bound to the requested definition version.");
  instant(input.now, "Run creation timestamp"); if (input.deadlineAt) instant(input.deadlineAt, "Run deadline");
  const run: AutomationRun = Object.freeze({ id: input.id, tenantId: input.request.tenantId, propertyIds: Object.freeze([...input.request.scope.propertyIds]), automationDefinitionId: input.request.automationId, automationDefinitionVersionId: input.definitionVersionId, automationDefinitionVersion: input.request.automationDefinitionVersion, runRequestId: input.request.id, triggerOccurrenceId: input.request.occurrenceId, executionPlanVersion: plan.version, initiatingActorId: input.initiatingActor.actorId, serviceActorPolicyId: input.serviceActorPolicyId, correlationId: input.request.correlationId, causationId: input.request.causationId ?? input.request.id, status: "pending_policy_evaluation", createdAt: input.now, updatedAt: input.now, ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}), version: 1 });
  const steps = plan.steps.map((definition, index): AutomationRunStep => Object.freeze({ id: deterministicAutomationIdentity([input.id, definition.key]), tenantId: run.tenantId, runId: run.id, stepKey: definition.key, owningCapability: definition.owningCapability, commandType: definition.commandType, commandContractVersion: definition.commandContractVersion, dependencies: Object.freeze([...definition.dependencies]), status: "pending", deterministicCommandId: deterministicAutomationIdentity(["aucmd-v1", input.id, definition.key, definition.commandContractVersion]), idempotencyKey: deterministicAutomationIdentity(["aucmd-idem-v1", input.id, definition.key, definition.commandContractVersion]), ...(definition.expectedVersion !== undefined ? { expectedTargetVersion: definition.expectedVersion } : {}), attemptCount: 0, version: 1 + index * 0 }));
  return Object.freeze({ run, steps: Object.freeze(steps) });
}

export function approvalIsValid(approval: AutomationApproval | undefined, input: Readonly<{ now: string; definitionVersionId: string; commandFingerprint: string; targetContextVersion: string; policyVersion: string }>): boolean {
  if (!approval || approval.status !== "approved" || Date.parse(approval.expiresAt) <= Date.parse(input.now)) return false;
  return approval.definitionVersionId === input.definitionVersionId && approval.commandFingerprint === input.commandFingerprint && approval.targetContextVersion === input.targetContextVersion && approval.policyVersion === input.policyVersion;
}

export function serviceActorCanDispatch(actor: AutomationServiceActor, envelope: Pick<AutomationCommandEnvelope, "tenantId" | "propertyIds" | "owningCapability" | "commandType">): boolean {
  return actor.active && actor.tenantId === envelope.tenantId && actor.grants.some((grant) => grant.capability === envelope.owningCapability && grant.commandType === envelope.commandType && envelope.propertyIds.every((id) => grant.propertyIds.includes(id)));
}

export type AutomationRetryPolicy = Readonly<{ version: string; maximumAttempts: number; maximumElapsedMs: number; initialDelayMs: number; maximumDelayMs: number; jitterRatio: number; retryableClassifications: readonly AutomationDispatchResult["classification"][] }>;
export function retryDelay(input: Readonly<{ policy: AutomationRetryPolicy; attempt: number; elapsedMs: number; classification: AutomationDispatchResult["classification"]; deterministicJitter: number }>): number | null {
  const { policy } = input;
  if (!Number.isSafeInteger(policy.maximumAttempts) || policy.maximumAttempts < 1 || policy.maximumAttempts > 20 || policy.maximumElapsedMs < 1 || policy.initialDelayMs < 1 || policy.maximumDelayMs < policy.initialDelayMs || policy.jitterRatio < 0 || policy.jitterRatio > 1) fail("COMMAND_VALIDATION_FAILED", "The retry policy is invalid.");
  if (!policy.retryableClassifications.includes(input.classification) || input.attempt >= policy.maximumAttempts || input.elapsedMs >= policy.maximumElapsedMs) return null;
  const base = Math.min(policy.maximumDelayMs, policy.initialDelayMs * 2 ** Math.max(0, input.attempt - 1));
  const boundedJitter = Math.max(-1, Math.min(1, input.deterministicJitter));
  return Math.max(0, Math.round(base + base * policy.jitterRatio * boundedJitter));
}

export function scopePropertyIds(scope: TriggerScope): readonly string[] { return scope.propertyIds; }
function fail(code: GovernedExecutionFailureCode, message: string): never { throw new AutomationGovernedExecutionError(code, message); }
function text(value: string, field: string) { if (!value.trim()) fail("EXECUTION_PLAN_INVALID", `${field} is required.`); }
function instant(value: string, field: string) { if (!Number.isFinite(Date.parse(value))) fail("COMMAND_VALIDATION_FAILED", `${field} is invalid.`); }

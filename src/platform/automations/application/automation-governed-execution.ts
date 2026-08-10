import type { AutomationActor } from "../domain/automation-definition";
import type { AutomationRunRequest } from "../domain/automation-triggering";
import {
  AutomationGovernedExecutionError, approvalIsValid, materializeAutomationRun, serviceActorCanDispatch, transitionAutomationRun, transitionAutomationStep,
  type AutomationApproval, type AutomationCommandEnvelope, type AutomationDispatchResult, type AutomationExecutionPlan, type AutomationPolicyDecision,
  type AutomationRun, type AutomationRunStatus, type AutomationRunStep, type AutomationServiceActor, type GovernedExecutionFailureCode,
} from "../domain/automation-governed-execution";

export type GovernedExecutionActivity = Readonly<{ id: string; tenantId: string; runId: string; stepId?: string; eventType: string; actorId: string; occurredAt: string; correlationId: string; causationId: string; aggregateVersion: number; safeMetadata: Readonly<Record<string, string | number | boolean | null>> }>;
export type GovernedNotificationIntent = Readonly<{ id: string; tenantId: string; recipientId: string; eventType: string; entityId: string; idempotencyKey: string; safeVariables: Readonly<Record<string, string>>; createdAt: string }>;
export type GovernedExecutionResult<T> = Readonly<{ ok: true; value: T } | { ok: false; code: GovernedExecutionFailureCode; message: string; currentVersion?: number; submittedInput?: unknown }>;

export interface GovernedExecutionRepository {
  getRunByRequest(tenantId: string, runRequestId: string): Promise<AutomationRun | null>;
  getRun(tenantId: string, runId: string): Promise<AutomationRun | null>;
  getSteps(tenantId: string, runId: string): Promise<readonly AutomationRunStep[]>;
  getApproval(tenantId: string, approvalId: string): Promise<AutomationApproval | null>;
  materialize(input: Readonly<{ run: AutomationRun; steps: readonly AutomationRunStep[]; activity: GovernedExecutionActivity }>): Promise<Readonly<{ created: boolean; run: AutomationRun; steps: readonly AutomationRunStep[] }>>;
  applyPolicy(input: Readonly<{ run: AutomationRun; expectedVersion: number; decision: AutomationPolicyDecision; steps: readonly AutomationRunStep[]; approval?: AutomationApproval; activity: readonly GovernedExecutionActivity[]; notifications: readonly GovernedNotificationIntent[] }>): Promise<AutomationRun>;
  transition(input: Readonly<{ run: AutomationRun; steps?: readonly AutomationRunStep[]; expectedVersion: number; activity: readonly GovernedExecutionActivity[]; notifications?: readonly GovernedNotificationIntent[] }>): Promise<AutomationRun>;
  decideApproval(input: Readonly<{ approval: AutomationApproval; expectedVersion: number; run: AutomationRun; expectedRunVersion: number; steps: readonly AutomationRunStep[]; dispositionId: string; activity: readonly GovernedExecutionActivity[]; notifications: readonly GovernedNotificationIntent[] }>): Promise<Readonly<{ approval: AutomationApproval; run: AutomationRun }>>;
  claimStep(input: Readonly<{ tenantId: string; stepId: string; expectedVersion: number; workerId: string; now: string; leaseDurationMs: number }>): Promise<AutomationRunStep | null>;
  recordDispatch(input: Readonly<{ run: AutomationRun; step: AutomationRunStep; expectedRunVersion: number; expectedStepVersion: number; result: AutomationDispatchResult; attemptId: string; now: string; activity: readonly GovernedExecutionActivity[]; notifications: readonly GovernedNotificationIntent[] }>): Promise<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>;
}
export interface AutomationPolicyEvaluator { evaluate(input: Readonly<{ run: AutomationRun; request: AutomationRunRequest; plan: AutomationExecutionPlan; now: string }>): Promise<AutomationPolicyDecision>; }
export interface AutomationApprovalAuthority { canApprove(actor: AutomationActor, run: AutomationRun): Promise<boolean>; }
export interface AutomationCommandPort {
  capability: string; contractVersions: readonly string[];
  authorizeAndValidate(envelope: AutomationCommandEnvelope): Promise<Readonly<{ allowed: boolean; classification?: GovernedExecutionFailureCode }>>;
  dispatch(envelope: AutomationCommandEnvelope): Promise<AutomationDispatchResult>;
  getCommandStatus(commandId: string, idempotencyKey: string): Promise<AutomationDispatchResult>;
}
export interface AutomationDefinitionExecutionReader { getExecution(input: Readonly<{ tenantId: string; automationId: string; version: number }>): Promise<Readonly<{ definitionVersionId: string; active: boolean; killSwitched: boolean; plan: AutomationExecutionPlan }> | null>; }
export interface GovernedExecutionTelemetry { emit(event: Readonly<{ name: string; tenantId: string; runId?: string; stepId?: string; classification?: string; correlationId: string; at: string }>): void; }

export function createGovernedExecutionService(dependencies: Readonly<{
  repository: GovernedExecutionRepository; definitions: AutomationDefinitionExecutionReader; policy: AutomationPolicyEvaluator; approvalAuthority: AutomationApprovalAuthority;
  ports: readonly AutomationCommandPort[]; serviceActor: AutomationServiceActor; clock: () => string; id: () => string; telemetry?: GovernedExecutionTelemetry;
  enabled: () => boolean; killSwitched: () => boolean; leaseDurationMs: number;
}>) {
  const ports = new Map(dependencies.ports.map((port) => [port.capability, port]));
  const signal = (name: string, input: { tenantId: string; correlationId: string; runId?: string; stepId?: string; classification?: string }) => dependencies.telemetry?.emit({ name, ...input, at: dependencies.clock() });
  return Object.freeze({
    async materialize(input: Readonly<{ request: AutomationRunRequest; actor: AutomationActor; serviceActorPolicyId: string; deadlineAt?: string }>): Promise<GovernedExecutionResult<Readonly<{ run: AutomationRun; steps: readonly AutomationRunStep[]; created: boolean }>>> {
      try {
        available();
        const existing = await dependencies.repository.getRunByRequest(input.request.tenantId, input.request.id);
        if (existing) return success({ run: existing, steps: await dependencies.repository.getSteps(existing.tenantId, existing.id), created: false });
        const definition = await dependencies.definitions.getExecution({ tenantId: input.request.tenantId, automationId: input.request.automationId, version: input.request.automationDefinitionVersion });
        if (!definition) throw new AutomationGovernedExecutionError("DEFINITION_VERSION_UNAVAILABLE", "The requested definition version is unavailable.");
        if (!definition.active) throw new AutomationGovernedExecutionError("AUTOMATION_NOT_ACTIVE", "The automation is not active.");
        if (definition.killSwitched) throw new AutomationGovernedExecutionError("AUTOMATION_KILL_SWITCHED", "Automation dispatch is disabled.");
        const now = dependencies.clock(), aggregate = materializeAutomationRun({ id: dependencies.id(), request: input.request, definitionVersionId: definition.definitionVersionId, executionPlan: definition.plan, initiatingActor: input.actor, serviceActorPolicyId: input.serviceActorPolicyId, now, ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}) });
        const persisted = await dependencies.repository.materialize({ ...aggregate, activity: activity(dependencies.id(), aggregate.run, undefined, "automation_run_materialized", input.actor.actorId, now) });
        signal("automation.run.materialized", { tenantId: persisted.run.tenantId, runId: persisted.run.id, correlationId: persisted.run.correlationId });
        return success({ ...persisted });
      } catch (error) { return failure(error, input); }
    },
    async evaluatePolicy(input: Readonly<{ request: AutomationRunRequest; runId: string; expectedVersion: number; actor: AutomationActor; approvalExpiresAt?: string }>): Promise<GovernedExecutionResult<AutomationRun>> {
      try {
        available(); const run = await requiredRun(input.request.tenantId, input.runId); version(run, input.expectedVersion); authorizeActor(input.actor, run);
        const definition = await dependencies.definitions.getExecution({ tenantId: run.tenantId, automationId: run.automationDefinitionId, version: run.automationDefinitionVersion });
        if (!definition) throw new AutomationGovernedExecutionError("DEFINITION_VERSION_UNAVAILABLE", "The requested definition version is unavailable.");
        const decision = await dependencies.policy.evaluate({ run, request: input.request, plan: definition.plan, now: dependencies.clock() });
        if (["policy_unavailable", "insufficient_context"].includes(decision.disposition)) throw new AutomationGovernedExecutionError("POLICY_EVALUATION_FAILED", "Execution policy could not safely authorize this run.");
        if (decision.disposition === "prohibited") throw new AutomationGovernedExecutionError("POLICY_PROHIBITED", "Execution policy prohibits this run.");
        const now = dependencies.clock(), steps = await dependencies.repository.getSteps(run.tenantId, run.id), requiresApproval = decision.disposition === "approval_required";
        const transitioned = transitionAutomationRun(run, requiresApproval ? "awaiting_approval" : "approved", input.expectedVersion, now);
        const nextSteps = steps.map((step) => transitionAutomationStep(step, requiresApproval ? "awaiting_approval" : step.dependencies.length ? "pending" : "ready", step.version));
        const approval = requiresApproval ? approvalFor(dependencies.id(), transitioned, nextSteps, decision, now, input.approvalExpiresAt) : undefined;
        const events = [activity(dependencies.id(), transitioned, undefined, "automation_policy_evaluated", input.actor.actorId, now), ...(approval ? [activity(dependencies.id(), transitioned, undefined, "automation_approval_requested", input.actor.actorId, now)] : [])];
        const notifications = approval ? [notification(dependencies.id(), transitioned, input.actor.actorId, "automation_approval_requested", now)] : [];
        const saved = await dependencies.repository.applyPolicy({ run: transitioned, expectedVersion: input.expectedVersion, decision, steps: nextSteps, ...(approval ? { approval } : {}), activity: events, notifications });
        return success(saved);
      } catch (error) { return failure(error, input); }
    },
    async decideApproval(input: Readonly<{ tenantId: string; approvalId: string; expectedApprovalVersion: number; expectedRunVersion: number; actor: AutomationActor; disposition: "approve" | "reject" | "defer" | "request_revision" | "revoke"; reason?: string }>): Promise<GovernedExecutionResult<Readonly<{ approval: AutomationApproval; run: AutomationRun }>>> {
      try {
        available(); const approval = await dependencies.repository.getApproval(input.tenantId, input.approvalId); if (!approval) throw new AutomationGovernedExecutionError("APPROVAL_INVALID", "The approval request was not found.");
        const run = await requiredRun(input.tenantId, approval.runId); version(run, input.expectedRunVersion); if (approval.version !== input.expectedApprovalVersion) throw new AutomationGovernedExecutionError("CONCURRENT_MODIFICATION", "The approval changed concurrently.");
        if (!await dependencies.approvalAuthority.canApprove(input.actor, run)) throw new AutomationGovernedExecutionError("COMMAND_AUTHORIZATION_DENIED", "The actor cannot decide this approval.");
        if (approval.status !== "pending" || Date.parse(approval.expiresAt) <= Date.parse(dependencies.clock())) throw new AutomationGovernedExecutionError("APPROVAL_EXPIRED", "The approval is no longer actionable.");
        if (input.disposition !== "approve" && !input.reason?.trim()) throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "A reason is required for this approval disposition.");
        const now = dependencies.clock(), status = input.disposition === "approve" ? "approved" : input.disposition === "reject" ? "rejected" : input.disposition === "defer" ? "deferred" : input.disposition === "request_revision" ? "revision_requested" : "revoked";
        const decided: AutomationApproval = Object.freeze({ ...approval, status, decidedBy: input.actor.actorId, decidedAt: now, ...(input.reason ? { reason: input.reason.trim() } : {}), version: approval.version + 1 });
        const steps = await dependencies.repository.getSteps(run.tenantId, run.id), nextRun = input.disposition === "approve" ? transitionAutomationRun(run, "approved", run.version, now) : transitionAutomationRun(run, input.disposition === "defer" || input.disposition === "request_revision" ? "blocked" : "blocked", run.version, now);
        const nextSteps = input.disposition === "approve" ? steps.map((step) => step.status === "awaiting_approval" ? transitionAutomationStep(step, step.dependencies.length ? "pending" : "ready", step.version) : step) : steps;
        return success(await dependencies.repository.decideApproval({ approval: decided, expectedVersion: input.expectedApprovalVersion, run: nextRun, expectedRunVersion: input.expectedRunVersion, steps: nextSteps, dispositionId: dependencies.id(), activity: [activity(dependencies.id(), nextRun, undefined, `automation_approval_${status}`, input.actor.actorId, now)], notifications: [notification(dependencies.id(), nextRun, run.initiatingActorId, `automation_approval_${status}`, now)] }));
      } catch (error) { return failure(error, input); }
    },
    async dispatch(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedRunVersion: number; expectedStepVersion: number; workerId: string; targetType: string; targetId: string; targetContextVersion: string; policyVersion: string; payload: Readonly<Record<string, unknown>>; approval?: AutomationApproval }>): Promise<GovernedExecutionResult<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>> {
      try {
        available(); const run = await requiredRun(input.tenantId, input.runId); version(run, input.expectedRunVersion);
        if (!["approved", "queued", "running"].includes(run.status)) throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "The run is not dispatchable.");
        if (run.deadlineAt && Date.parse(run.deadlineAt) <= Date.parse(dependencies.clock())) throw new AutomationGovernedExecutionError("RUN_DEADLINE_EXCEEDED", "The run deadline has elapsed.");
        const leased = await dependencies.repository.claimStep({ tenantId: input.tenantId, stepId: input.stepId, expectedVersion: input.expectedStepVersion, workerId: input.workerId, now: dependencies.clock(), leaseDurationMs: dependencies.leaseDurationMs });
        if (!leased) throw new AutomationGovernedExecutionError("LEASE_CONFLICT", "The step lease is unavailable.");
        const port = ports.get(leased.owningCapability); if (!port || !port.contractVersions.includes(leased.commandContractVersion)) throw new AutomationGovernedExecutionError("COMMAND_CONTRACT_UNSUPPORTED", "The owning capability command contract is unsupported.");
        const commandFingerprint = `${leased.deterministicCommandId}:${input.targetId}:${JSON.stringify(input.payload)}`;
        const approvalRequired = input.approval !== undefined || leased.status === "awaiting_approval";
        if (approvalRequired && !approvalIsValid(input.approval, { now: dependencies.clock(), definitionVersionId: run.automationDefinitionVersionId, commandFingerprint, targetContextVersion: input.targetContextVersion, policyVersion: input.policyVersion })) throw new AutomationGovernedExecutionError("APPROVAL_INVALID", "The required approval is missing, expired, or invalidated.");
        const attemptId = dependencies.id(), now = dependencies.clock();
        const envelope: AutomationCommandEnvelope = Object.freeze({ commandType: leased.commandType, contractVersion: leased.commandContractVersion, owningCapability: leased.owningCapability, tenantId: run.tenantId, propertyIds: run.propertyIds, targetType: input.targetType, targetId: input.targetId, payload: Object.freeze({ ...input.payload }), ...(leased.expectedTargetVersion !== undefined ? { expectedTargetVersion: leased.expectedTargetVersion } : {}), commandId: leased.deterministicCommandId, idempotencyKey: leased.idempotencyKey, runId: run.id, stepId: leased.id, attemptId, definitionVersionId: run.automationDefinitionVersionId, executionPlanVersion: run.executionPlanVersion, initiatingActorId: run.initiatingActorId, serviceActorId: dependencies.serviceActor.actorId, ...(input.approval ? { approvalId: input.approval.id } : {}), correlationId: run.correlationId, causationId: run.causationId, traceId: attemptId, issuedAt: now, deadlineAt: run.deadlineAt ?? new Date(Date.parse(now) + 300_000).toISOString(), safeProvenance: Object.freeze({ runRequestId: run.runRequestId, triggerOccurrenceId: run.triggerOccurrenceId }) });
        if (!serviceActorCanDispatch(dependencies.serviceActor, envelope)) throw new AutomationGovernedExecutionError("SERVICE_ACTOR_UNAUTHORIZED", "The automation service actor lacks this command grant.");
        const gate = await port.authorizeAndValidate(envelope); if (!gate.allowed) throw new AutomationGovernedExecutionError(gate.classification ?? "COMMAND_AUTHORIZATION_DENIED", "The owning capability denied this command.");
        signal("automation.command.dispatch_started", { tenantId: run.tenantId, runId: run.id, stepId: leased.id, correlationId: run.correlationId });
        const result = await port.dispatch(envelope), classified = classify(result), nextStep = transitionAutomationStep(leased, classified.stepStatus, leased.version);
        const nextRun = run.status === "approved" || run.status === "queued" ? transitionAutomationRun(run, "running", run.version, now) : run;
        const saved = await dependencies.repository.recordDispatch({ run: nextRun, step: nextStep, expectedRunVersion: input.expectedRunVersion, expectedStepVersion: leased.version, result, attemptId, now, activity: [activity(dependencies.id(), nextRun, nextStep, classified.eventType, dependencies.serviceActor.actorId, now)], notifications: classified.notify ? [notification(dependencies.id(), nextRun, run.initiatingActorId, classified.notify, now)] : [] });
        return success(saved);
      } catch (error) { return failure(error, input); }
    },
    async reconcile(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedRunVersion: number; expectedStepVersion: number }>): Promise<GovernedExecutionResult<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>> {
      try {
        available(); const run = await requiredRun(input.tenantId, input.runId), steps = await dependencies.repository.getSteps(input.tenantId, input.runId), step = steps.find(({ id }) => id === input.stepId);
        if (!step) throw new AutomationGovernedExecutionError("DEPENDENCY_UNAVAILABLE", "The run step was not found."); version(run, input.expectedRunVersion); if (step.version !== input.expectedStepVersion) throw new AutomationGovernedExecutionError("CONCURRENT_MODIFICATION", "The automation step changed concurrently.");
        if (step.status !== "reconciliation_required" && step.status !== "reconciling") throw new AutomationGovernedExecutionError("RECONCILIATION_REQUIRED", "This step is not eligible for reconciliation.");
        const port = ports.get(step.owningCapability); if (!port) throw new AutomationGovernedExecutionError("COMMAND_CONTRACT_UNSUPPORTED", "The owning capability adapter is unavailable.");
        const result = await port.getCommandStatus(step.deterministicCommandId, step.idempotencyKey), classified = classify(result), nextStep = transitionAutomationStep(step.status === "reconciliation_required" ? transitionAutomationStep(step, "reconciling", step.version) : step, classified.stepStatus, step.status === "reconciliation_required" ? step.version + 1 : step.version);
        const saved = await dependencies.repository.recordDispatch({ run, step: nextStep, expectedRunVersion: input.expectedRunVersion, expectedStepVersion: input.expectedStepVersion, result, attemptId: dependencies.id(), now: dependencies.clock(), activity: [activity(dependencies.id(), run, nextStep, "automation_reconciliation_completed", dependencies.serviceActor.actorId, dependencies.clock())], notifications: [] }); return success(saved);
      } catch (error) { return failure(error, input); }
    },
  });
  function available() { if (!dependencies.enabled() || dependencies.killSwitched()) throw new AutomationGovernedExecutionError("AUTOMATION_KILL_SWITCHED", "Governed automation execution is disabled."); }
  async function requiredRun(tenantId: string, runId: string) { const run = await dependencies.repository.getRun(tenantId, runId); if (!run) throw new AutomationGovernedExecutionError("RUN_REQUEST_INELIGIBLE", "The automation run was not found."); return run; }
}

function classify(result: AutomationDispatchResult): Readonly<{ stepStatus: AutomationRunStep["status"]; eventType: string; notify?: string }> {
  if (result.classification === "succeeded_sync" || result.classification === "duplicate") return { stepStatus: "succeeded", eventType: "automation_command_succeeded" };
  if (result.classification === "accepted_async") return { stepStatus: "accepted", eventType: "automation_command_accepted" };
  if (result.classification === "retryable_failure" || result.classification === "known_not_accepted_timeout") return { stepStatus: "failed_retryable", eventType: "automation_retry_required" };
  if (result.classification === "uncertain") return { stepStatus: "reconciliation_required", eventType: "automation_reconciliation_required", notify: "automation_reconciliation_required" };
  return { stepStatus: "failed_terminal", eventType: "automation_command_failed", notify: "automation_run_failed" };
}
function version(run: AutomationRun, expected: number) { if (run.version !== expected) throw new AutomationGovernedExecutionError("CONCURRENT_MODIFICATION", "The automation run changed concurrently."); }
function authorizeActor(actor: AutomationActor, run: AutomationRun) { if (!actor.active || actor.tenantId !== run.tenantId || actor.role === "viewer" || actor.role === "contributor" || actor.role === "operator" && run.propertyIds.some((id) => !actor.propertyIds.includes(id))) throw new AutomationGovernedExecutionError("TARGET_SCOPE_UNAUTHORIZED", "The actor cannot govern this run."); }
function activity(id: string, run: AutomationRun, step: AutomationRunStep | undefined, eventType: string, actorId: string, occurredAt: string): GovernedExecutionActivity { return Object.freeze({ id, tenantId: run.tenantId, runId: run.id, ...(step ? { stepId: step.id } : {}), eventType, actorId, occurredAt, correlationId: run.correlationId, causationId: run.causationId, aggregateVersion: step?.version ?? run.version, safeMetadata: Object.freeze({ runStatus: run.status, ...(step ? { stepStatus: step.status, capability: step.owningCapability } : {}) }) }); }
function notification(id: string, run: AutomationRun, recipientId: string, eventType: string, createdAt: string): GovernedNotificationIntent { return Object.freeze({ id, tenantId: run.tenantId, recipientId, eventType, entityId: run.id, idempotencyKey: `${eventType}:${run.id}:${run.version}`, safeVariables: Object.freeze({ runId: run.id }), createdAt }); }
function approvalFor(id: string, run: AutomationRun, steps: readonly AutomationRunStep[], decision: AutomationPolicyDecision, now: string, expiresAt?: string): AutomationApproval { return Object.freeze({ id, tenantId: run.tenantId, runId: run.id, stepIds: Object.freeze(steps.map(({ id }) => id)), definitionVersionId: run.automationDefinitionVersionId, commandFingerprint: "pending-command-set", targetContextVersion: decision.targetContextVersion, policyVersion: decision.policyVersion, status: "pending", requestedAt: now, expiresAt: expiresAt ?? new Date(Date.parse(now) + 86_400_000).toISOString(), version: 1 }); }
function success<T>(value: T): GovernedExecutionResult<T> { return Object.freeze({ ok: true, value }); }
function failure(error: unknown, submittedInput?: unknown): GovernedExecutionResult<never> { if (error instanceof AutomationGovernedExecutionError) return Object.freeze({ ok: false, code: error.code, message: error.message, submittedInput }); return Object.freeze({ ok: false, code: "POLICY_EVALUATION_FAILED", message: "Governed automation execution failed safely.", submittedInput }); }

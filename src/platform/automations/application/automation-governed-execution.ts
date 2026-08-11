import type { AutomationActor } from "../domain/automation-definition";
import type { AutomationRunRequest } from "../domain/automation-triggering";
import {
  AutomationGovernedExecutionError, approvalIsValid, canonicalAutomationJson, executionPlanFingerprint, materializeAutomationRun, retryDelay, serviceActorCanDispatch, transitionAutomationRun, transitionAutomationStep,
  type AutomationApproval, type AutomationCommandEnvelope, type AutomationDispatchResult, type AutomationExecutionPlan, type AutomationPolicyDecision,
  type AutomationRetryPolicy, type AutomationRun, type AutomationRunStep, type AutomationServiceActor, type GovernedExecutionFailureCode,
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
  heartbeatStep(input: Readonly<{ tenantId: string; stepId: string; workerId: string; leaseGeneration: number; expectedVersion: number; now: string; leaseDurationMs: number }>): Promise<AutomationRunStep>;
  reclaimExpiredStep(input: Readonly<{ tenantId: string; stepId: string; expectedVersion: number; now: string; outcomeChecked: boolean }>): Promise<AutomationRunStep>;
  markDispatching(input: Readonly<{ step: AutomationRunStep; expectedVersion: number; now: string; activity: GovernedExecutionActivity }>): Promise<AutomationRunStep>;
  recordDispatch(input: Readonly<{ run: AutomationRun; step: AutomationRunStep; expectedRunVersion: number; expectedStepVersion: number; result: AutomationDispatchResult; attemptId: string; now: string; activity: readonly GovernedExecutionActivity[]; notifications: readonly GovernedNotificationIntent[] }>): Promise<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>;
}
export interface AutomationPolicyEvaluator { evaluate(input: Readonly<{ run: AutomationRun; request: AutomationRunRequest; plan: AutomationExecutionPlan; now: string }>): Promise<AutomationPolicyDecision>; }
export interface AutomationApprovalAuthority { canApprove(actor: AutomationActor, run: AutomationRun): Promise<boolean>; }
export interface AutomationCommandPort {
  capability: string; contractVersions: readonly string[];
  authorizeAndValidate(envelope: AutomationCommandEnvelope): Promise<Readonly<{ allowed: boolean; classification?: GovernedExecutionFailureCode }>>;
  dispatch(envelope: AutomationCommandEnvelope): Promise<AutomationDispatchResult>;
  getCommandStatus(commandId: string, idempotencyKey: string): Promise<AutomationDispatchResult>;
  requestCancellation?(commandId: string, idempotencyKey: string, reason: string): Promise<AutomationDispatchResult>;
  requestCompensation?(envelope: AutomationCommandEnvelope): Promise<AutomationDispatchResult>;
}
export interface AutomationDefinitionExecutionReader { getExecution(input: Readonly<{ tenantId: string; automationId: string; version: number }>): Promise<Readonly<{ definitionVersionId: string; active: boolean; killSwitched: boolean; plan: AutomationExecutionPlan }> | null>; }
export interface GovernedExecutionTelemetry { emit(event: Readonly<{ name: string; tenantId: string; runId?: string; stepId?: string; classification?: string; correlationId: string; at: string }>): void; }

export function createGovernedExecutionService(dependencies: Readonly<{
  repository: GovernedExecutionRepository; definitions: AutomationDefinitionExecutionReader; policy: AutomationPolicyEvaluator; approvalAuthority: AutomationApprovalAuthority;
  ports: readonly AutomationCommandPort[]; serviceActor: AutomationServiceActor; clock: () => string; id: () => string; telemetry?: GovernedExecutionTelemetry;
  enabled: () => boolean; dispatchEnabled?: () => boolean; killSwitched: () => boolean; leaseDurationMs: number; retryPolicy: AutomationRetryPolicy;
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
        let transitioned = transitionAutomationRun(run, requiresApproval ? "awaiting_approval" : "approved", input.expectedVersion, now);
        const nextSteps = steps.map((step) => transitionAutomationStep(step, requiresApproval ? "awaiting_approval" : step.dependencies.length ? "pending" : "ready", step.version));
        const approval = requiresApproval ? approvalFor(dependencies.id(), transitioned, nextSteps, definition.plan, decision, now, input.approvalExpiresAt) : undefined;
        if (approval) transitioned = Object.freeze({ ...transitioned, approvalId: approval.id });
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
        available(); if (dependencies.dispatchEnabled && !dependencies.dispatchEnabled()) throw new AutomationGovernedExecutionError("AUTOMATION_KILL_SWITCHED", "Automation command dispatch is disabled."); const run = await requiredRun(input.tenantId, input.runId); version(run, input.expectedRunVersion);
        if (!["approved", "queued", "running"].includes(run.status)) throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "The run is not dispatchable.");
        if (run.deadlineAt && Date.parse(run.deadlineAt) <= Date.parse(dependencies.clock())) throw new AutomationGovernedExecutionError("RUN_DEADLINE_EXCEEDED", "The run deadline has elapsed.");
        const definition = await dependencies.definitions.getExecution({ tenantId: run.tenantId, automationId: run.automationDefinitionId, version: run.automationDefinitionVersion });
        if (!definition || definition.definitionVersionId !== run.automationDefinitionVersionId || definition.plan.version !== run.executionPlanVersion) throw new AutomationGovernedExecutionError("EXECUTION_PLAN_INCOMPATIBLE", "The immutable execution plan is unavailable or changed.");
        if (!definition.active) throw new AutomationGovernedExecutionError("AUTOMATION_NOT_ACTIVE", "The automation is no longer active.");
        if (definition.killSwitched) throw new AutomationGovernedExecutionError("AUTOMATION_KILL_SWITCHED", "Automation dispatch is disabled.");
        const currentStep = (await dependencies.repository.getSteps(run.tenantId, run.id)).find(({ id }) => id === input.stepId);
        const plannedStep = definition.plan.steps.find(({ key }) => key === currentStep?.stepKey);
        if (!plannedStep || canonicalAutomationJson(plannedStep.payload) !== canonicalAutomationJson(input.payload)) throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "The command payload does not match the immutable execution plan.");
        const leased = await dependencies.repository.claimStep({ tenantId: input.tenantId, stepId: input.stepId, expectedVersion: input.expectedStepVersion, workerId: input.workerId, now: dependencies.clock(), leaseDurationMs: dependencies.leaseDurationMs });
        if (!leased) throw new AutomationGovernedExecutionError("LEASE_CONFLICT", "The step lease is unavailable.");
        const port = ports.get(leased.owningCapability); if (!port || !port.contractVersions.includes(leased.commandContractVersion)) throw new AutomationGovernedExecutionError("COMMAND_CONTRACT_UNSUPPORTED", "The owning capability command contract is unsupported.");
        const approvalRequired = run.approvalId !== undefined;
        if (approvalRequired && (input.approval?.id !== run.approvalId || !approvalIsValid(input.approval, { now: dependencies.clock(), definitionVersionId: run.automationDefinitionVersionId, commandFingerprint: executionPlanFingerprint(definition.plan), targetContextVersion: input.targetContextVersion, policyVersion: input.policyVersion }))) throw new AutomationGovernedExecutionError("APPROVAL_INVALID", "The required approval is missing, expired, or invalidated.");
        const attemptId = dependencies.id(), now = dependencies.clock();
        const envelope: AutomationCommandEnvelope = Object.freeze({ commandType: leased.commandType, contractVersion: leased.commandContractVersion, owningCapability: leased.owningCapability, tenantId: run.tenantId, propertyIds: run.propertyIds, targetType: input.targetType, targetId: input.targetId, payload: Object.freeze({ ...input.payload }), ...(leased.expectedTargetVersion !== undefined ? { expectedTargetVersion: leased.expectedTargetVersion } : {}), commandId: leased.deterministicCommandId, idempotencyKey: leased.idempotencyKey, runId: run.id, stepId: leased.id, attemptId, definitionVersionId: run.automationDefinitionVersionId, executionPlanVersion: run.executionPlanVersion, initiatingActorId: run.initiatingActorId, serviceActorId: dependencies.serviceActor.actorId, ...(input.approval ? { approvalId: input.approval.id } : {}), correlationId: run.correlationId, causationId: run.causationId, traceId: attemptId, issuedAt: now, deadlineAt: run.deadlineAt ?? new Date(Date.parse(now) + 300_000).toISOString(), safeProvenance: Object.freeze({ runRequestId: run.runRequestId, triggerOccurrenceId: run.triggerOccurrenceId }) });
        if (!serviceActorCanDispatch(dependencies.serviceActor, envelope)) throw new AutomationGovernedExecutionError("SERVICE_ACTOR_UNAUTHORIZED", "The automation service actor lacks this command grant.");
        const gate = await port.authorizeAndValidate(envelope); if (!gate.allowed) throw new AutomationGovernedExecutionError(gate.classification ?? "COMMAND_AUTHORIZATION_DENIED", "The owning capability denied this command.");
        const dispatching = transitionAutomationStep(leased, "dispatching", leased.version);
        const durableDispatch = await dependencies.repository.markDispatching({ step: dispatching, expectedVersion: leased.version, now, activity: activity(dependencies.id(), run, dispatching, "automation_command_dispatch_started", dependencies.serviceActor.actorId, now) });
        signal("automation.command.dispatch_started", { tenantId: run.tenantId, runId: run.id, stepId: durableDispatch.id, correlationId: run.correlationId });
        const result = await port.dispatch(envelope), classified = classify(result), nextStep = transitionAutomationStep(durableDispatch, classified.stepStatus, durableDispatch.version);
        const nextRun = run.status === "approved" || run.status === "queued" ? transitionAutomationRun(run, "running", run.version, now) : run;
        const saved = await dependencies.repository.recordDispatch({ run: nextRun, step: nextStep, expectedRunVersion: input.expectedRunVersion, expectedStepVersion: durableDispatch.version, result, attemptId, now, activity: [activity(dependencies.id(), nextRun, nextStep, classified.eventType, dependencies.serviceActor.actorId, now)], notifications: classified.notify ? [notification(dependencies.id(), nextRun, run.initiatingActorId, classified.notify, now)] : [] });
        return success(saved);
      } catch (error) { return failure(error, input); }
    },
    async reconcile(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedRunVersion: number; expectedStepVersion: number }>): Promise<GovernedExecutionResult<Readonly<{ run: AutomationRun; step: AutomationRunStep }>>> {
      try {
        available(); const run = await requiredRun(input.tenantId, input.runId), steps = await dependencies.repository.getSteps(input.tenantId, input.runId), step = steps.find(({ id }) => id === input.stepId);
        if (!step) throw new AutomationGovernedExecutionError("DEPENDENCY_UNAVAILABLE", "The run step was not found."); version(run, input.expectedRunVersion); if (step.version !== input.expectedStepVersion) throw new AutomationGovernedExecutionError("CONCURRENT_MODIFICATION", "The automation step changed concurrently.");
        if (step.status !== "reconciliation_required" && step.status !== "reconciling") throw new AutomationGovernedExecutionError("RECONCILIATION_REQUIRED", "This step is not eligible for reconciliation.");
        const port = ports.get(step.owningCapability); if (!port) throw new AutomationGovernedExecutionError("COMMAND_CONTRACT_UNSUPPORTED", "The owning capability adapter is unavailable.");
        const result = await port.getCommandStatus(step.deterministicCommandId, step.idempotencyKey), classified = classifyReconciliation(result), nextStep = transitionAutomationStep(step.status === "reconciliation_required" ? transitionAutomationStep(step, "reconciling", step.version) : step, classified.stepStatus, step.status === "reconciliation_required" ? step.version + 1 : step.version);
        const saved = await dependencies.repository.recordDispatch({ run, step: nextStep, expectedRunVersion: input.expectedRunVersion, expectedStepVersion: input.expectedStepVersion, result, attemptId: dependencies.id(), now: dependencies.clock(), activity: [activity(dependencies.id(), run, nextStep, "automation_reconciliation_completed", dependencies.serviceActor.actorId, dependencies.clock())], notifications: [] }); return success(saved);
      } catch (error) { return failure(error, input); }
    },
    async finalize(input: Readonly<{ tenantId: string; runId: string; expectedRunVersion: number }>): Promise<GovernedExecutionResult<AutomationRun>> {
      try {
        available();
        const run = await requiredRun(input.tenantId, input.runId);
        version(run, input.expectedRunVersion);
        const steps = await dependencies.repository.getSteps(run.tenantId, run.id);
        if (!steps.length) throw new AutomationGovernedExecutionError("DEPENDENCY_UNAVAILABLE", "The run has no execution steps.");
        const statuses = new Set(steps.map(({ status }) => status));
        let status: AutomationRun["status"];
        if ([...statuses].some((value) => ["leased", "dispatching", "accepted", "reconciliation_required", "reconciling"].includes(value))) status = "reconciliation_required";
        else if ([...statuses].some((value) => ["pending", "awaiting_approval", "ready", "failed_retryable"].includes(value))) return success(run);
        else if ([...statuses].every((value) => ["succeeded", "skipped"].includes(value))) status = "succeeded";
        else if ([...statuses].some((value) => ["failed_terminal", "timed_out", "compensation_failed"].includes(value))) status = "failed";
        else if ([...statuses].every((value) => value === "cancelled")) status = "cancelled";
        else status = "partially_succeeded";
        if (run.status === status) return success(run);
        const now = dependencies.clock();
        let next: AutomationRun;
        if (run.status === "reconciliation_required" && status !== "reconciliation_required")
          next = transitionAutomationRun(run, "reconciling", run.version, now);
        else next = transitionAutomationRun(run, status, run.version, now);
        return success(await dependencies.repository.transition({ run: next, expectedVersion: run.version, activity: [activity(dependencies.id(), next, undefined, `automation_run_${next.status}`, dependencies.serviceActor.actorId, now)] }));
      } catch (error) { return failure(error, input); }
    },
    async heartbeatLease(input: Readonly<{ tenantId: string; stepId: string; workerId: string; leaseGeneration: number; expectedVersion: number }>): Promise<GovernedExecutionResult<AutomationRunStep>> {
      try { available(); return success(await dependencies.repository.heartbeatStep({ ...input, now: dependencies.clock(), leaseDurationMs: dependencies.leaseDurationMs })); } catch (error) { return failure(error, input); }
    },
    async recoverExpiredLease(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedVersion: number }>): Promise<GovernedExecutionResult<AutomationRunStep>> {
      try {
        available(); const step = (await dependencies.repository.getSteps(input.tenantId, input.runId)).find(({ id }) => id === input.stepId); if (!step) throw new AutomationGovernedExecutionError("DEPENDENCY_UNAVAILABLE", "The run step was not found.");
        if (!step.leaseExpiresAt || Date.parse(step.leaseExpiresAt) > Date.parse(dependencies.clock())) throw new AutomationGovernedExecutionError("LEASE_CONFLICT", "The run step lease has not expired.");
        const port = ports.get(step.owningCapability); if (!port) throw new AutomationGovernedExecutionError("COMMAND_CONTRACT_UNSUPPORTED", "The owning capability adapter is unavailable.");
        const status = await port.getCommandStatus(step.deterministicCommandId, step.idempotencyKey);
        if (!["known_not_accepted_timeout", "authorization_rejected", "validation_rejected", "version_conflict", "unsupported", "target_unavailable", "terminal_failure"].includes(status.classification)) throw new AutomationGovernedExecutionError("COMMAND_OUTCOME_UNCERTAIN", "The owning command outcome is not proven safe to reclaim and must be reconciled.");
        return success(await dependencies.repository.reclaimExpiredStep({ tenantId: input.tenantId, stepId: input.stepId, expectedVersion: input.expectedVersion, now: dependencies.clock(), outcomeChecked: true }));
      } catch (error) { return failure(error, input); }
    },
    async retryStep(input: Readonly<{ tenantId: string; runId: string; stepId: string; expectedRunVersion: number; expectedStepVersion: number; actor: AutomationActor; elapsedMs: number; deterministicJitter: number }>): Promise<GovernedExecutionResult<AutomationRun>> {
      try {
        available(); const run = await requiredRun(input.tenantId, input.runId); authorizeActor(input.actor, run); version(run, input.expectedRunVersion); const steps = await dependencies.repository.getSteps(input.tenantId, input.runId), step = steps.find(({ id }) => id === input.stepId);
        if (!step || step.version !== input.expectedStepVersion || step.status !== "failed_retryable") throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "The step is not eligible for retry.");
        const delay = retryDelay({ policy: dependencies.retryPolicy, attempt: step.attemptCount, elapsedMs: input.elapsedMs, classification: "retryable_failure", deterministicJitter: input.deterministicJitter }); if (delay === null) throw new AutomationGovernedExecutionError("RETRY_BUDGET_EXHAUSTED", "The retry budget is exhausted.");
        const ready = Object.freeze({ ...transitionAutomationStep(step, "ready", step.version), nextAttemptAt: new Date(Date.parse(dependencies.clock()) + delay).toISOString() });
        return success(await dependencies.repository.transition({ run, steps: steps.map((value) => value.id === ready.id ? ready : value), expectedVersion: run.version, activity: [activity(dependencies.id(), run, ready, "automation_retry_scheduled", input.actor.actorId, dependencies.clock())] }));
      } catch (error) { return failure(error, input); }
    },
    async requestCancellation(input: Readonly<{ tenantId: string; runId: string; expectedRunVersion: number; actor: AutomationActor; reason: string }>): Promise<GovernedExecutionResult<AutomationRun>> {
      try {
        available(); const run = await requiredRun(input.tenantId, input.runId); authorizeActor(input.actor, run); version(run, input.expectedRunVersion); if (!input.reason.trim()) throw new AutomationGovernedExecutionError("COMMAND_VALIDATION_FAILED", "A cancellation reason is required.");
        const now = dependencies.clock(), steps = await dependencies.repository.getSteps(run.tenantId, run.id), hasDispatchedWork = steps.some(({ status }) => ["leased", "dispatching", "accepted", "succeeded", "reconciliation_required", "reconciling"].includes(status)), nextRun = transitionAutomationRun(run, hasDispatchedWork ? "cancellation_requested" : "cancelled", run.version, now); const nextSteps: AutomationRunStep[] = [];
        for (const step of steps) {
          if (["pending", "awaiting_approval", "ready"].includes(step.status)) nextSteps.push(transitionAutomationStep(step, "cancelled", step.version));
          else if (["leased", "dispatching", "accepted"].includes(step.status)) {
            const port = ports.get(step.owningCapability); if (!port?.requestCancellation) nextSteps.push(transitionAutomationStep(step, "reconciliation_required", step.version));
            else { const result = await port.requestCancellation(step.deterministicCommandId, step.idempotencyKey, input.reason.trim()); nextSteps.push(transitionAutomationStep(step, result.classification === "known_not_accepted_timeout" ? "cancelled" : "reconciliation_required", step.version)); }
          } else nextSteps.push(step);
        }
        return success(await dependencies.repository.transition({ run: nextRun, steps: nextSteps, expectedVersion: input.expectedRunVersion, activity: [activity(dependencies.id(), nextRun, undefined, "automation_cancellation_requested", input.actor.actorId, now)], notifications: [notification(dependencies.id(), nextRun, run.initiatingActorId, "automation_cancellation_requested", now)] }));
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
function classifyReconciliation(result: AutomationDispatchResult): Readonly<{ stepStatus: "succeeded" | "failed_terminal" | "ready" | "reconciliation_required" }> {
  if (result.classification === "succeeded_sync" || result.classification === "duplicate") return { stepStatus: "succeeded" };
  if (result.classification === "accepted_async" || result.classification === "uncertain") return { stepStatus: "reconciliation_required" };
  if (result.classification === "retryable_failure" || result.classification === "known_not_accepted_timeout") return { stepStatus: "ready" };
  return { stepStatus: "failed_terminal" };
}
function version(run: AutomationRun, expected: number) { if (run.version !== expected) throw new AutomationGovernedExecutionError("CONCURRENT_MODIFICATION", "The automation run changed concurrently."); }
function authorizeActor(actor: AutomationActor, run: AutomationRun) { if (!actor.active || actor.tenantId !== run.tenantId || actor.role === "viewer" || actor.role === "contributor" || actor.role === "operator" && run.propertyIds.some((id) => !actor.propertyIds.includes(id))) throw new AutomationGovernedExecutionError("TARGET_SCOPE_UNAUTHORIZED", "The actor cannot govern this run."); }
function activity(id: string, run: AutomationRun, step: AutomationRunStep | undefined, eventType: string, actorId: string, occurredAt: string): GovernedExecutionActivity { return Object.freeze({ id, tenantId: run.tenantId, runId: run.id, ...(step ? { stepId: step.id } : {}), eventType, actorId, occurredAt, correlationId: run.correlationId, causationId: run.causationId, aggregateVersion: step?.version ?? run.version, safeMetadata: Object.freeze({ runStatus: run.status, ...(step ? { stepStatus: step.status, capability: step.owningCapability } : {}) }) }); }
function notification(id: string, run: AutomationRun, recipientId: string, eventType: string, createdAt: string): GovernedNotificationIntent { return Object.freeze({ id, tenantId: run.tenantId, recipientId, eventType, entityId: run.id, idempotencyKey: `${eventType}:${run.id}:${run.version}`, safeVariables: Object.freeze({ runId: run.id }), createdAt }); }
function approvalFor(id: string, run: AutomationRun, steps: readonly AutomationRunStep[], plan: AutomationExecutionPlan, decision: AutomationPolicyDecision, now: string, expiresAt?: string): AutomationApproval { return Object.freeze({ id, tenantId: run.tenantId, runId: run.id, stepIds: Object.freeze(steps.map(({ id }) => id)), definitionVersionId: run.automationDefinitionVersionId, commandFingerprint: executionPlanFingerprint(plan), targetContextVersion: decision.targetContextVersion, policyVersion: decision.policyVersion, status: "pending", requestedAt: now, expiresAt: expiresAt ?? new Date(Date.parse(now) + 86_400_000).toISOString(), version: 1 }); }
function success<T>(value: T): GovernedExecutionResult<T> { return Object.freeze({ ok: true, value }); }
function failure(error: unknown, submittedInput?: unknown): GovernedExecutionResult<never> { if (error instanceof AutomationGovernedExecutionError) return Object.freeze({ ok: false, code: error.code, message: error.message, submittedInput }); return Object.freeze({ ok: false, code: "POLICY_EVALUATION_FAILED", message: "Governed automation execution failed safely.", submittedInput }); }

import { describe, expect, it, vi } from "vitest";
import {
  createGovernedExecutionService,
  type AutomationCommandPort,
  type GovernedExecutionRepository,
} from "./automation-governed-execution";
import type { AutomationRunRequest } from "../domain/automation-triggering";
import type {
  AutomationApproval,
  AutomationCommandEnvelope,
  AutomationRun,
  AutomationRunStep,
  AutomationServiceActor,
} from "../domain/automation-governed-execution";

const request: AutomationRunRequest = {
  id: "request-1",
  idempotencyKey: "req",
  tenantId: "tenant-1",
  scope: { type: "property", propertyIds: ["property-1"] },
  automationId: "automation-1",
  automationDefinitionVersion: 1,
  triggerId: "trigger-1",
  triggerKind: "MANUAL",
  occurrenceId: "occurrence-1",
  requestedAt: "2026-08-10T12:00:00.000Z",
  occurredAt: "2026-08-10T12:00:00.000Z",
  eligibilityPolicyVersion: "v1",
  approvalClassification: "none",
  correlationId: "correlation-1",
  safeTriggerContext: {},
  status: "REQUESTED",
  version: 1,
};
const plan = {
  version: "plan-1",
  schemaVersion: "au001-execution-plan.v1" as const,
  definitionVersionId: "definition-version-1",
  maximumSteps: 5,
  steps: [
    {
      key: "draft",
      owningCapability: "execute",
      commandType: "createDraftPlan",
      commandContractVersion: "v1",
      dependencies: [],
      continuationRule: "all_succeeded" as const,
      payload: {},
      approvalPolicyId: "none",
      actorPolicyId: "service-policy",
      retryPolicyId: "retry",
      timeoutPolicyId: "timeout",
    },
  ],
};
function repository(): GovernedExecutionRepository {
  const runs: AutomationRun[] = [],
    steps: AutomationRunStep[] = [],
    approvals: AutomationApproval[] = [];
  return {
    async getRunByRequest(_, id) {
      return runs.find((run) => run.runRequestId === id) ?? null;
    },
    async getRun(_, id) {
      return runs.find((run) => run.id === id) ?? null;
    },
    async getSteps(_, id) {
      return steps.filter((step) => step.runId === id);
    },
    async getApproval(_, id) {
      return approvals.find((approval) => approval.id === id) ?? null;
    },
    async materialize(input) {
      runs.push(input.run);
      steps.push(...input.steps);
      return { created: true, run: input.run, steps: input.steps };
    },
    async applyPolicy(input) {
      const index = runs.findIndex(({ id }) => id === input.run.id);
      runs[index] = input.run;
      steps.splice(0, steps.length, ...input.steps);
      if (input.approval) approvals.push(input.approval);
      return input.run;
    },
    async transition(input) {
      const index = runs.findIndex(({ id }) => id === input.run.id);
      runs[index] = input.run;
      if (input.steps) steps.splice(0, steps.length, ...input.steps);
      return input.run;
    },
    async decideApproval(input) {
      approvals.splice(
        approvals.findIndex(({ id }) => id === input.approval.id),
        1,
        input.approval,
      );
      runs.splice(
        runs.findIndex(({ id }) => id === input.run.id),
        1,
        input.run,
      );
      steps.splice(0, steps.length, ...input.steps);
      return { approval: input.approval, run: input.run };
    },
    async claimStep(input) {
      const value = steps.find(({ id }) => id === input.stepId);
      if (!value || value.version !== input.expectedVersion) return null;
      const claimed: AutomationRunStep = {
        ...value,
        status: "leased",
        leaseOwner: input.workerId,
        leaseAcquiredAt: input.now,
        leaseExpiresAt: new Date(
          Date.parse(input.now) + input.leaseDurationMs,
        ).toISOString(),
        leaseGeneration: value.leaseGeneration + 1,
        version: value.version + 1,
      };
      steps[steps.indexOf(value)] = claimed;
      return claimed;
    },
    async heartbeatStep(input) {
      const value = steps.find(({ id }) => id === input.stepId);
      if (!value) throw new Error("missing step");
      return value;
    },
    async reclaimExpiredStep(input) {
      const value = steps.find(({ id }) => id === input.stepId);
      if (!value) throw new Error("missing step");
      return value;
    },
    async markDispatching(input) {
      const value = { ...input.step };
      steps[steps.findIndex(({ id }) => id === value.id)] = value;
      return value;
    },
    async recordDispatch(input) {
      runs.splice(
        runs.findIndex(({ id }) => id === input.run.id),
        1,
        input.run,
      );
      steps.splice(
        steps.findIndex(({ id }) => id === input.step.id),
        1,
        input.step,
      );
      return { run: input.run, step: input.step };
    },
  };
}
function service(
  input: {
    enabled?: boolean;
    kill?: boolean;
    disposition?:
      | "permitted_without_additional_approval"
      | "approval_required"
      | "prohibited"
      | "insufficient_context"
      | "policy_unavailable";
    ports?: AutomationCommandPort[];
    definitionPlan?: typeof plan;
    repository?: GovernedExecutionRepository;
    serviceActor?: AutomationServiceActor;
  } = {},
) {
  return createGovernedExecutionService({
    repository: input.repository ?? repository(),
    definitions: {
      async getExecution() {
        return {
          definitionVersionId: "definition-version-1",
          active: true,
          killSwitched: false,
          plan: input.definitionPlan ?? plan,
        };
      },
    },
    policy: {
      async evaluate({ run }) {
        return {
          id: "decision-1",
          runId: run.id,
          disposition:
            input.disposition ?? "permitted_without_additional_approval",
          policyVersion: "policy-1",
          targetContextVersion: "context-1",
          matchedRules: [],
          missingFacts: [],
          safeExplanation: "Allowed by test policy.",
          evaluatedAt: "2026-08-10T12:00:00.000Z",
        };
      },
    },
    approvalAuthority: {
      async canApprove() {
        return true;
      },
    },
    ports: input.ports ?? [],
    serviceActor: input.serviceActor ?? {
      actorId: "service-1",
      tenantId: "tenant-1",
      policyId: "service-policy",
      active: true,
      grants: [
        {
          capability: "execute",
          commandType: "createDraftPlan",
          propertyIds: ["property-1"],
        },
      ],
    },
    retryPolicy: {
      version: "retry-v1",
      maximumAttempts: 3,
      maximumElapsedMs: 60_000,
      initialDelayMs: 1000,
      maximumDelayMs: 10_000,
      jitterRatio: 0,
      retryableClassifications: ["retryable_failure"],
    },
    clock: () => "2026-08-10T12:00:00.000Z",
    id: vi.fn().mockReturnValueOnce("run-1").mockReturnValue("generated-id"),
    enabled: () => input.enabled ?? true,
    killSwitched: () => input.kill ?? false,
    leaseDurationMs: 60_000,
  });
}
const owner = {
  actorId: "owner-1",
  tenantId: "tenant-1",
  role: "owner" as const,
  active: true,
  propertyIds: [],
};
describe("AU-001C application service", () => {
  it("materializes a request idempotently through the repository", async () => {
    const app = service();
    const first = await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    const second = await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    expect(first.ok && first.value.created).toBe(true);
    expect(second.ok && second.value.created).toBe(false);
  });
  it("fails closed while disabled or kill-switched", async () => {
    const disabled = await service({ enabled: false }).materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    const killed = await service({ kill: true }).materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    expect(disabled.ok ? "" : disabled.code).toBe("AUTOMATION_KILL_SWITCHED");
    expect(killed.ok ? "" : killed.code).toBe("AUTOMATION_KILL_SWITCHED");
  });
  it("fails closed on unavailable policy", async () => {
    const app = service({ disposition: "policy_unavailable" });
    const created = await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await app.evaluatePolicy({
      request,
      runId: created.value.run.id,
      expectedVersion: 1,
      actor: owner,
    });
    expect(result.ok ? "" : result.code).toBe("POLICY_EVALUATION_FAILED");
  });
  it("creates an approval gate without dispatch", async () => {
    const app = service({ disposition: "approval_required" });
    const created = await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    if (!created.ok) throw new Error();
    const result = await app.evaluatePolicy({
      request,
      runId: created.value.run.id,
      expectedVersion: 1,
      actor: owner,
    });
    expect(result.ok && result.value.status).toBe("awaiting_approval");
  });
  it("requires the exact approved fact at dispatch", async () => {
    const dispatch = vi
        .fn()
        .mockResolvedValue({ classification: "succeeded_sync" }),
      app = service({
        disposition: "approval_required",
        ports: [
          {
            capability: "execute",
            contractVersions: ["v1"],
            authorizeAndValidate: vi.fn().mockResolvedValue({ allowed: true }),
            dispatch,
            getCommandStatus: vi.fn(),
          },
        ],
      });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    const evaluated = await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    if (!evaluated.ok || !evaluated.value.approvalId) throw new Error();
    const missing = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    expect(missing.ok ? "" : missing.code).toBe("COMMAND_VALIDATION_FAILED");
    const decision = await app.decideApproval({
      tenantId: "tenant-1",
      approvalId: evaluated.value.approvalId,
      expectedApprovalVersion: 1,
      expectedRunVersion: 2,
      actor: owner,
      disposition: "approve",
    });
    if (!decision.ok) throw new Error(`${decision.code}: ${decision.message}`);
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 3,
      expectedStepVersion: 3,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
      approval: decision.value.approval,
    });
    expect(result.ok).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it("reauthorizes the immutable command immediately before dispatch", async () => {
    const authorizeAndValidate = vi.fn().mockResolvedValue({ allowed: true }),
      dispatch = vi
        .fn()
        .mockResolvedValue({ classification: "succeeded_sync" });
    const app = service({
      ports: [
        {
          capability: "execute",
          contractVersions: ["v1"],
          authorizeAndValidate,
          dispatch,
          getCommandStatus: vi.fn(),
        },
      ],
    });
    const created = await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    if (!created.ok) throw new Error();
    const evaluated = await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    if (!evaluated.ok) throw new Error();
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    expect(authorizeAndValidate).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it("rejects payload drift before owning-capability authorization", async () => {
    const authorizeAndValidate = vi.fn(),
      dispatch = vi.fn();
    const app = service({
      ports: [
        {
          capability: "execute",
          contractVersions: ["v1"],
          authorizeAndValidate,
          dispatch,
          getCommandStatus: vi.fn(),
        },
      ],
    });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: { injected: true },
    });
    expect(result.ok ? "" : result.code).toBe("COMMAND_VALIDATION_FAILED");
    expect(authorizeAndValidate).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("denies a revoked service actor before owning-capability authorization", async () => {
    const authorizeAndValidate = vi.fn(),
      dispatch = vi.fn();
    const app = service({
      serviceActor: {
        actorId: "service-1",
        tenantId: "tenant-1",
        policyId: "service-policy",
        active: false,
        grants: [],
      },
      ports: [
        {
          capability: "execute",
          contractVersions: ["v1"],
          authorizeAndValidate,
          dispatch,
          getCommandStatus: vi.fn(),
        },
      ],
    });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    expect(result.ok ? "" : result.code).toBe("SERVICE_ACTOR_UNAUTHORIZED");
    expect(authorizeAndValidate).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("does not call external transport when durable dispatch preparation fails", async () => {
    const base = repository(),
      dispatch = vi.fn(),
      app = service({
        repository: {
          ...base,
          markDispatching: vi
            .fn()
            .mockRejectedValue(new Error("database unavailable")),
        },
        ports: [
          {
            capability: "execute",
            contractVersions: ["v1"],
            authorizeAndValidate: vi.fn().mockResolvedValue({ allowed: true }),
            dispatch,
            getCommandStatus: vi.fn(),
          },
        ],
      });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    expect(result.ok).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("preserves one logical command identity across an uncertain transport result", async () => {
    const envelopes: AutomationCommandEnvelope[] = [],
      app = service({
        ports: [
          {
            capability: "execute",
            contractVersions: ["v1"],
            authorizeAndValidate: vi.fn().mockResolvedValue({ allowed: true }),
            dispatch: vi.fn(async (envelope: AutomationCommandEnvelope) => {
              envelopes.push(envelope);
              return { classification: "uncertain" as const };
            }),
            getCommandStatus: vi.fn(),
          },
        ],
      });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    const result = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    expect(result.ok && result.value.step.status).toBe(
      "reconciliation_required",
    );
    expect(envelopes[0].commandId).toBe("aucmd-v1:run-1:draft:v1");
    expect(envelopes[0].idempotencyKey).toBe("aucmd-idem-v1:run-1:draft:v1");
  });
  it("retries only after reconciliation proves the command was not accepted", async () => {
    const app = service({
      ports: [
        {
          capability: "execute",
          contractVersions: ["v1"],
          authorizeAndValidate: vi.fn().mockResolvedValue({ allowed: true }),
          dispatch: vi.fn().mockResolvedValue({ classification: "uncertain" }),
          getCommandStatus: vi
            .fn()
            .mockResolvedValue({
              classification: "known_not_accepted_timeout",
            }),
        },
      ],
    });
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    await app.evaluatePolicy({
      request,
      runId: "run-1",
      expectedVersion: 1,
      actor: owner,
    });
    const dispatched = await app.dispatch({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: 2,
      expectedStepVersion: 2,
      workerId: "worker-1",
      targetType: "plan",
      targetId: "plan-1",
      targetContextVersion: "context-1",
      policyVersion: "policy-1",
      payload: {},
    });
    if (!dispatched.ok) throw new Error();
    const reconciled = await app.reconcile({
      tenantId: "tenant-1",
      runId: "run-1",
      stepId: "run-1:draft",
      expectedRunVersion: dispatched.value.run.version,
      expectedStepVersion: dispatched.value.step.version,
    });
    expect(reconciled.ok && reconciled.value.step.status).toBe("ready");
  });
  it("cancels undispatched work without entering an in-flight cancellation state", async () => {
    const app = service();
    await app.materialize({
      request,
      actor: owner,
      serviceActorPolicyId: "service-policy",
    });
    const cancelled = await app.requestCancellation({
      tenantId: "tenant-1",
      runId: "run-1",
      expectedRunVersion: 1,
      actor: owner,
      reason: "No longer required",
    });
    expect(cancelled.ok && cancelled.value.status).toBe("cancelled");
  });
});

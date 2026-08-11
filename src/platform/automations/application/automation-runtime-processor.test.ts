import { describe, expect, it, vi } from "vitest";
import { createAutomationRuntimeProcessor } from "./automation-runtime-processor";

const request = {
  id: "request-1", idempotencyKey: "run:occurrence-1", tenantId: "workspace-1",
  scope: { type: "property", propertyIds: ["property-1"] }, automationId: "automation-1",
  automationDefinitionVersion: 1, triggerId: "trigger-1", triggerKind: "SCHEDULE_INTERVAL",
  occurrenceId: "occurrence-1", requestedAt: "2026-08-10T12:00:00Z", occurredAt: "2026-08-10T12:00:00Z",
  eligibilityPolicyVersion: "eligibility-v1", approvalClassification: "eligible", correlationId: "correlation-1",
  safeTriggerContext: {}, status: "REQUESTED", version: 1,
} as const;
const run = { id: "run-1", tenantId: "workspace-1", propertyIds: ["property-1"], automationDefinitionId: "automation-1", automationDefinitionVersionId: "definition-version-1", automationDefinitionVersion: 1, runRequestId: "request-1", triggerOccurrenceId: "occurrence-1", executionPlanVersion: "plan-v1", initiatingActorId: "scheduler-1", serviceActorPolicyId: "policy-v1", correlationId: "correlation-1", causationId: "request-1", status: "pending_policy_evaluation", createdAt: "2026-08-10T12:00:00Z", updatedAt: "2026-08-10T12:00:00Z", version: 1 } as const;
const ready = { id: "step-1", tenantId: "workspace-1", runId: "run-1", stepKey: "create", owningCapability: "execute", commandType: "createDraftPlan", commandContractVersion: "v1", dependencies: [], status: "ready", deterministicCommandId: "command-1", idempotencyKey: "command-idem-1", attemptCount: 0, leaseGeneration: 0, version: 2 } as const;

function harness(enabled = true) {
  const governed = {
    materialize: vi.fn(async () => ({ ok: true as const, value: { run, steps: [ready], created: true } })),
    evaluatePolicy: vi.fn(async () => ({ ok: true as const, value: { ...run, status: "approved" as const, version: 2 } })),
    dispatch: vi.fn(async () => ({ ok: true as const, value: { run: { ...run, status: "running" as const, version: 3 }, step: { ...ready, status: "succeeded" as const, version: 4 } } })),
    finalize: vi.fn(async () => ({ ok: true as const, value: { ...run, status: "succeeded" as const, version: 4 } })),
  };
  const processor = createAutomationRuntimeProcessor({
    enabled: () => enabled,
    scheduler: { scanDueSchedules: vi.fn(async () => ({ ok: true as const, value: { processed: 1, accepted: 1 } })) },
    requests: { listRequested: vi.fn(async () => [request] as never) },
    runs: { getRun: vi.fn(), getSteps: vi.fn(async () => [ready] as never), getApproval: vi.fn(async () => null) },
    definitions: { getExecution: vi.fn(async () => ({ definitionVersionId: "definition-version-1", active: true, killSwitched: false, plan: { version: "plan-v1", schemaVersion: "au001-execution-plan.v1", definitionVersionId: "definition-version-1", maximumSteps: 1, steps: [{ key: "create", owningCapability: "execute", commandType: "createDraftPlan", commandContractVersion: "v1", dependencies: [], continuationRule: "all_succeeded", payload: { title: "Draft plan" }, approvalPolicyId: "a", actorPolicyId: "b", retryPolicyId: "c", timeoutPolicyId: "d" }] } } as never)) },
    governed, actor: { actorId: "scheduler-1", tenantId: "workspace-1", role: "service", active: true, grants: ["scheduler"], propertyIds: ["property-1"] },
    workerId: "worker-1", serviceActorPolicyId: "policy-v1", policyVersion: "policy-v1", maximumRequests: 10,
  });
  return { processor, governed };
}

describe("production Automation runtime processor", () => {
  it("materializes, evaluates, dispatches and terminalizes bounded work", async () => {
    const { processor, governed } = harness();
    await expect(processor.process("invocation-1")).resolves.toMatchObject({ requestsProcessed: 1, runsCompleted: 1, failed: 0, quarantined: 0 });
    expect(governed.dispatch).toHaveBeenCalledWith(expect.objectContaining({ targetType: "action-plan-draft", payload: { title: "Draft plan" } }));
    expect(governed.finalize).toHaveBeenCalledTimes(1);
  });

  it("does not claim or dispatch when a kill switch is enabled", async () => {
    const { processor, governed } = harness(false);
    await expect(processor.process("invocation-1")).rejects.toThrow("AUTOMATION_KILL_SWITCHED");
    expect(governed.dispatch).not.toHaveBeenCalled();
  });
});

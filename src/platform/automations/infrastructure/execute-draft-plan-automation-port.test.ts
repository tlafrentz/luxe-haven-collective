import { describe, expect, it, vi } from "vitest";
import type { AutomationCommandEnvelope } from "../domain/automation-governed-execution";
import {
  createExecuteDraftPlanAutomationPort,
  createUnsupportedAutomationCommandPort,
  type ExecuteDraftPlanAutomationBoundary,
} from "./execute-draft-plan-automation-port";

const envelope = (
  overrides: Partial<AutomationCommandEnvelope> = {},
): AutomationCommandEnvelope => ({
  commandType: "createDraftPlan",
  contractVersion: "v1",
  owningCapability: "execute",
  tenantId: "tenant-1",
  propertyIds: ["property-1"],
  targetType: "action-plan-draft",
  targetId: "new",
  payload: { title: "Review arrival process", priority: "low" },
  commandId: "command-1",
  idempotencyKey: "command-1:v1",
  runId: "run-1",
  stepId: "step-1",
  attemptId: "attempt-1",
  definitionVersionId: "definition-version-1",
  executionPlanVersion: "plan-v1",
  initiatingActorId: "user-1",
  serviceActorId: "automation-service-1",
  correlationId: "correlation-1",
  causationId: "occurrence-1",
  traceId: "trace-1",
  issuedAt: "2026-08-10T12:00:00.000Z",
  deadlineAt: "2026-08-10T12:05:00.000Z",
  safeProvenance: {},
  ...overrides,
});

function boundary(): ExecuteDraftPlanAutomationBoundary {
  return {
    authorize: vi.fn(async () => ({ allowed: true })),
    createDraftPlan: vi.fn(async () => ({
      classification: "succeeded_sync" as const,
      owningCommandId: "execute-plan-1",
    })),
    getCommandStatus: vi.fn(async () => ({
      classification: "succeeded_sync" as const,
      owningCommandId: "execute-plan-1",
    })),
  };
}

describe("Execute draft-plan automation adapter", () => {
  it("maps only the low-risk draft-plan command into the Execute boundary", async () => {
    const target = boundary(),
      port = createExecuteDraftPlanAutomationPort(target),
      gate = await port.authorizeAndValidate(envelope()),
      result = await port.dispatch(envelope());

    expect(gate).toEqual({ allowed: true });
    expect(result).toMatchObject({
      classification: "succeeded_sync",
      owningCommandId: "execute-plan-1",
    });
    expect(target.createDraftPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "tenant-1",
        propertyIds: ["property-1"],
        title: "Review arrival process",
        priority: "low",
        serviceActorId: "automation-service-1",
      }),
    );
  });

  it.each([
    { commandType: "activatePlan" },
    { contractVersion: "v2" },
    { targetType: "active-action" },
    { propertyIds: [] },
    { payload: { title: "" } },
  ])("fails closed for unsupported or invalid input %#", async (invalid) => {
    const target = boundary(),
      port = createExecuteDraftPlanAutomationPort(target),
      gate = await port.authorizeAndValidate(envelope(invalid));
    expect(gate.allowed).toBe(false);
    expect(target.authorize).not.toHaveBeenCalled();
  });

  it.each([
    "decide",
    "outcome-measurement",
    "learning",
    "recommendations",
    "furnishing",
  ] as const)("explicitly rejects unsupported %s commands", async (capability) => {
    const port = createUnsupportedAutomationCommandPort(capability);
    await expect(port.authorizeAndValidate(envelope())).resolves.toEqual({
      allowed: false,
      classification: "COMMAND_CONTRACT_UNSUPPORTED",
    });
    await expect(port.dispatch(envelope())).resolves.toEqual({
      classification: "unsupported",
    });
  });
});

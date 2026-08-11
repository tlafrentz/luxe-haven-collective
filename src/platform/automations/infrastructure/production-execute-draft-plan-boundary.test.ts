import { describe, expect, it, vi } from "vitest";
import { createProductionExecuteDraftPlanBoundary } from "./production-execute-draft-plan-boundary";

const cohort = {
  workspaceId: "workspace-1",
  propertyIds: ["property-1"],
  serviceActorId: "automation-user-1",
} as const;
const command = {
  commandId: "command-1",
  idempotencyKey: "run:one",
  workspaceId: "workspace-1",
  propertyIds: ["property-1"],
  title: "Prepare a draft plan",
  priority: "normal" as const,
  serviceActorId: "automation-user-1",
  initiatingActorId: "owner-1",
  correlationId: "correlation-1",
  causationId: "run-1",
  occurredAt: "2026-08-10T12:00:00.000Z",
};

describe("production Execute draft-plan automation boundary", () => {
  it("creates a draft plan with the command ID and automation actor", async () => {
    const service = {
      getPlan: vi.fn(async () => ({ ok: false as const, code: "PLAN_NOT_FOUND" as const, message: "missing", retryable: false })),
      createManualDraft: vi.fn(async (input) => ({ ok: true as const, value: { id: input.id } as never })),
    };
    const boundary = createProductionExecuteDraftPlanBoundary({ service, cohort });
    await expect(boundary.createDraftPlan(command)).resolves.toMatchObject({ classification: "succeeded_sync", owningCommandId: "command-1" });
    expect(service.createManualDraft).toHaveBeenCalledWith(expect.objectContaining({ id: "command-1", workspaceId: "workspace-1", owner: { type: "automation", id: "automation-user-1" }, actor: { type: "automation", id: "automation-user-1" } }));
  });

  it("returns duplicate for an idempotent replay", async () => {
    const service = {
      getPlan: vi.fn(async () => ({ ok: true as const, value: { id: "command-1" } as never })),
      createManualDraft: vi.fn(),
    };
    const boundary = createProductionExecuteDraftPlanBoundary({ service, cohort });
    await expect(boundary.createDraftPlan(command)).resolves.toMatchObject({ classification: "duplicate" });
    expect(service.createManualDraft).not.toHaveBeenCalled();
  });

  it("fails closed outside the exact workspace, property, or actor cohort", async () => {
    const service = { getPlan: vi.fn(), createManualDraft: vi.fn() };
    const boundary = createProductionExecuteDraftPlanBoundary({ service, cohort });
    for (const changed of [
      { workspaceId: "other" },
      { propertyIds: ["other"] },
      { serviceActorId: "other" },
    ]) {
      await expect(boundary.authorize({ ...command, ...changed })).resolves.toEqual({ allowed: false, classification: "COMMAND_AUTHORIZATION_DENIED" });
      await expect(boundary.createDraftPlan({ ...command, ...changed })).resolves.toEqual({ classification: "authorization_rejected" });
    }
    expect(service.getPlan).not.toHaveBeenCalled();
  });
});

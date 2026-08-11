import { describe, expect, it } from "vitest";
import { createExecuteDraftPlanService } from "./production-execute-draft-plan-service";

const cohort = {
  workspaceId: "workspace-1",
  propertyIds: ["property-1"],
  serviceActorId: "automation-user-1",
} as const;

describe("Execute draft-plan service composition", () => {
  it("rejects an identity that differs from the cohort service actor", () => {
    expect(() =>
      createExecuteDraftPlanService({
        client: {} as never,
        cohort,
        authenticatedUserId: "other-user",
      }),
    ).toThrow("does not match");
  });

  it("rejects an unscoped service identity", () => {
    expect(() =>
      createExecuteDraftPlanService({
        client: {} as never,
        cohort: { ...cohort, propertyIds: [] },
        authenticatedUserId: cohort.serviceActorId,
      }),
    ).toThrow("property-scoped");
  });
});

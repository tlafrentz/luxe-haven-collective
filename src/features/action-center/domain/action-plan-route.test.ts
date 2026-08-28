import { describe, expect, it } from "vitest";
import { actionPlanPath, decodeActionPlanPathId } from "./action-plan-route";

describe("Action Plan routes", () => {
  it("round-trips canonical plan IDs containing reserved path characters", () => {
    const planId="aucmd-v1:command:execute-create-draft-plan:v1";
    const path=actionPlanPath(planId,"workspace-1");
    const segment=path.split("/plans/")[1]!.split("?")[0]!;

    expect(path).toBe("/dashboard/execute/plans/aucmd-v1%3Acommand%3Aexecute-create-draft-plan%3Av1?workspace=workspace-1&from=plans");
    expect(decodeActionPlanPathId(segment)).toBe(planId);
  });

  it("fails closed for malformed encoded plan IDs", () => {
    expect(decodeActionPlanPathId("broken%2")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { ExecutiveAction } from "../compatibility";
import { measureActionWithOutcome } from "./measure-action";

const completed: ExecutiveAction = {
  id: "action-1", propertyId: "property-1", source: "manual", type: "pricing", title: "Publish rate",
  summary: "Publish the approved rate.", priority: "high", status: "completed",
  owner: { type: "user", id: "user-1", displayName: "Todd" }, createdAt: "2026-07-19T10:00:00Z",
  acceptedAt: "2026-07-19T10:05:00Z", startedAt: "2026-07-19T10:10:00Z", completedAt: "2026-07-19T10:20:00Z",
  outcome: { summary: "Rate published.", successful: true },
};

describe("measureActionWithOutcome", () => {
  it("makes Platform Outcome authoritative while preserving the compatibility projection", () => {
    const result = measureActionWithOutcome({ action: completed, measuredAt: "2026-07-19T11:00:00Z", measuredImpact: { revenue: 125 }, lessonsLearned: ["Demand held."] });

    expect(result.outcome).toMatchObject({ type: "action", status: "completed", successful: true, metrics: { revenue: 125 }, notes: ["Demand held."] });
    expect(result.outcome.lineage.actionIds[0].value).toBe("action-1");
    expect(result.action).toMatchObject({ status: "measured", measuredAt: "2026-07-19T11:00:00Z", outcome: { measuredImpact: { revenue: 125 } } });
    expect(result.action.outcome?.metadata?.canonicalOutcomeId).toBe(result.outcome.id.value);
  });
});

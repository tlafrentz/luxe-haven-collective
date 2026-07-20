import { describe, expect, it } from "vitest";

import {
  createPlatformAction,
  createPlatformActionCenterRecord,
} from "../test-support/factories";

import { buildExecutionWorkspace } from "./build-execution-workspace";

const completionOutcome = {
  summary: "Weekend pricing was updated.",
  successful: true,
} as const;

describe("buildExecutionWorkspace", () => {
  it("maps an accepted action and its decision context", () => {
    const result = buildExecutionWorkspace(
      createPlatformActionCenterRecord(),
    );

    expect(result).toMatchObject({
      id: "action-1",
      outcomeTitle: "Recover missed weekend revenue",
      whyNow: "Weekend demand is outpacing current pricing.",
      recommendedAction: {
        title: "Increase weekend pricing",
        summary: "Increase Friday and Saturday rates by 8%.",
      },
      metadata: {
        ownerName: "Todd",
        ownerType: "user",
        propertyId: "property-1",
        source: "executive-intelligence",
        type: "pricing",
        priority: "high",
        status: "accepted",
        expectedImpact: "+$620/month",
        confidence: "high",
      },
      nextStep: "start",
    });
    expect(result.timeline.map(({ type }) => type)).toEqual([
      "created",
      "accepted",
    ]);
  });

  it("maps an in-progress action to completion", () => {
    const action = createPlatformAction({
      status: "in-progress",
      startedAt: new Date("2026-07-15T14:00:00.000Z"),
    });
    const result = buildExecutionWorkspace(
      createPlatformActionCenterRecord({ action }),
    );

    expect(result.nextStep).toBe("complete");
    expect(result.timeline.at(-1)).toMatchObject({
      type: "started",
      timestamp: "2026-07-15T14:00:00.000Z",
    });
  });

  it("keeps completed learning pending until measurement", () => {
    const action = createPlatformAction({
      status: "completed",
      completedAt: new Date("2026-07-15T18:00:00.000Z"),
      outcome: completionOutcome,
    });
    const result = buildExecutionWorkspace(
      createPlatformActionCenterRecord({ action }),
    );

    expect(result.nextStep).toBe("measure");
    expect(result.learning).toEqual({
      status: "pending",
      outcome: completionOutcome,
    });
    expect(result.timeline.at(-1)?.type).toBe("completed");
  });

  it("captures measured impact and lessons without leaking nested references", () => {
    const measuredImpact = { monthlyRevenue: 620 };
    const lessonsLearned = ["Demand supported the higher rate."];
    const metadata = { measurementSource: "revenue-report" };
    const action = createPlatformAction({
      status: "measured",
      completedAt: new Date("2026-07-15T18:00:00.000Z"),
      measuredAt: new Date("2026-07-22T18:00:00.000Z"),
      outcome: {
        ...completionOutcome,
        measuredImpact,
        lessonsLearned,
        metadata,
      },
    });
    const result = buildExecutionWorkspace(
      createPlatformActionCenterRecord({ action }),
    );

    expect(result.nextStep).toBe("archive");
    expect(result.learning).toEqual({
      status: "captured",
      outcome: {
        ...completionOutcome,
        measuredImpact,
        lessonsLearned,
        metadata,
      },
    });
    expect(result.learning.outcome?.measuredImpact).not.toBe(measuredImpact);
    expect(result.learning.outcome?.lessonsLearned).not.toBe(lessonsLearned);
    expect(result.learning.outcome?.metadata).not.toBe(metadata);
    expect(result.timeline.at(-1)?.type).toBe("measured");
  });

  it("maps an archived action to no next step", () => {
    const action = createPlatformAction({
      status: "archived",
      archivedAt: new Date("2026-07-23T18:00:00.000Z"),
    });
    const result = buildExecutionWorkspace(
      createPlatformActionCenterRecord({ action }),
    );

    expect(result.nextStep).toBe("none");
    expect(result.timeline.at(-1)?.type).toBe("archived");
  });

  it("uses safe action-language fallbacks without inventing analysis", () => {
    const action = createPlatformAction();
    const result = buildExecutionWorkspace({ action });

    expect(result.outcomeTitle).toBe(action.title);
    expect(result.whyNow).toBe(action.summary);
    expect(result.evidence).toEqual([]);
    expect(result.metadata).not.toHaveProperty("expectedImpact");
    expect(result.metadata).not.toHaveProperty("confidence");
  });

  it("maps string metadata and uses nulls when metadata is absent", () => {
    const mapped = buildExecutionWorkspace(
      createPlatformActionCenterRecord(),
    );
    const absent = buildExecutionWorkspace({
      action: createPlatformAction({ metadata: {} }),
    });

    expect(mapped.metadata).toMatchObject({
      propertyId: "property-1",
      source: "executive-intelligence",
    });
    expect(absent.metadata).toMatchObject({
      propertyId: null,
      source: null,
    });
  });

  it.each([
    ["proposed", "none"],
    ["scheduled", "start"],
    ["blocked", "complete"],
  ] as const)("maps %s to the %s next step", (status, nextStep) => {
    const result = buildExecutionWorkspace({
      action: createPlatformAction({ status }),
    });
    expect(result.nextStep).toBe(nextStep);
  });

  it("copies explicit display evidence", () => {
    const evidence = [{ label: "Weekend occupancy", value: "93%" }];
    const record = createPlatformActionCenterRecord({
      decisionContext: {
        outcomeTitle: "Recover revenue",
        whyNow: "Demand is strong.",
        evidence,
      },
    });
    const result = buildExecutionWorkspace(record);

    expect(result.evidence).not.toBe(evidence);
    expect(result.evidence[0]).not.toBe(evidence[0]);
  });
});

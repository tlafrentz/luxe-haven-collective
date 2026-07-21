import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPlatformAction,
} from "../test-support/factories";

import {
  buildActionCenterView,
} from "./build-action-center-view";

describe("buildActionCenterView", () => {
  it("builds execution summary counts", () => {
    const result = buildActionCenterView([
      {
        action: createPlatformAction({
          id: "accepted",
          status: "accepted",
        }),
      },
      {
        action: createPlatformAction({
          id: "in-progress",
          status: "in-progress",
        }),
      },
      {
        action: createPlatformAction({
          id: "blocked",
          status: "blocked",
        }),
      },
      {
        action: createPlatformAction({
          id: "completed",
          status: "completed",
        }),
      },
      {
        action: createPlatformAction({
          id: "measured",
          status: "measured",
        }),
      },
    ]);

    expect(result.summary).toEqual({
      total: 5,
      accepted: 1,
      inProgress: 1,
      blocked: 1,
      completed: 1,
      measured: 1,
    });
  });

  it("excludes archived actions", () => {
    const result = buildActionCenterView([
      {
        action: createPlatformAction(),
      },
      {
        action: createPlatformAction({
          id: "archived",
          status: "archived",
        }),
      },
    ]);

    expect(result.summary.total).toBe(1);

    expect(
      result.activeActions.map(
        (action) => action.id,
      ),
    ).not.toContain("archived");
  });

  it("groups active, completed, and measured actions", () => {
    const result = buildActionCenterView([
      {
        action: createPlatformAction({
          id: "active",
          status: "in-progress",
        }),
      },
      {
        action: createPlatformAction({
          id: "completed",
          status: "completed",
          completedAt:
            new Date("2026-07-15T18:00:00.000Z"),
          outcome: { summary: "Completed.", successful: true },
        }),
      },
      {
        action: createPlatformAction({
          id: "measured",
          status: "measured",
          completedAt: new Date("2026-07-15T18:00:00.000Z"),
          measuredAt:
            new Date("2026-07-22T18:00:00.000Z"),
          outcome: { summary: "Measured.", successful: true, measuredImpact: { revenue: 1 } },
        }),
      },
    ]);

    expect(
      result.activeActions.map(
        (action) => action.id,
      ),
    ).toEqual(["active"]);

    expect(
      result.recentlyCompleted.map(
        (action) => action.id,
      ),
    ).toEqual(["completed"]);

    expect(
      result.recentlyMeasured.map(
        (action) => action.id,
      ),
    ).toEqual(["measured"]);
  });

  it("maps ownership into the presentation model", () => {
    const result = buildActionCenterView([
      {
        action: createPlatformAction({
          owner: {
            type: "team",
            id: "revenue-team",
            displayName: "Revenue Team",
          },
        }),
      },
    ]);

    expect(
      result.activeActions[0].ownerName,
    ).toBe("Revenue Team");
  });

  it("preserves decision context for the execution experience", () => {
    const result = buildActionCenterView([
      {
        action: createPlatformAction(),
        decisionContext: {
          outcomeTitle:
            "Recover missed weekend revenue",
          whyNow:
            "Weekend demand is outpacing current pricing.",
          expectedImpact: "+$620/month",
          confidence: "high",
          evidence: [
            {
              label: "Weekend occupancy",
              value: "93%",
            },
            {
              label: "Comparable market ADR",
              value: "+9%",
            },
          ],
        },
      },
    ]);

    expect(
      result.activeActions[0]
        .decisionContext,
    ).toEqual({
      outcomeTitle:
        "Recover missed weekend revenue",
      whyNow:
        "Weekend demand is outpacing current pricing.",
      expectedImpact: "+$620/month",
      confidence: "high",
      evidence: [
        {
          label: "Weekend occupancy",
          value: "93%",
        },
        {
          label: "Comparable market ADR",
          value: "+9%",
        },
      ],
    });
  });

  it("copies decision evidence instead of retaining its array reference", () => {
    const evidence = [
      {
        label: "Weekend occupancy",
        value: "93%",
      },
    ];

    const result = buildActionCenterView([
      {
        action: createPlatformAction(),
        decisionContext: {
          outcomeTitle:
            "Recover missed weekend revenue",
          whyNow:
            "Weekend demand is strong.",
          evidence,
        },
      },
    ]);

    expect(
      result.activeActions[0]
        .decisionContext?.evidence,
    ).not.toBe(evidence);

    expect(
      result.activeActions[0]
        .decisionContext?.evidence[0],
    ).not.toBe(evidence[0]);
  });
});

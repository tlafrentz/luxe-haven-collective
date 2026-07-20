import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createExecutiveAction,
} from "../test-support/factories";

import {
  buildActionCenterView,
} from "./build-action-center-view";

describe("buildActionCenterView", () => {
  it("builds execution summary counts", () => {
    const result = buildActionCenterView([
      {
        action: createExecutiveAction({
          id: "accepted",
          status: "accepted",
        }),
      },
      {
        action: createExecutiveAction({
          id: "in-progress",
          status: "in-progress",
        }),
      },
      {
        action: createExecutiveAction({
          id: "blocked",
          status: "blocked",
        }),
      },
      {
        action: createExecutiveAction({
          id: "completed",
          status: "completed",
        }),
      },
      {
        action: createExecutiveAction({
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
        action: createExecutiveAction(),
      },
      {
        action: createExecutiveAction({
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
        action: createExecutiveAction({
          id: "active",
          status: "in-progress",
        }),
      },
      {
        action: createExecutiveAction({
          id: "completed",
          status: "completed",
          completedAt:
            "2026-07-15T18:00:00.000Z",
        }),
      },
      {
        action: createExecutiveAction({
          id: "measured",
          status: "measured",
          measuredAt:
            "2026-07-22T18:00:00.000Z",
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
        action: createExecutiveAction({
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
        action: createExecutiveAction(),
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
        action: createExecutiveAction(),
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

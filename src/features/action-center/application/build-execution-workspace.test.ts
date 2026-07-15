import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createActionCenterRecord,
  createExecutiveAction,
} from "../test-support/factories";

import {
  buildExecutionWorkspace,
} from "./build-execution-workspace";

describe("buildExecutionWorkspace", () => {
  it("builds an outcome-led execution workspace", () => {
    const result =
      buildExecutionWorkspace(
        createActionCenterRecord(),
      );

    expect(result.outcomeTitle).toBe(
      "Recover missed weekend revenue",
    );

    expect(result.whyNow).toBe(
      "Weekend demand is outpacing current pricing.",
    );

    expect(result.recommendedAction).toEqual({
      title: "Increase weekend pricing",
      summary:
        "Increase Friday and Saturday rates by 8%.",
    });

    expect(result.metadata).toEqual({
      ownerName: "Todd",
      ownerType: "user",
      propertyId: "property-1",
      source: "executive-intelligence",
      type: "pricing",
      priority: "high",
      status: "accepted",
      expectedImpact: "+$620/month",
      confidence: "high",
    });
  });

  it("falls back to action language when decision context is unavailable", () => {
    const action =
      createExecutiveAction();

    const result =
      buildExecutionWorkspace({
        action,
      });

    expect(result.outcomeTitle).toBe(
      action.title,
    );

    expect(result.whyNow).toBe(
      action.summary,
    );

    expect(result.evidence).toEqual([]);
  });

  it("builds a chronological execution timeline", () => {
    const result =
      buildExecutionWorkspace(
        createActionCenterRecord({
          action: createExecutiveAction({
            status: "measured",
            startedAt:
              "2026-07-15T14:00:00.000Z",
            completedAt:
              "2026-07-15T18:00:00.000Z",
            measuredAt:
              "2026-07-22T18:00:00.000Z",
          }),
        }),
      );

    expect(
      result.timeline.map(
        (event) => event.type,
      ),
    ).toEqual([
      "created",
      "accepted",
      "started",
      "completed",
      "measured",
    ]);
  });

  it.each([
    ["accepted", "start"],
    ["scheduled", "complete"],
    ["in-progress", "complete"],
    ["blocked", "complete"],
    ["completed", "measure"],
    ["proposed", "archive"],
    ["measured", "archive"],
    ["archived", "none"],
  ] as const)(
    "maps %s status to %s as the next step",
    (status, nextStep) => {
      const result =
        buildExecutionWorkspace(
          createActionCenterRecord({
            action: createExecutiveAction({
              status,
            }),
          }),
        );

      expect(result.nextStep).toBe(
        nextStep,
      );
    },
  );

  it("captures measured learning", () => {
    const result =
      buildExecutionWorkspace(
        createActionCenterRecord({
          action: createExecutiveAction({
            status: "measured",
            completedAt:
              "2026-07-15T18:00:00.000Z",
            measuredAt:
              "2026-07-22T18:00:00.000Z",
            outcome: {
              summary:
                "Weekend pricing was updated.",
              successful: true,
              measuredImpact: {
                revenue: 620,
                occupancy: 4.5,
              },
              lessonsLearned: [
                "Demand supported the higher rate.",
              ],
            },
          }),
        }),
      );

    expect(result.learning).toEqual({
      status: "captured",
      outcome: {
        summary:
          "Weekend pricing was updated.",
        successful: true,
        measuredImpact: {
          revenue: 620,
          occupancy: 4.5,
        },
        lessonsLearned: [
          "Demand supported the higher rate.",
        ],
      },
    });
  });

  it("marks learning as pending before measurement", () => {
    const result =
      buildExecutionWorkspace(
        createActionCenterRecord(),
      );

    expect(result.learning.status).toBe(
      "pending",
    );
  });

  it("copies evidence and learning collections", () => {
    const evidence = [
      {
        label: "Weekend occupancy",
        value: "93%",
      },
    ];

    const lessonsLearned = [
      "Demand supported the higher rate.",
    ];

    const record =
      createActionCenterRecord({
        action: createExecutiveAction({
          status: "measured",
          outcome: {
            summary: "Pricing changed.",
            successful: true,
            lessonsLearned,
          },
        }),
        decisionContext: {
          outcomeTitle:
            "Recover missed weekend revenue",
          whyNow:
            "Weekend demand is strong.",
          evidence,
        },
      });

    const result =
      buildExecutionWorkspace(record);

    expect(result.evidence).not.toBe(
      evidence,
    );

    expect(result.evidence[0]).not.toBe(
      evidence[0],
    );

    expect(
      result.learning.outcome
        ?.lessonsLearned,
    ).not.toBe(lessonsLearned);
  });
});

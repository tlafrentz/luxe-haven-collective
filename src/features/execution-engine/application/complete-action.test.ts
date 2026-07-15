import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExecutiveAction,
} from "../domain";

import {
  completeAction,
} from "./complete-action";

function createExecutiveAction(
  overrides: Partial<ExecutiveAction> = {},
): ExecutiveAction {
  return {
    id: "action-1",
    priorityId: "executive-priority-1",
    propertyId: "property-1",
    source: "executive-intelligence",
    type: "pricing",
    title: "Increase weekend pricing",
    summary:
      "Increase Friday and Saturday rates.",
    priority: "high",
    status: "accepted",
    owner: {
      type: "user",
      id: "user-1",
      displayName: "Todd",
    },
    createdAt:
      "2026-07-14T20:00:00.000Z",
    acceptedAt:
      "2026-07-14T20:00:00.000Z",
    ...overrides,
  };
}

describe("completeAction", () => {
  it.each([
    "accepted",
    "scheduled",
    "in-progress",
    "blocked",
  ] as const)(
    "completes an action with status %s",
    (status) => {
      const action =
        createExecutiveAction({
          status,
        });

      const result = completeAction({
        action,
        completedAt:
          "2026-07-15T18:00:00.000Z",
        outcome: {
          summary:
            "Weekend rates were updated.",
          successful: true,
        },
      });

      expect(result.status).toBe(
        "completed",
      );

      expect(result.completedAt).toBe(
        "2026-07-15T18:00:00.000Z",
      );

      expect(result.outcome).toEqual({
        summary:
          "Weekend rates were updated.",
        successful: true,
        measuredImpact: undefined,
        lessonsLearned: undefined,
      });
    },
  );

  it.each([
    "proposed",
    "completed",
    "measured",
    "archived",
  ] as const)(
    "rejects an action with status %s",
    (status) => {
      const action =
        createExecutiveAction({
          status,
        });

      expect(() =>
        completeAction({
          action,
          completedAt:
            "2026-07-15T18:00:00.000Z",
          outcome: {
            summary:
              "The work was completed.",
            successful: true,
          },
        }),
      ).toThrow(
        `Cannot complete action with status "${status}".`,
      );
    },
  );

  it("preserves existing action history", () => {
    const action =
      createExecutiveAction({
        status: "in-progress",
        startedAt:
          "2026-07-15T14:00:00.000Z",
      });

    const result = completeAction({
      action,
      completedAt:
        "2026-07-15T18:00:00.000Z",
      outcome: {
        summary:
          "The pricing update was completed.",
        successful: true,
      },
    });

    expect(result.createdAt).toBe(
      action.createdAt,
    );

    expect(result.acceptedAt).toBe(
      action.acceptedAt,
    );

    expect(result.startedAt).toBe(
      action.startedAt,
    );

    expect(result.priorityId).toBe(
      action.priorityId,
    );
  });

  it("does not mutate the original action", () => {
    const action =
      createExecutiveAction({
        status: "blocked",
      });

    const result = completeAction({
      action,
      completedAt:
        "2026-07-15T18:00:00.000Z",
      outcome: {
        summary:
          "The blocking issue was resolved.",
        successful: true,
        measuredImpact: {
          revenue: 250,
        },
        lessonsLearned: [
          "Review rates earlier in the week.",
        ],
      },
    });

    expect(result).not.toBe(action);
    expect(action.status).toBe("blocked");
    expect(action.completedAt).toBeUndefined();
    expect(action.outcome).toBeUndefined();
  });

  it("copies nested outcome data", () => {
    const measuredImpact = {
      revenue: 250,
    };

    const lessonsLearned = [
      "Review rates earlier in the week.",
    ];

    const result = completeAction({
      action: createExecutiveAction(),
      completedAt:
        "2026-07-15T18:00:00.000Z",
      outcome: {
        summary:
          "Weekend rates were updated.",
        successful: true,
        measuredImpact,
        lessonsLearned,
      },
    });

    expect(
      result.outcome?.measuredImpact,
    ).not.toBe(measuredImpact);

    expect(
      result.outcome?.lessonsLearned,
    ).not.toBe(lessonsLearned);

    expect(result.outcome).toEqual({
      summary:
        "Weekend rates were updated.",
      successful: true,
      measuredImpact: {
        revenue: 250,
      },
      lessonsLearned: [
        "Review rates earlier in the week.",
      ],
    });
  });
});

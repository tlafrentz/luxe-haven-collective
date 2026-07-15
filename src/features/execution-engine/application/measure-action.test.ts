import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExecutiveAction,
} from "../domain";

import {
  measureAction,
} from "./measure-action";

function createCompletedAction(
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
    status: "completed",
    owner: {
      type: "user",
      id: "user-1",
      displayName: "Todd",
    },
    createdAt:
      "2026-07-14T20:00:00.000Z",
    acceptedAt:
      "2026-07-14T20:00:00.000Z",
    startedAt:
      "2026-07-15T14:00:00.000Z",
    completedAt:
      "2026-07-15T18:00:00.000Z",
    outcome: {
      summary:
        "Weekend pricing was updated.",
      successful: true,
    },
    ...overrides,
  };
}

describe("measureAction", () => {
  it("measures a completed action", () => {
    const result = measureAction({
      action: createCompletedAction(),
      measuredAt:
        "2026-07-22T18:00:00.000Z",
      measuredImpact: {
        revenue: 425,
        occupancy: 8.5,
      },
      lessonsLearned: [
        "Weekend demand supported the higher rate.",
      ],
    });

    expect(result.status).toBe(
      "measured",
    );

    expect(result.measuredAt).toBe(
      "2026-07-22T18:00:00.000Z",
    );

    expect(result.outcome).toEqual({
      summary:
        "Weekend pricing was updated.",
      successful: true,
      measuredImpact: {
        revenue: 425,
        occupancy: 8.5,
      },
      lessonsLearned: [
        "Weekend demand supported the higher rate.",
      ],
    });
  });

  it("preserves completion history and existing outcome details", () => {
    const action =
      createCompletedAction({
        outcome: {
          summary:
            "Weekend pricing was updated.",
          successful: true,
          measuredImpact: {
            revenue: 200,
          },
          lessonsLearned: [
            "Guests accepted the initial increase.",
          ],
        },
      });

    const result = measureAction({
      action,
      measuredAt:
        "2026-07-22T18:00:00.000Z",
      measuredImpact: {
        occupancy: 6,
      },
      lessonsLearned: [
        "The increase should be tested again next month.",
      ],
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

    expect(result.completedAt).toBe(
      action.completedAt,
    );

    expect(
      result.outcome?.measuredImpact,
    ).toEqual({
      revenue: 200,
      occupancy: 6,
    });

    expect(
      result.outcome?.lessonsLearned,
    ).toEqual([
      "Guests accepted the initial increase.",
      "The increase should be tested again next month.",
    ]);
  });

  it("supports qualitative measurement without numeric impact", () => {
    const result = measureAction({
      action: createCompletedAction(),
      measuredAt:
        "2026-07-22T18:00:00.000Z",
      lessonsLearned: [
        "Earlier implementation would improve results.",
      ],
    });

    expect(result.status).toBe(
      "measured",
    );

    expect(
      result.outcome?.lessonsLearned,
    ).toEqual([
      "Earlier implementation would improve results.",
    ]);
  });

  it("trims lessons and removes empty values", () => {
    const result = measureAction({
      action: createCompletedAction(),
      measuredAt:
        "2026-07-22T18:00:00.000Z",
      lessonsLearned: [
        "  Review pricing weekly.  ",
        "",
        "   ",
      ],
    });

    expect(
      result.outcome?.lessonsLearned,
    ).toEqual([
      "Review pricing weekly.",
    ]);
  });

  it("does not mutate the original action or outcome", () => {
    const action =
      createCompletedAction();

    const originalOutcome =
      action.outcome;

    const result = measureAction({
      action,
      measuredAt:
        "2026-07-22T18:00:00.000Z",
      measuredImpact: {
        revenue: 425,
      },
    });

    expect(result).not.toBe(action);

    expect(result.outcome).not.toBe(
      originalOutcome,
    );

    expect(action.status).toBe(
      "completed",
    );

    expect(
      action.measuredAt,
    ).toBeUndefined();

    expect(
      action.outcome?.measuredImpact,
    ).toBeUndefined();
  });

  it.each([
    "proposed",
    "accepted",
    "scheduled",
    "in-progress",
    "blocked",
    "measured",
    "archived",
  ] as const)(
    "rejects an action with status %s",
    (status) => {
      expect(() =>
        measureAction({
          action: createCompletedAction({
            status,
          }),
          measuredAt:
            "2026-07-22T18:00:00.000Z",
          measuredImpact: {
            revenue: 425,
          },
        }),
      ).toThrow(
        `Cannot measure action with status "${status}".`,
      );
    },
  );

  it("rejects a completed action without an outcome", () => {
    expect(() =>
      measureAction({
        action: createCompletedAction({
          outcome: undefined,
        }),
        measuredAt:
          "2026-07-22T18:00:00.000Z",
        measuredImpact: {
          revenue: 425,
        },
      }),
    ).toThrow(
      "Cannot measure an action without a completion outcome.",
    );
  });

  it("rejects an empty measurement", () => {
    expect(() =>
      measureAction({
        action: createCompletedAction(),
        measuredAt:
          "2026-07-22T18:00:00.000Z",
        measuredImpact: {},
        lessonsLearned: [
          "",
          "   ",
        ],
      }),
    ).toThrow(
      "Action measurement must include measured impact or lessons learned.",
    );
  });
});

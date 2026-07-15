import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExecutiveAction,
} from "../domain";

import {
  startAction,
} from "./start-action";

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

describe("startAction", () => {
  it("starts an accepted action", () => {
    const action =
      createExecutiveAction();

    const result = startAction({
      action,
      startedAt:
        "2026-07-15T14:00:00.000Z",
    });

    expect(result.status).toBe(
      "in-progress",
    );

    expect(result.startedAt).toBe(
      "2026-07-15T14:00:00.000Z",
    );
  });

  it("preserves existing action history", () => {
    const action =
      createExecutiveAction();

    const result = startAction({
      action,
      startedAt:
        "2026-07-15T14:00:00.000Z",
    });

    expect(result.id).toBe(action.id);

    expect(result.priorityId).toBe(
      action.priorityId,
    );

    expect(result.createdAt).toBe(
      action.createdAt,
    );

    expect(result.acceptedAt).toBe(
      action.acceptedAt,
    );

    expect(result.owner).toBe(
      action.owner,
    );
  });

  it("does not mutate the original action", () => {
    const action =
      createExecutiveAction();

    const result = startAction({
      action,
      startedAt:
        "2026-07-15T14:00:00.000Z",
    });

    expect(result).not.toBe(action);

    expect(action.status).toBe(
      "accepted",
    );

    expect(
      action.startedAt,
    ).toBeUndefined();
  });

  it.each([
    "proposed",
    "scheduled",
    "in-progress",
    "blocked",
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
        startAction({
          action,
          startedAt:
            "2026-07-15T14:00:00.000Z",
        }),
      ).toThrow(
        `Cannot start action with status "${status}".`,
      );
    },
  );
});

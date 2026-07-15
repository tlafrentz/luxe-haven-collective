import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExecutiveAction,
} from "../domain";

import {
  archiveAction,
} from "./archive-action";

function createAction(
  overrides: Partial<ExecutiveAction> = {},
): ExecutiveAction {
  return {
    id: "action-1",
    propertyId: "property-1",
    source: "manual",
    type: "operations",
    title: "Archive Test",
    summary: "Testing archive.",
    priority: "medium",
    status: "accepted",
    owner: {
      type: "user",
      id: "1",
      displayName: "Todd",
    },
    createdAt:
      "2026-07-14T10:00:00Z",
    acceptedAt:
      "2026-07-14T10:00:00Z",
    ...overrides,
  };
}

describe("archiveAction", () => {
  it.each([
    "proposed",
    "accepted",
    "blocked",
    "completed",
    "measured",
  ] as const)(
    "archives %s actions",
    (status) => {
      const result =
        archiveAction({
          action: createAction({
            status,
          }),
          archivedAt:
            "2026-07-20T12:00:00Z",
        });

      expect(result.status).toBe(
        "archived",
      );

      expect(result.archivedAt).toBe(
        "2026-07-20T12:00:00Z",
      );
    },
  );

  it.each([
    "scheduled",
    "in-progress",
    "archived",
  ] as const)(
    "rejects %s actions",
    (status) => {
      expect(() =>
        archiveAction({
          action: createAction({
            status,
          }),
          archivedAt:
            "2026-07-20T12:00:00Z",
        }),
      ).toThrow(
        `Cannot archive action with status "${status}".`,
      );
    },
  );

  it("does not mutate the original action", () => {
    const action = createAction();

    const result =
      archiveAction({
        action,
        archivedAt:
          "2026-07-20T12:00:00Z",
      });

    expect(result).not.toBe(action);

    expect(action.status).toBe(
      "accepted",
    );

    expect(
      action.archivedAt,
    ).toBeUndefined();
  });
});

import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExecutivePriority,
} from "@/features/executive-intelligence";

import {
  acceptExecutivePriority,
} from "./accept-executive-priority";

function createExecutivePriority(
  overrides: Partial<ExecutivePriority> = {},
): ExecutivePriority {
  return {
    id: "executive-priority-opportunity-1",
    rank: 1,
    source: "revenue-intelligence",
    sourceId: "opportunity-1",
    pillar: "revenue",
    propertyId: "property-1",
    status: "open",
    severity: "high",
    confidence: "high",
    title: "Increase weekend pricing",
    summary:
      "Weekend rates may be below current demand.",
    rationale:
      "Weekend occupancy and booking pace are strong.",
    impact: {
      type: "revenue-increase",
      estimatedAmount: 500,
      currency: "USD",
      basis:
        "Estimated from available weekend nights.",
    },
    action: {
      type: "increase-rate",
      summary:
        "Increase Friday and Saturday rates.",
      parameters: {
        percentage: 10,
      },
    },
    detectedAt: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("acceptExecutivePriority", () => {
  it("creates an accepted action from an open executive priority", () => {
    const priority =
      createExecutivePriority();

    const result =
      acceptExecutivePriority({
        priority,
        actionId: "action-1",
        owner: {
          type: "user",
          id: "user-1",
          displayName: "Todd",
        },
        acceptedAt:
          "2026-07-14T20:00:00.000Z",
      });

    expect(result).toEqual({
      id: "action-1",
      priorityId:
        "executive-priority-opportunity-1",
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
    });
  });

  it("maps distribution recommendations to distribution actions", () => {
    const result =
      acceptExecutivePriority({
        priority: createExecutivePriority({
          severity: "medium",
          action: {
            type: "diversify-booking-sources",
            summary:
              "Increase direct booking activity.",
          },
        }),
        actionId: "action-2",
        owner: {
          type: "team",
          id: "growth-team",
          displayName: "Growth Team",
        },
        acceptedAt:
          "2026-07-14T20:15:00.000Z",
      });

    expect(result.type).toBe(
      "distribution",
    );

    expect(result.priority).toBe(
      "medium",
    );
  });

  it.each([
    "accepted",
    "dismissed",
    "completed",
  ] as const)(
    "rejects a priority with status %s",
    (status) => {
      const priority =
        createExecutivePriority({
          status,
        });

      expect(() =>
        acceptExecutivePriority({
          priority,
          actionId: "action-invalid",
          owner: {
            type: "user",
            id: "user-1",
            displayName: "Todd",
          },
          acceptedAt:
            "2026-07-14T20:30:00.000Z",
        }),
      ).toThrow(
        `Cannot accept executive priority with status "${status}".`,
      );
    },
  );
});

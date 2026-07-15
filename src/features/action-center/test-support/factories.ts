import type {
  ExecutiveAction,
} from "@/features/execution-engine";

export function createExecutiveAction(
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

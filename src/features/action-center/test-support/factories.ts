import type {
  ExecutiveAction,
} from "@/features/execution-engine";

import type {
  ActionCenterRecord,
} from "../domain";

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
      "Increase Friday and Saturday rates by 8%.",
    priority: "high",
    status: "accepted",
    owner: {
      type: "user",
      id: "user-1",
      displayName: "Todd",
    },
    createdAt:
      "2026-07-14T18:00:00.000Z",
    acceptedAt:
      "2026-07-14T18:15:00.000Z",
    ...overrides,
  };
}

export function createActionCenterRecord(
  overrides: Partial<ActionCenterRecord> = {},
): ActionCenterRecord {
  const base: ActionCenterRecord = {
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
  };

  return {
    ...base,
    ...overrides,
    action:
      overrides.action ?? base.action,
    decisionContext:
      overrides.decisionContext ??
      base.decisionContext,
  };
}

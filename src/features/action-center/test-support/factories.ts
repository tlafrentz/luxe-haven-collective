import {
  Action,
  createActionId,
  type ActionInput,
} from "@/platform/actions";

import type { PlatformActionCenterRecord } from "../domain";

export type PlatformActionOverrides = Partial<
  Omit<ActionInput, "id">
> & {
  id?: string;
};

export function createPlatformAction(
  overrides: PlatformActionOverrides = {},
): Action {
  const { id = "action-1", ...inputOverrides } = overrides;

  return Action.create({
    id: createActionId(id),
    title: "Increase weekend pricing",
    summary: "Increase Friday and Saturday rates by 8%.",
    type: "pricing",
    priority: "high",
    status: "accepted",
    owner: {
      type: "user",
      id: "user-1",
      displayName: "Todd",
    },
    decisionIds: [],
    createdAt: new Date("2026-07-14T18:00:00.000Z"),
    acceptedAt: new Date("2026-07-14T18:15:00.000Z"),
    metadata: {
      legacyPropertyId: "property-1",
      source: "executive-intelligence",
    },
    ...inputOverrides,
  });
}

export function createPlatformActionCenterRecord(
  overrides: Partial<PlatformActionCenterRecord> = {},
): PlatformActionCenterRecord {
  const base: PlatformActionCenterRecord = {
    action: createPlatformAction(),
    decisionContext: {
      outcomeTitle: "Recover missed weekend revenue",
      whyNow: "Weekend demand is outpacing current pricing.",
      expectedImpact: "+$620/month",
      confidence: "high",
      evidence: [
        { label: "Weekend occupancy", value: "93%" },
        { label: "Comparable market ADR", value: "+9%" },
      ],
    },
  };

  return { ...base, ...overrides };
}

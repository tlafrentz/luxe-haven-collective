import {
  Action,
  createActionId,
  type ActionInput,
} from "@/platform/actions";

import type {
  PlatformActionCenterRecord,
} from "../domain";

function createFixtureAction(
  id: string,
  input: Omit<ActionInput, "id" | "decisionIds">,
): Action {
  return Action.create({
    id: createActionId(id),
    decisionIds: [],
    ...input,
  });
}

export const ACTION_CENTER_RECORDS = [
  {
    action: createFixtureAction("action-1", {
      title: "Increase weekend pricing",
      summary:
        "Increase Friday and Saturday rates by 8% to better reflect current demand.",
      type: "pricing",
      priority: "high",
      status: "accepted",
      owner: {
        type: "user",
        id: "user-1",
        displayName: "Todd",
      },
      createdAt: new Date("2026-07-14T18:00:00.000Z"),
      acceptedAt: new Date("2026-07-14T18:15:00.000Z"),
      metadata: {
        legacyPropertyId: "property-1",
        source: "executive-intelligence",
      },
    }),
    decisionContext: {
      outcomeTitle: "Recover missed weekend revenue",
      whyNow:
        "Weekend occupancy has reached 93% across the next three Fridays while comparable market rates have increased.",
      expectedImpact: "+$620/month",
      confidence: "high",
      evidence: [
        { label: "Weekend occupancy", value: "93%" },
        { label: "Comparable market ADR", value: "+9%" },
      ],
    },
  },
  {
    action: createFixtureAction("action-2", {
      title: "Review uncaptured payment",
      summary:
        "Confirm payment capture for an upcoming reservation before the guest arrival window.",
      type: "finance",
      priority: "critical",
      status: "in-progress",
      owner: {
        type: "team",
        id: "operations",
        displayName: "Operations",
      },
      createdAt: new Date("2026-07-14T16:00:00.000Z"),
      acceptedAt: new Date("2026-07-14T16:10:00.000Z"),
      startedAt: new Date("2026-07-14T16:30:00.000Z"),
      metadata: {
        legacyPropertyId: "property-1",
        source: "executive-intelligence",
      },
    }),
    decisionContext: {
      outcomeTitle: "Protect upcoming reservation revenue",
      whyNow:
        "An upcoming reservation has an authorized payment that has not yet been captured.",
      expectedImpact: "$575 protected",
      confidence: "high",
      evidence: [
        { label: "Reservation value", value: "$575" },
        { label: "Arrival window", value: "3 days" },
      ],
    },
  },
  {
    action: createFixtureAction("action-3", {
      title: "Prepare direct booking campaign",
      summary:
        "Create a repeat-guest offer to reduce booking-source concentration over the next 30 days.",
      type: "distribution",
      priority: "medium",
      status: "blocked",
      owner: {
        type: "team",
        id: "growth",
        displayName: "Growth Team",
      },
      createdAt: new Date("2026-07-13T14:00:00.000Z"),
      acceptedAt: new Date("2026-07-13T14:20:00.000Z"),
      startedAt: new Date("2026-07-13T15:00:00.000Z"),
      metadata: { source: "executive-intelligence" },
    }),
    decisionContext: {
      outcomeTitle: "Reduce booking-source concentration",
      whyNow:
        "A large share of current reservations originates from a single booking channel.",
      expectedImpact: "Lower channel risk",
      confidence: "medium",
      evidence: [
        { label: "Largest channel share", value: "82%" },
        { label: "Target direct share", value: "15%" },
      ],
    },
  },
] as const satisfies readonly PlatformActionCenterRecord[];

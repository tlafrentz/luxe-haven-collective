import type {
  ActionCenterRecord,
} from "../domain";

export const ACTION_CENTER_RECORDS: ActionCenterRecord[] = [
  {
    action: {
      id: "action-1",
      priorityId:
        "executive-priority-weekend-pricing",
      propertyId: "property-1",
      source: "executive-intelligence",
      type: "pricing",
      title: "Increase weekend pricing",
      summary:
        "Increase Friday and Saturday rates by 8% to better reflect current demand.",
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
    },
    decisionContext: {
      outcomeTitle:
        "Recover missed weekend revenue",
      whyNow:
        "Weekend occupancy has reached 93% across the next three Fridays while comparable market rates have increased.",
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
  },
  {
    action: {
      id: "action-2",
      priorityId:
        "executive-priority-payment",
      propertyId: "property-1",
      source: "executive-intelligence",
      type: "finance",
      title: "Review uncaptured payment",
      summary:
        "Confirm payment capture for an upcoming reservation before the guest arrival window.",
      priority: "critical",
      status: "in-progress",
      owner: {
        type: "team",
        id: "operations",
        displayName: "Operations",
      },
      createdAt:
        "2026-07-14T16:00:00.000Z",
      acceptedAt:
        "2026-07-14T16:10:00.000Z",
      startedAt:
        "2026-07-14T16:30:00.000Z",
    },
    decisionContext: {
      outcomeTitle:
        "Protect upcoming reservation revenue",
      whyNow:
        "An upcoming reservation has an authorized payment that has not yet been captured.",
      expectedImpact: "$575 protected",
      confidence: "high",
      evidence: [
        {
          label: "Reservation value",
          value: "$575",
        },
        {
          label: "Arrival window",
          value: "3 days",
        },
      ],
    },
  },
  {
    action: {
      id: "action-3",
      priorityId:
        "executive-priority-direct-booking",
      propertyId: null,
      source: "executive-intelligence",
      type: "distribution",
      title: "Prepare direct booking campaign",
      summary:
        "Create a repeat-guest offer to reduce booking-source concentration over the next 30 days.",
      priority: "medium",
      status: "blocked",
      owner: {
        type: "team",
        id: "growth",
        displayName: "Growth Team",
      },
      createdAt:
        "2026-07-13T14:00:00.000Z",
      acceptedAt:
        "2026-07-13T14:20:00.000Z",
      startedAt:
        "2026-07-13T15:00:00.000Z",
    },
    decisionContext: {
      outcomeTitle:
        "Reduce booking-source concentration",
      whyNow:
        "A large share of current reservations originates from a single booking channel.",
      expectedImpact: "Lower channel risk",
      confidence: "medium",
      evidence: [
        {
          label: "Largest channel share",
          value: "82%",
        },
        {
          label: "Target direct share",
          value: "15%",
        },
      ],
    },
  },
];

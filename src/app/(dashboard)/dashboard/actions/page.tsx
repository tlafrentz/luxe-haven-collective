import { Action, createActionId, type ActionInput } from "@/platform/actions";
import { ActionCenter, buildActionCenterView, type PlatformActionCenterRecord } from "@/features/action-center";

function action(id: string, propertyId: string | null, input: Omit<ActionInput, "id" | "decisionIds" | "metadata">): Action {
  return Action.create({ id: createActionId(id), decisionIds: [], ...input, metadata: { legacyPropertyId: propertyId } });
}

const records: PlatformActionCenterRecord[] = [
  {
    action: action("action-1", "property-1", {
      type: "pricing", title: "Increase weekend pricing", summary: "Increase Friday and Saturday rates by 8% to better reflect current demand.",
      priority: "high", status: "accepted", owner: { type: "user", id: "user-1", displayName: "Todd" },
      createdAt: new Date("2026-07-14T18:00:00.000Z"), acceptedAt: new Date("2026-07-14T18:15:00.000Z"),
    }),
    decisionContext: {
      outcomeTitle: "Recover missed weekend revenue", whyNow: "Weekend occupancy has reached 93% across the next three Fridays while comparable market rates have increased.",
      expectedImpact: "+$620/month", confidence: "high", evidence: [{ label: "Weekend occupancy", value: "93%" }, { label: "Comparable market ADR", value: "+9%" }],
    },
  },
  {
    action: action("action-2", "property-1", {
      type: "finance", title: "Review uncaptured payment", summary: "Confirm payment capture for an upcoming reservation before the guest arrival window.",
      priority: "critical", status: "in-progress", owner: { type: "team", id: "operations", displayName: "Operations" },
      createdAt: new Date("2026-07-14T16:00:00.000Z"), acceptedAt: new Date("2026-07-14T16:10:00.000Z"), startedAt: new Date("2026-07-14T16:30:00.000Z"),
    }),
  },
  {
    action: action("action-3", null, {
      type: "distribution", title: "Prepare direct booking campaign", summary: "Create a repeat-guest offer to reduce booking-source concentration over the next 30 days.",
      priority: "medium", status: "blocked", owner: { type: "team", id: "growth", displayName: "Growth Team" },
      createdAt: new Date("2026-07-13T14:00:00.000Z"), acceptedAt: new Date("2026-07-13T14:20:00.000Z"), startedAt: new Date("2026-07-13T15:00:00.000Z"),
    }),
  },
];

export default function ActionCenterPage() {
  return <ActionCenter view={buildActionCenterView(records)} />;
}

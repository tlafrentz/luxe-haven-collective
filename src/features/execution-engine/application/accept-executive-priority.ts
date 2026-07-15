import type {
  ExecutivePriority,
} from "@/features/executive-intelligence";

import type {
  OpportunityActionType,
  OpportunitySeverity,
} from "@/features/revenue-intelligence";

import type {
  ActionOwner,
  ActionPriority,
  ActionType,
  ExecutiveAction,
} from "../domain";

export type AcceptExecutivePriorityInput = {
  priority: ExecutivePriority;
  actionId: string;
  owner: ActionOwner;
  acceptedAt: string;
};

function mapSeverityToPriority(
  severity: OpportunitySeverity,
): ActionPriority {
  switch (severity) {
    case "high":
      return "high";

    case "medium":
      return "medium";

    case "low":
      return "low";
  }
}

function mapOpportunityActionToActionType(
  actionType: OpportunityActionType,
): ActionType {
  switch (actionType) {
    case "increase-rate":
    case "decrease-rate":
    case "apply-discount":
    case "change-minimum-stay":
    case "open-calendar":
      return "pricing";

    case "promote-availability":
    case "diversify-booking-sources":
      return "distribution";

    case "review-payment":
      return "finance";

    case "review-cancellation-policy":
    case "monitor":
      return "operations";
  }
}

export function acceptExecutivePriority({
  priority,
  actionId,
  owner,
  acceptedAt,
}: AcceptExecutivePriorityInput): ExecutiveAction {
  if (priority.status !== "open") {
    throw new Error(
      `Cannot accept executive priority with status "${priority.status}".`,
    );
  }

  return {
    id: actionId,
    priorityId: priority.id,
    propertyId: priority.propertyId,
    source: "executive-intelligence",
    type: mapOpportunityActionToActionType(
      priority.action.type,
    ),
    title: priority.title,
    summary: priority.action.summary,
    priority: mapSeverityToPriority(
      priority.severity,
    ),
    status: "accepted",
    owner,
    createdAt: acceptedAt,
    acceptedAt,
  };
}

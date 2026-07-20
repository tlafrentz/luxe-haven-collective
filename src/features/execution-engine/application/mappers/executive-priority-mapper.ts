import type { ExecutivePriority } from "@/features/executive-intelligence";
import type { OpportunityActionType, OpportunitySeverity } from "@/features/revenue-intelligence";
import type { ActionPriority, ActionType } from "@/platform/actions";

export function mapExecutivePrioritySeverity(severity: OpportunitySeverity): ActionPriority {
  return severity;
}

export function mapExecutivePriorityActionType(actionType: OpportunityActionType): ActionType {
  switch (actionType) {
    case "increase-rate": case "decrease-rate": case "apply-discount": case "change-minimum-stay": case "open-calendar": return "pricing";
    case "promote-availability": case "diversify-booking-sources": return "distribution";
    case "review-payment": return "finance";
    case "review-cancellation-policy": case "monitor": return "operations";
  }
}

export function executivePriorityMetadata(priority: ExecutivePriority) {
  return { legacySource: "executive-intelligence", legacyPropertyId: priority.propertyId, legacyPriorityId: priority.id } as const;
}

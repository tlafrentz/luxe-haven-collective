import type { ActionOutcome, ActionType, LegacyActionOwner as ActionOwner, LegacyActionPriority as ActionPriority, LegacyActionStatus as ActionStatus } from "@/platform/actions";

export type ExecutiveActionSource = "revenue-intelligence" | "executive-intelligence" | "manual" | "automation" | "system";

/**
 * @deprecated Compatibility DTO for existing Action Center/persistence callers.
 * This is not an Action entity. Convert through the legacy Action mappers.
 */
export type ExecutiveAction = {
  id: string;
  recommendationId?: string;
  priorityId?: string;
  propertyId: string | null;
  source: ExecutiveActionSource;
  type: ActionType;
  title: string;
  summary: string;
  priority: ActionPriority;
  status: ActionStatus;
  owner: ActionOwner;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  measuredAt?: string;
  archivedAt?: string;
  outcome?: ActionOutcome;
};

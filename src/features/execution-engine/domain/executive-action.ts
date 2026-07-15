import type {
  ActionOutcome,
} from "./action-outcome";

import type {
  ActionOwner,
} from "./action-owner";

import type {
  ActionPriority,
} from "./action-priority";

import type {
  ActionStatus,
} from "./action-status";

import type {
  ActionType,
} from "./action-type";

export type ExecutiveActionSource =
  | "revenue-intelligence"
  | "executive-intelligence"
  | "manual"
  | "automation"
  | "system";

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

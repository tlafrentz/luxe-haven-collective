import type {
  ActionOutcome,
  LegacyActionPriority as ActionPriority,
  LegacyActionStatus as ActionStatus,
  ActionType,
  LegacyActionOwnerType as ActionOwnerType,
} from "@/platform/actions";

import type {
  ActionCenterEvidence,
  ActionDecisionContext,
  PlatformActionCenterRecord,
} from "./action-center-view";

export type ExecutionWorkspaceMetadata = {
  ownerName: string;
  ownerType: ActionOwnerType;
  propertyId: string | null;
  source: string | null;
  type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  expectedImpact?: string;
  confidence?: ActionDecisionContext["confidence"];
};

export type ExecutionTimelineEventType =
  | "created"
  | "accepted"
  | "started"
  | "completed"
  | "measured"
  | "archived";

export type ExecutionTimelineEvent = {
  type: ExecutionTimelineEventType;
  label: string;
  timestamp: string;
  completed: boolean;
};

export type ExecutionWorkspaceNextStep =
  | "start"
  | "complete"
  | "measure"
  | "archive"
  | "none";

export type ExecutionWorkspaceLearning = {
  status: "pending" | "captured";
  outcome?: ActionOutcome;
};

export type ExecutionWorkspace = {
  id: string;
  outcomeTitle: string;
  whyNow: string;
  evidence: ActionCenterEvidence[];
  recommendedAction: {
    title: string;
    summary: string;
  };
  metadata: ExecutionWorkspaceMetadata;
  timeline: ExecutionTimelineEvent[];
  learning: ExecutionWorkspaceLearning;
  nextStep: ExecutionWorkspaceNextStep;
};

export type ExecutionWorkspaceRecord =
  PlatformActionCenterRecord;

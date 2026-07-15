import type {
  ActionOutcome,
  ActionPriority,
  ActionStatus,
  ActionType,
  ExecutiveActionSource,
} from "@/features/execution-engine";

import type {
  OpportunityConfidence,
} from "@/features/revenue-intelligence";

import type {
  ActionCenterEvidence,
  ActionCenterRecord,
} from "./action-center-view";

export type ExecutionWorkspaceMetadata = {
  ownerName: string;
  ownerType: string;
  propertyId: string | null;
  source: ExecutiveActionSource;
  type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  expectedImpact?: string;
  confidence?: OpportunityConfidence;
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
  ActionCenterRecord;

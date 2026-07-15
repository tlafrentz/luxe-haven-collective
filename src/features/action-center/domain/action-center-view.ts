import type {
  ActionPriority,
  ActionStatus,
  ActionType,
  ExecutiveAction,
} from "@/features/execution-engine";

import type {
  OpportunityConfidence,
} from "@/features/revenue-intelligence";

export type ActionCenterEvidence = {
  label: string;
  value: string;
};

export type ActionDecisionContext = {
  outcomeTitle: string;
  whyNow: string;
  expectedImpact?: string;
  confidence?: OpportunityConfidence;
  evidence: ActionCenterEvidence[];
};

export type ActionCenterRecord = {
  action: ExecutiveAction;
  decisionContext?: ActionDecisionContext;
};

export type ActionCenterItem = {
  id: string;
  title: string;
  summary: string;
  propertyId: string | null;
  type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  ownerName: string;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  measuredAt?: string;
  decisionContext?: ActionDecisionContext;
};

export type ActionCenterSummary = {
  total: number;
  accepted: number;
  inProgress: number;
  blocked: number;
  completed: number;
  measured: number;
};

export type ActionCenterView = {
  summary: ActionCenterSummary;
  activeActions: ActionCenterItem[];
  recentlyCompleted: ActionCenterItem[];
  recentlyLearned: ActionCenterItem[];
};

export type ActionCenterActionType = string;
export type ActionCenterPriority = "critical" | "high" | "medium" | "low";
export type ActionCenterStatus = "proposed" | "accepted" | "scheduled" | "in-progress" | "blocked" | "completed" | "measured" | "archived";
export type ActionCenterEvidence = { label: string; value: string };
export type ActionDecisionContext = { outcomeTitle: string; whyNow: string; expectedImpact?: string; confidence?: "high" | "medium" | "low"; evidence: ActionCenterEvidence[] };

export type PlatformActionCenterRecord = Readonly<{
  action: Action;
  outcome?: Outcome;
  decision?: Decision<string>;
  evidence?: EvidenceCollection;
  decisionContext?: ActionDecisionContext;
}>;

/** @deprecated Compatibility input only. Production callers should provide PlatformActionCenterRecord. */
export type ActionCenterRecord = {
  action: {
    id: string; propertyId: string | null; type: ActionCenterActionType; title: string; summary: string;
    priority: ActionCenterPriority; status: ActionCenterStatus; owner: { displayName: string };
    createdAt: string; acceptedAt?: string; startedAt?: string; completedAt?: string; measuredAt?: string;
  };
  decisionContext?: ActionDecisionContext;
};

export type ActionCenterItem = {
  id: string; title: string; summary: string; propertyId: string | null; type: ActionCenterActionType;
  priority: ActionCenterPriority; status: ActionCenterStatus; ownerName: string; createdAt: string;
  acceptedAt?: string; startedAt?: string; completedAt?: string; measuredAt?: string; decisionContext?: ActionDecisionContext;
};
export type ActionCenterSummary = { total: number; accepted: number; inProgress: number; blocked: number; completed: number; measured: number };
export type ActionCenterView = { summary: ActionCenterSummary; activeActions: ActionCenterItem[]; recentlyCompleted: ActionCenterItem[]; recentlyMeasured: ActionCenterItem[] };
import type { Action } from "@/platform/actions";
import type { Decision } from "@/platform/decisions";
import type { EvidenceCollection } from "@/platform/evidence";
import type { Outcome } from "@/platform/outcomes";

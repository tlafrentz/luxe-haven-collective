import type {
  HpmPillar,
} from "@/features/hpm";

import type {
  OpportunityAction,
  OpportunityConfidence,
  OpportunitySeverity,
} from "@/features/revenue-intelligence";

export type ExecutivePrioritySource =
  | "revenue-intelligence"
  | "hpm"
  | "portfolio-change"
  | "system";

export type ExecutivePriorityStatus =
  | "open"
  | "accepted"
  | "dismissed"
  | "completed";

export type ExecutivePriorityImpactType =
  | "revenue-increase"
  | "revenue-at-risk"
  | "cost-reduction"
  | "occupancy-increase"
  | "operational-risk"
  | "business-health";

export type ExecutivePriorityImpact = {
  type: ExecutivePriorityImpactType;
  estimatedAmount?: number;
  estimatedPercentage?: number;
  currency?: string;
  basis: string;
};

export type ExecutivePriority = {
  id: string;
  rank: number;
  source: ExecutivePrioritySource;
  sourceId: string;
  pillar: HpmPillar;
  propertyId: string | null;
  status: ExecutivePriorityStatus;
  severity: OpportunitySeverity;
  confidence: OpportunityConfidence;
  title: string;
  summary: string;
  rationale: string;
  impact?: ExecutivePriorityImpact;
  action: OpportunityAction;
  detectedAt: string;
};

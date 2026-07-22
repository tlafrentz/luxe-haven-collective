import type { LegacyActionPriority as ActionPriority, LegacyActionStatus as ActionStatus } from "@/platform/actions";
import type { RecommendationPriority } from "@/platform/recommendations";

import type { ExecutiveAttentionItem } from "./executive-attention";

export type ExecutiveHealthSummary = Readonly<{
  score: number | null;
  confidence: number | null;
  status: "excellent" | "healthy" | "watch" | "needs-attention" | "critical" | "unavailable";
  summary: string;
  availablePillars: number;
  totalPillars: number;
  supportingScoreKeys: readonly string[];
}>;

export type ExecutiveAttentionSummary = Readonly<{
  risks: readonly ExecutiveAttentionItem[];
  opportunities: readonly ExecutiveAttentionItem[];
  priorities: readonly ExecutiveAttentionItem[];
}>;

export type ExecutiveDecisionItem = Readonly<{
  id: string;
  title: string;
  summary: string;
  priority: RecommendationPriority;
  confidence: number;
  decidedAt: Date;
}>;

export type ExecutiveDecisionSummary = Readonly<{
  active: number;
  awaitingEvidence: number;
  readyForReview: number;
  recentlyCompleted: number;
  highestPriorityDecision: ExecutiveDecisionItem | null;
}>;

export type ExecutiveActionItem = Readonly<{
  id: string;
  title: string;
  summary: string;
  priority: ActionPriority;
  status: ActionStatus;
  owner: string;
  decisionIds: readonly string[];
}>;

export type ExecutiveExecutionSummary = Readonly<{
  openActions: number;
  inProgressActions: number;
  overdueActions: number;
  completedActions: number;
  blockedActions: number;
  highestPriorityAction: ExecutiveActionItem | null;
}>;

export type ExecutiveOutcomeItem = Readonly<{
  id: string;
  title: string;
  summary: string;
  successful: boolean;
  completedAt: Date;
  metrics: Readonly<Record<string, number>>;
  actionIds: readonly string[];
  decisionIds: readonly string[];
}>;

export type ExecutiveOutcomeSummary = Readonly<{
  measuredOutcomes: number;
  positiveOutcomes: number;
  neutralOutcomes: number;
  negativeOutcomes: number;
  latestOutcome: ExecutiveOutcomeItem | null;
  learningSummary: string | null;
}>;

export type ExecutiveDataGap = Readonly<{
  type: "unavailable-data" | "low-confidence" | "incomplete-scope" | "unsupported-metric" | "absent-provider";
  message: string;
}>;

export type ExecutiveDataQualitySummary = Readonly<{
  availablePillars: readonly string[];
  unavailablePillars: readonly string[];
  confidence: number | null;
  gaps: readonly ExecutiveDataGap[];
  summary: string;
}>;

export type ExecutiveScopeSummary = Readonly<{
  properties: readonly Readonly<{ id: string; name: string }>[];
  selectedProperty: Readonly<{ id: string; name: string }> | null;
  propertyCount: number | null;
  startDate: string;
  endDate: string;
  scopeKnown: boolean;
}>;

export type ExecutiveMetricTrend = Readonly<{
  percentChange: number;
  direction: "up" | "down" | "neutral";
}>;

export type ExecutivePerformanceSummary = Readonly<{
  available: boolean;
  grossRevenue: Readonly<{ value: number | null; trend: ExecutiveMetricTrend | null }>;
  occupancyRate: Readonly<{ value: number | null; trend: ExecutiveMetricTrend | null }>;
  averageDailyRate: Readonly<{ value: number | null; trend: ExecutiveMetricTrend | null }>;
  revPar: Readonly<{ value: number | null; trend: ExecutiveMetricTrend | null }>;
  totalBookings: number | null;
  upcomingBookings: number | null;
}>;

export type ExecutiveIntelligenceView = Readonly<{
  generatedAt: Date;
  scope: ExecutiveScopeSummary;
  performance: ExecutivePerformanceSummary;
  health: ExecutiveHealthSummary;
  attention: ExecutiveAttentionSummary;
  decisions: ExecutiveDecisionSummary;
  execution: ExecutiveExecutionSummary;
  outcomes: ExecutiveOutcomeSummary;
  dataQuality: ExecutiveDataQualitySummary;
  briefing: Readonly<{
    headline: string;
    summary: string;
    recommendedFocus: string;
    highlights: readonly string[];
    concerns: readonly string[];
  }>;
}>;

import type { LearningCapabilityAvailability, LearningObservationWindow, LearningWorkspaceAttentionItem, LearningWorkspaceChange, LearningWorkspaceDistribution, LearningWorkspaceLearningItem, LearningWorkspaceLimitation, LearningWorkspaceMeasurementReadiness, LearningWorkspacePortfolioSummary } from "../workspace";

export type LearningHealth = "strong" | "healthy" | "developing" | "limited" | "insufficient-evidence";
export type GetLearningDashboardQuery = Readonly<{
  ownerId: string;
  portfolioId: string;
  observationWindow: LearningObservationWindow;
}>;
export type LearningDashboardRecommendationReliability = Readonly<{
  validated: number; conditional: number; experimental: number; deprecated: number;
  insufficientEvidence: number; trend: "improving" | "stable" | "declining" | "not-comparable";
  confidence: number | null;
}>;
export type LearningDashboardMaturityDistribution = Readonly<{
  candidate: number; emerging: number; supported: number; validated: number; contested: number; invalidated: number;
}>;
export type LearningDashboardAssumption = Readonly<{
  id: string; label: string; bias: "optimistic" | "conservative" | "mixed" | "unbiased" | "unknown";
  effect: string | null; confidence: number; materiality: string; trend: "improving" | "stable" | "declining" | "not-comparable";
  destination: string;
}>;
export type LearningIntelligenceDashboard = Readonly<{
  portfolio: LearningWorkspacePortfolioSummary;
  observationWindow: LearningObservationWindow;
  evaluatedAt: Date;
  executiveSummary: Readonly<{
    learningHealth: LearningHealth;
    decisionQuality: string;
    recommendationReliability: string;
    strongestLearning: LearningWorkspaceLearningItem | null;
    largestRecurringMiss: LearningWorkspaceLearningItem | null;
    measurementReadiness: LearningWorkspaceMeasurementReadiness;
    confidence: number | null;
  }>;
  decisionQuality: Readonly<{
    distribution: LearningWorkspaceDistribution;
    trend: "improving" | "stable" | "declining" | "not-comparable";
    confidence: number | null;
  }>;
  recommendationReliability: LearningDashboardRecommendationReliability;
  learningSummary: Readonly<{
    strongest: readonly LearningWorkspaceLearningItem[];
    recurringMisses: readonly LearningWorkspaceLearningItem[];
    emerging: readonly LearningWorkspaceLearningItem[];
    maturity: LearningDashboardMaturityDistribution;
  }>;
  assumptions: readonly LearningDashboardAssumption[];
  measurement: Readonly<{
    readiness: LearningWorkspaceMeasurementReadiness;
    completedOutcomes: number;
    incompleteOutcomes: number;
    inconclusiveOutcomes: number;
    missingBaselinePatterns: number;
  }>;
  changes: readonly LearningWorkspaceChange[];
  attention: readonly LearningWorkspaceAttentionItem[];
  freshness: Readonly<{ status: "current" | "stale" | "incompatible" | "unavailable"; reasons: readonly string[] }>;
  lineage: Readonly<{ portfolioVersion: number; decisionPolicyVersions: readonly string[]; recommendationPolicyVersions: readonly string[]; learningPolicyVersion?: string }>;
  capabilities: Readonly<{ viewWorkspace: LearningCapabilityAvailability; refreshLearning: LearningCapabilityAvailability }>;
  limitations: readonly LearningWorkspaceLimitation[];
  workspaceDestination: string;
}>;
export type LearningIntelligenceDashboardState =
  | Readonly<{ status: "ready"; dashboard: LearningIntelligenceDashboard }>
  | Readonly<{ status: "insufficient-evidence"; dashboard: LearningIntelligenceDashboard }>
  | Readonly<{ status: "degraded"; dashboard: LearningIntelligenceDashboard; unavailableSections: readonly string[] }>
  | Readonly<{ status: "no-outcomes"; portfolio: LearningWorkspacePortfolioSummary; plannedCount: number; measuringCount: number; workspaceDestination: string; limitations: readonly LearningWorkspaceLimitation[] }>
  | Readonly<{ status: "measurement-in-progress"; portfolio: LearningWorkspacePortfolioSummary; plannedCount: number; measuringCount: number; workspaceDestination: string; limitations: readonly LearningWorkspaceLimitation[] }>;
export type GetLearningDashboardError =
  | Readonly<{ code: "LEARNING_DASHBOARD_NOT_AUTHENTICATED" | "LEARNING_DASHBOARD_NOT_FOUND" | "LEARNING_DASHBOARD_NOT_AUTHORIZED" }>
  | Readonly<{ code: "LEARNING_DASHBOARD_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "LEARNING_DASHBOARD_UNEXPECTED"; correlationId?: string }>;

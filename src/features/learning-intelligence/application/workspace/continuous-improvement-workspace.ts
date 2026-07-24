import type { ConfidenceAssessment } from "@/platform/scoring";
import type { DecisionOutcomeAssessment, ObjectiveStatus, OutcomeClassification } from "../../decision-outcomes";
import type { PortfolioLearningAssessment } from "../../portfolio-learning";
import type { RecommendationEffectivenessAssessment } from "../../recommendation-effectiveness";

export type LearningObservationWindow = Readonly<{ start: Date; end: Date }>;
export type LearningWorkspaceSection = "outcomes" | "decisions" | "recommendations" | "learnings" | "measurement-quality" | "comparison";
export type LearningCapabilityAvailability = "available" | "unavailable" | "deferred";

export type GetContinuousImprovementWorkspaceQuery = Readonly<{
  ownerId: string;
  portfolioId: string;
  observationWindow: LearningObservationWindow;
  outcomeLimit?: number;
  recommendationLimit?: number;
  learningLimit?: number;
  changeLimit?: number;
  attentionLimit?: number;
}>;

export type LearningWorkspacePortfolioSummary = Readonly<{
  id: string; name: string; version: number; lifecycleStage: string;
}>;
export type LearningWorkspaceObjective = Readonly<{
  id: string; name: string; importance: "primary" | "secondary" | "guardrail";
  status: ObjectiveStatus; actual: string | null; target: string | null; confidence: number;
}>;
export type LearningWorkspaceOutcomeItem = Readonly<{
  id: string; subject: string; subjectType: string; decision: string;
  classification: OutcomeClassification; primaryObjective: LearningWorkspaceObjective | null;
  guardrails: Readonly<{ preserved: number; violated: number; unknown: number }>;
  unexpectedNegativeEffects: number; attribution: string; evidence: string;
  confidence: number; evaluatedAt: Date; destination?: string;
}>;
export type LearningWorkspaceDistribution = Readonly<Record<OutcomeClassification, Readonly<{ count: number; percentage: number | null }>>>;
export type LearningWorkspaceRecommendationItem = Readonly<{
  id: string; recommendationType: string; effectiveness: string; quality: string;
  sampleSize: number; successRate: number | null; harmRate: number | null;
  repeatability: string; confidence: number; trend: string | null;
  applicability: readonly string[]; learningReadiness: string; severeHarm: boolean;
}>;
export type LearningWorkspaceLearningItem = Readonly<{
  id: string; statementCode: string; statement: string; category: string; type: string;
  maturity: string; status: string; priority: string; materiality: string; confidence: number;
  supportingCount: number; contradictingCount: number; contradiction: string;
  applicability: string; conditions: readonly string[]; consistency: string; freshness: string;
  scope: string; typicalEffect: string | null;
}>;
export type LearningWorkspaceChange = Readonly<{
  id: string; type: "outcome" | "recommendation-effectiveness" | "portfolio-learning" | "measurement-quality";
  direction: "positive" | "negative" | "neutral"; changeCode: string; label: string; occurredAt?: Date;
}>;
export type LearningWorkspaceAttentionItem = Readonly<{
  rank: number; type: "outcome" | "recommendation" | "learning" | "measurement";
  severity: "critical" | "high" | "medium" | "informational"; sourceId: string; label: string;
}>;
export type LearningWorkspaceLimitation = Readonly<{
  code: string; section: LearningWorkspaceSection; impact: "minor" | "material" | "blocking"; label: string;
}>;
export type LearningWorkspaceMeasurementReadiness =
  | Readonly<{ status: "strong"; completedOutcomeCoverage: number; inconclusiveRate: number }>
  | Readonly<{ status: "limited"; primaryLimitations: readonly string[] }>
  | Readonly<{ status: "weak"; blockingLimitations: readonly string[] }>
  | Readonly<{ status: "unavailable" }>;

export type ContinuousImprovementWorkspace = Readonly<{
  portfolio: LearningWorkspacePortfolioSummary;
  observationWindow: LearningObservationWindow;
  evaluatedAt: Date;
  executiveSummary: Readonly<{
    decisionOutcomeStatus: string; recommendationStatus: string;
    strongestLearning: LearningWorkspaceLearningItem | null;
    largestRecurringMiss: LearningWorkspaceLearningItem | null;
    measurementReadiness: LearningWorkspaceMeasurementReadiness;
    confidence: number | null;
  }>;
  outcomes: Readonly<{ completedCount: number; measuringCount: number; plannedCount: number; recent: readonly LearningWorkspaceOutcomeItem[] }>;
  decisions: Readonly<{ distribution: LearningWorkspaceDistribution; averageConfidence: number | null; observationWindow: LearningObservationWindow }>;
  recommendations: Readonly<{ items: readonly LearningWorkspaceRecommendationItem[] }>;
  learnings: Readonly<{ items: readonly LearningWorkspaceLearningItem[]; candidateCount: number; activeCount: number }>;
  assumptionAccuracy: readonly LearningWorkspaceLearningItem[];
  executionPatterns: readonly LearningWorkspaceLearningItem[];
  measurementQuality: Readonly<{ readiness: LearningWorkspaceMeasurementReadiness; items: readonly LearningWorkspaceLearningItem[] }>;
  changes: Readonly<{ comparable: boolean; items: readonly LearningWorkspaceChange[] }>;
  attention: Readonly<{ items: readonly LearningWorkspaceAttentionItem[] }>;
  freshness: Readonly<{ status: "current" | "stale" | "incompatible" | "unavailable"; reasons: readonly string[]; latestOutcomeEvaluation?: Date; latestLearningEvaluation?: Date }>;
  lineage: Readonly<{ decisionPolicyVersions: readonly string[]; recommendationPolicyVersions: readonly string[]; learningPolicyVersion?: string; portfolioVersion: number }>;
  capabilities: Readonly<Record<"viewOutcomes" | "viewDecisionAssessments" | "viewRecommendationEffectiveness" | "viewPortfolioLearnings" | "refreshLearning" | "createOutcome" | "recordMeasurement" | "reviewLearning" | "applyLearning" | "createAction", LearningCapabilityAvailability>>;
  limitations: readonly LearningWorkspaceLimitation[];
}>;

export type LearningWorkspaceEmptyState = Readonly<{ portfolio: LearningWorkspacePortfolioSummary; plannedCount: number; measuringCount: number; limitations: readonly LearningWorkspaceLimitation[] }>;
export type ContinuousImprovementWorkspaceState =
  | Readonly<{ status: "ready"; workspace: ContinuousImprovementWorkspace }>
  | Readonly<{ status: "no-outcomes"; workspace: LearningWorkspaceEmptyState }>
  | Readonly<{ status: "measurement-in-progress"; workspace: LearningWorkspaceEmptyState }>
  | Readonly<{ status: "insufficient-evidence"; workspace: ContinuousImprovementWorkspace; gaps: readonly string[] }>
  | Readonly<{ status: "degraded"; workspace: ContinuousImprovementWorkspace; unavailableSections: readonly LearningWorkspaceSection[] }>;

export type LearningWorkspacePortfolioSource = Readonly<{
  id: string; ownerId: string; name: string; version: number; lifecycleStage: string;
}>;
export type LearningWorkspaceOutcomeSource = Readonly<{
  assessment: DecisionOutcomeAssessment;
  subject: string; subjectType: string; decision: string;
}>;
export type LearningWorkspaceSources = Readonly<{
  portfolio: LearningWorkspacePortfolioSource;
  outcomes: readonly LearningWorkspaceOutcomeSource[];
  plannedOutcomeCount: number;
  measuringOutcomeCount: number;
  recommendations: readonly RecommendationEffectivenessAssessment[];
  learning: PortfolioLearningAssessment | null;
  unavailableSections: readonly LearningWorkspaceSection[];
}>;

export type GetContinuousImprovementWorkspaceError =
  | Readonly<{ code: "LEARNING_WORKSPACE_NOT_AUTHENTICATED" | "LEARNING_WORKSPACE_NOT_FOUND" | "LEARNING_WORKSPACE_NOT_AUTHORIZED" }>
  | Readonly<{ code: "LEARNING_WORKSPACE_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "LEARNING_WORKSPACE_UNEXPECTED"; correlationId?: string }>;

export type LearningWorkspaceSourceError = Readonly<{ code: "unavailable" | "not-found" | "invalid"; retryable: boolean }>;
export interface LearningWorkspaceAuthorization { canRead(ownerId: string, portfolioId: string): Promise<"authorized" | "concealed"> }
export interface LearningWorkspacePortfolioReader { read(ownerId: string, portfolioId: string): Promise<LearningWorkspacePortfolioSource | null> }
export interface LearningWorkspaceOutcomeReader { read(ownerId: string, portfolioId: string, window: LearningObservationWindow, limit: number): Promise<Readonly<{ items: readonly LearningWorkspaceOutcomeSource[]; planned: number; measuring: number }>> }
export interface LearningWorkspaceRecommendationReader { read(ownerId: string, portfolioId: string, window: LearningObservationWindow, limit: number): Promise<readonly RecommendationEffectivenessAssessment[]> }
export interface LearningWorkspacePortfolioLearningReader { read(ownerId: string, portfolioId: string, window: LearningObservationWindow): Promise<PortfolioLearningAssessment | null> }

export function confidenceScore(value: ConfidenceAssessment): number {
  return value.score.value;
}

import type { ConfidenceLevel } from "@/platform/scoring";
import type {
  DecisionOutcomeAssessment, OutcomeVariance as CanonicalOutcomeVariance,
} from "@/features/learning-intelligence/decision-outcomes";
import type {
  FindingEvidence,
} from "../findings";
import type {
  PortfolioDecisionCandidate, PortfolioStrategicDecision,
} from "../decisions";
import type { WorkspaceRole } from "@/features/workspace";

export type PortfolioOutcomeSuccess =
  | "exceeded-expectations" | "met-expectations" | "partially-met"
  | "did-not-meet" | "unable-to-evaluate";
export type PortfolioVarianceDirection = "positive" | "neutral" | "negative" | "unknown";
export type AssumptionReviewStatus =
  | "confirmed" | "invalidated" | "partially-validated" | "unable-to-evaluate";
export type ConfidenceAdjustment = "increase" | "maintain" | "reduce";
export type KnowledgeMaturity = "emerging" | "supported" | "established" | "well-validated";
export type PortfolioLearningCategory =
  | "revenue" | "operations" | "guests" | "markets" | "properties"
  | "capital" | "technology" | "execution";

export type OutcomeMetricReview = Readonly<{
  metric: string; dimension: "financial" | "operational" | "guest" | "resilience" | "strategic";
  baseline: string; expected: string; actual: string;
  variance: CanonicalOutcomeVariance | null; direction: PortfolioVarianceDirection;
  status: "exceeded" | "achieved" | "missed" | "unknown" | "not-measured";
  confidence: ConfidenceLevel; evidence: readonly FindingEvidence[];
}>;
export type DecisionAssumptionReview = Readonly<{
  assumptionId: string; statement: string; status: AssumptionReviewStatus;
  evidence: readonly FindingEvidence[]; reviewedAt: string; notes: string;
}>;
export type DecisionLesson = Readonly<{
  whatHappened: string; why: string; surprise: string; futureGuidance: string;
}>;
export type PortfolioDecisionOutcomeReview = Readonly<{
  id: string; workspaceId: string; decisionId: string; outcomeId: string;
  assessmentId: string; assessmentVersion: number; decisionEvidenceVersion: string;
  reviewDate: string; baseline: readonly string[]; expected: readonly string[];
  actual: readonly string[]; metrics: readonly OutcomeMetricReview[];
  success: PortfolioOutcomeSuccess; lessons: DecisionLesson;
  assumptions: readonly DecisionAssumptionReview[];
  confidence: ConfidenceLevel; confidenceAdjustment: ConfidenceAdjustment;
  evidence: readonly FindingEvidence[]; reviewedByProfileId: string;
  immutable: true; createdAt: string;
}>;
export type PortfolioLearningRecord = Readonly<{
  id: string; workspaceId: string; category: PortfolioLearningCategory;
  lesson: string; futureGuidance: string; evidence: readonly FindingEvidence[];
  confidence: ConfidenceLevel; maturity: KnowledgeMaturity;
  derivedFromReviewIds: readonly string[]; createdAt: string; version: number;
}>;
export type RecommendationPerformance = Readonly<{
  generated: number; approved: number; completed: number; successful: number;
  rejected: number; deferred: number; expired: number;
  byStrength: readonly Readonly<{
    strength: PortfolioDecisionCandidate["recommendationStrength"];
    reviewed: number; successful: number; successRate: number | null;
    calibration: ConfidenceAdjustment;
  }>[];
}>;
export type StrategyEffectiveness = Readonly<{
  decisionType: PortfolioStrategicDecision["decisionType"]; reviewed: number;
  exceeded: number; met: number; partial: number; didNotMeet: number; unable: number;
  confidence: ConfidenceLevel;
}>;
export type OutcomeReviewReadiness = Readonly<{
  decisionId: string; state: "ready" | "not-ready" | "insufficient-evidence" | "degraded";
  reasons: readonly string[]; reviewAt?: string;
}>;
export type PortfolioOutcomeSummary = Readonly<{
  reviewed: number; exceeded: number; met: number; partiallyMet: number;
  didNotMeet: number; unable: number; reviewCompletion: number;
}>;
export type PortfolioOutcomesWorkspace = Readonly<{
  reviews: readonly PortfolioDecisionOutcomeReview[];
  readiness: readonly OutcomeReviewReadiness[];
  learnings: readonly PortfolioLearningRecord[];
  recommendationPerformance: RecommendationPerformance;
  strategyEffectiveness: readonly StrategyEffectiveness[];
  summary: PortfolioOutcomeSummary;
  state: "ready" | "empty" | "insufficient-evidence" | "degraded" | "permission-limited";
  role: WorkspaceRole; canReview: boolean; evaluatedAt: string;
}>;
export type BuildOutcomeReviewInput = Readonly<{
  workspaceId: string; decision: PortfolioStrategicDecision;
  assessment: DecisionOutcomeAssessment; assumptionReviews: readonly DecisionAssumptionReview[];
  lessons: DecisionLesson; reviewedByProfileId: string; reviewedAt: string;
  evidence: readonly FindingEvidence[];
}>;
export type PortfolioOutcomePolicy = Readonly<{
  version: string; minimumElapsedDays: number; minimumEvidenceReferences: number;
  supportedKnowledgeReviews: number; establishedKnowledgeReviews: number;
  wellValidatedKnowledgeReviews: number;
}>;
export interface PortfolioOutcomeRepository {
  listReviews(workspaceId: string): Promise<readonly PortfolioDecisionOutcomeReview[]>;
  appendReview(review: PortfolioDecisionOutcomeReview, commandId: string): Promise<PortfolioDecisionOutcomeReview>;
  listLearnings(workspaceId: string): Promise<readonly PortfolioLearningRecord[]>;
  publishLearning(learning: PortfolioLearningRecord, commandId: string): Promise<PortfolioLearningRecord>;
}


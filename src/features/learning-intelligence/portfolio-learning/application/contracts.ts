import type { ResultType } from "@/platform/kernel";
import type { DecisionOutcomeAssessment } from "../../decision-outcomes";
import type { RecommendationEffectivenessAssessment } from "../../recommendation-effectiveness";
import type { OutcomeOwnerId } from "../../outcomes";
import type {
  PortfolioLearningAssessment, PortfolioLearningAssessmentId, PortfolioLearningObservationWindow,
  PortfolioLearningPolicy, PortfolioLearningPortfolioSource,
} from "../domain";

export type PortfolioLearningSourceError = Readonly<{ code: "UNAVAILABLE"; retryable: boolean }>;
export interface PortfolioLearningAuthorization { canEvaluate(ownerId: OutcomeOwnerId, portfolioId: string): Promise<boolean> }
export interface PortfolioLearningPortfolioReader { readPortfolio(ownerId: OutcomeOwnerId, portfolioId: string): Promise<ResultType<PortfolioLearningPortfolioSource | null, PortfolioLearningSourceError>> }
export interface PortfolioLearningDecisionOutcomeReader { readEligible(ownerId: OutcomeOwnerId, portfolioId: string, window: PortfolioLearningObservationWindow, limit: number): Promise<ResultType<readonly DecisionOutcomeAssessment[], PortfolioLearningSourceError>> }
export interface PortfolioLearningRecommendationEffectivenessReader { readEligible(ownerId: OutcomeOwnerId, portfolioId: string, window: PortfolioLearningObservationWindow, limit: number): Promise<ResultType<readonly RecommendationEffectivenessAssessment[], PortfolioLearningSourceError>> }
export interface PortfolioLearningPolicyProvider { get(version?: string): PortfolioLearningPolicy | null }
export interface PortfolioLearningAssessmentRepository {
  save(value: PortfolioLearningAssessment, expectedVersion: number | null): Promise<ResultType<void, PortfolioLearningRepositoryError>>;
  findLatest(ownerId: OutcomeOwnerId, portfolioId: string): Promise<ResultType<PortfolioLearningAssessment | null, PortfolioLearningRepositoryError>>;
  findById(ownerId: OutcomeOwnerId, id: PortfolioLearningAssessmentId): Promise<ResultType<PortfolioLearningAssessment | null, PortfolioLearningRepositoryError>>;
}
export type PortfolioLearningRepositoryError =
  | Readonly<{ code: "PORTFOLIO_LEARNING_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_DUPLICATE_ID" }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_REPOSITORY_UNAVAILABLE"; retryable: boolean }>;
export type EvaluatePortfolioLearningError =
  | Readonly<{ code: "PORTFOLIO_LEARNING_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_NOT_AUTHORIZED" }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_INPUT_INVALID"; field?: string; reason?: string }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_POLICY_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_OUTCOMES_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_ASSESSMENTS_INCOMPATIBLE" }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_REPOSITORY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_LEARNING_UNEXPECTED"; correlationId?: string }>;

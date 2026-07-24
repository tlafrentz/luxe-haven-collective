import type { PortfolioId, PortfolioOwnerId } from "@/features/portfolio";
import type { ResultType } from "@/platform/kernel";
import type {
  CapitalAllocationAssessment,
  PortfolioHealthAssessment,
  PortfolioObservationWindow,
  PortfolioRecommendationAssessment,
  PortfolioRecommendationHistory,
  PortfolioRecommendationObservation,
  PortfolioRecommendationPolicy,
  PortfolioRecommendationPolicyVersion,
  PortfolioRecommendationStrategy,
} from "../domain";

export type EvaluatePortfolioRecommendationsQuery = Readonly<{
  ownerId: PortfolioOwnerId;
  portfolioId: PortfolioId;
  observationWindow: PortfolioObservationWindow;
  policyVersion?: PortfolioRecommendationPolicyVersion;
  evaluatedAt: Date;
}>;
export type EvaluatePortfolioRecommendationsError =
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_NOT_AUTHORIZED" }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_HEALTH_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_ALLOCATION_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_POLICY_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_SOURCES_INCOMPATIBLE" }>
  | Readonly<{ code: "PORTFOLIO_RECOMMENDATIONS_UNEXPECTED"; correlationId?: string }>;

export interface PortfolioRecommendationAuthorizer {
  authorize(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<boolean>;
}
export interface PortfolioRecommendationPortfolioReader {
  readPortfolio(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<Readonly<{ portfolioVersion: number }> | null>;
}
export interface PortfolioRecommendationHealthReader {
  readLatestHealth(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<PortfolioHealthAssessment | null>;
}
export interface PortfolioRecommendationAllocationReader {
  readLatestAllocation(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<CapitalAllocationAssessment | null>;
}
export interface PortfolioRecommendationStrategyReader {
  readStrategy(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<PortfolioRecommendationStrategy>;
}
export interface PortfolioRecommendationExecutiveReader {
  readExecutiveObservations(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, window: PortfolioObservationWindow): Promise<readonly PortfolioRecommendationObservation[]>;
}
export interface PortfolioRecommendationMarketReader {
  readMarketObservations(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, window: PortfolioObservationWindow): Promise<readonly PortfolioRecommendationObservation[]>;
}
export interface PortfolioRecommendationInvestmentReader {
  readInvestmentObservations(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, window: PortfolioObservationWindow): Promise<readonly PortfolioRecommendationObservation[]>;
}
export interface PortfolioRecommendationPolicyProvider {
  get(version?: PortfolioRecommendationPolicyVersion): PortfolioRecommendationPolicy | null;
}
export interface PortfolioRecommendationInstrumentation {
  record(input: Readonly<{ policyVersion: string; outcome: "evaluated" | "failure"; recommendationCount: number; limitationCount: number }>): void;
}
export type PortfolioRecommendationReaders = Readonly<{
  portfolio: PortfolioRecommendationPortfolioReader;
  health: PortfolioRecommendationHealthReader;
  allocation: PortfolioRecommendationAllocationReader;
  strategy: PortfolioRecommendationStrategyReader;
  executive: PortfolioRecommendationExecutiveReader;
  market: PortfolioRecommendationMarketReader;
  investment: PortfolioRecommendationInvestmentReader;
}>;
export interface PortfolioRecommendationHistoryRepository {
  save(history: PortfolioRecommendationHistory): Promise<ResultType<void, Readonly<{ code: "PORTFOLIO_RECOMMENDATION_HISTORY_SAVE_FAILED"; retryable: boolean }>>>;
  findByRecommendationId(recommendationId: string, ownerId: PortfolioOwnerId): Promise<PortfolioRecommendationHistory | null>;
}
export type EvaluatePortfolioRecommendations = (
  query: EvaluatePortfolioRecommendationsQuery,
) => Promise<ResultType<PortfolioRecommendationAssessment, EvaluatePortfolioRecommendationsError>>;

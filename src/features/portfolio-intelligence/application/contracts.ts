import type { PortfolioId, PortfolioOwnerId } from "@/features/portfolio";
import type { ResultType } from "@/platform/kernel";

import type {
  PortfolioExposureSource,
  PortfolioHealthAssessment,
  PortfolioHealthCapitalSource,
  PortfolioHealthObservationSource,
  PortfolioHealthOpportunitySource,
  PortfolioHealthPolicy,
  PortfolioHealthPolicyVersion,
  PortfolioHealthPortfolioSource,
  PortfolioHealthPropertySource,
  PortfolioHealthRiskSource,
  PortfolioHealthStrategySource,
  PortfolioObservationWindow,
} from "../domain";

export type EvaluatePortfolioHealthQuery = Readonly<{
  ownerId: PortfolioOwnerId;
  portfolioId: PortfolioId;
  observationWindow: PortfolioObservationWindow;
  policyVersion?: PortfolioHealthPolicyVersion;
  evaluatedAt: Date;
}>;
export type EvaluatePortfolioHealthError =
  | Readonly<{ code: "PORTFOLIO_HEALTH_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_NOT_AUTHORIZED" }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_POLICY_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_SOURCE_UNAVAILABLE"; source: "portfolio" | "properties" | "performance" | "capital" | "risk" | "strategy"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_OBSERVATIONS_INCOMPATIBLE" }>
  | Readonly<{ code: "PORTFOLIO_HEALTH_UNEXPECTED"; correlationId?: string }>;

export interface PortfolioHealthPortfolioReader {
  readPortfolio(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<Readonly<{
    portfolio: PortfolioHealthPortfolioSource;
    opportunities: readonly PortfolioHealthOpportunitySource[];
  }> | null>;
}
export interface PortfolioHealthPropertyReader {
  readProperties(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly PortfolioHealthPropertySource[]>;
}
export interface PortfolioHealthPerformanceReader {
  readPerformance(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, window: PortfolioObservationWindow): Promise<Readonly<Record<string, Partial<Pick<PortfolioHealthPropertySource, "revenue" | "netOperatingIncome" | "occupancy" | "adr" | "revpar" | "operatingMargin">>>>>;
}
export interface PortfolioHealthCapitalReader {
  readCapital(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<PortfolioHealthCapitalSource>;
}
export interface PortfolioHealthRiskReader {
  readRisks(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly PortfolioHealthRiskSource[]>;
}
export interface PortfolioHealthStrategyReader {
  readStrategy(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<PortfolioHealthStrategySource | null>;
}
export interface PortfolioHealthExposureReader {
  readExposures(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly PortfolioExposureSource[]>;
}
export interface PortfolioHealthObservationReader {
  readObservations(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, window: PortfolioObservationWindow): Promise<readonly PortfolioHealthObservationSource[]>;
}
export interface PortfolioHealthPolicyProvider {
  get(version?: PortfolioHealthPolicyVersion): PortfolioHealthPolicy | null;
}
export interface PortfolioHealthInstrumentation {
  record(input: Readonly<{ portfolioId: string; policyVersion: string; outcome: "evaluated" | "insufficient-data" | "failure"; durationMilliseconds: number }>): void;
}
export type PortfolioHealthReaders = Readonly<{
  portfolio: PortfolioHealthPortfolioReader;
  properties: PortfolioHealthPropertyReader;
  performance: PortfolioHealthPerformanceReader;
  capital: PortfolioHealthCapitalReader;
  risks: PortfolioHealthRiskReader;
  strategy: PortfolioHealthStrategyReader;
  exposures: PortfolioHealthExposureReader;
  observations: PortfolioHealthObservationReader;
}>;
export type EvaluatePortfolioHealth = (
  query: EvaluatePortfolioHealthQuery,
) => Promise<ResultType<import("../domain").PortfolioHealthEvaluationResult, EvaluatePortfolioHealthError>>;

export type PortfolioHealthAssessmentRecord = Readonly<{ assessmentId: string; assessment: PortfolioHealthAssessment }>;
export interface PortfolioHealthAssessmentRepository {
  save(record: PortfolioHealthAssessmentRecord): Promise<ResultType<void, Readonly<{ code: "PORTFOLIO_HEALTH_PERSISTENCE_FAILED"; retryable: boolean }>>>;
  findLatest(portfolioId: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioHealthAssessmentRecord | null>;
  findById(assessmentId: string, ownerId: PortfolioOwnerId): Promise<PortfolioHealthAssessmentRecord | null>;
}

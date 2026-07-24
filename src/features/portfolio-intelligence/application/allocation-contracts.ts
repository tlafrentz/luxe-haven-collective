import type { PortfolioId, PortfolioOwnerId } from "@/features/portfolio";
import type { ResultType } from "@/platform/kernel";

import type {
  CapitalAllocationAcquisitionSource,
  CapitalAllocationAssessment,
  CapitalAllocationObligationSource,
  CapitalAllocationPolicy,
  CapitalAllocationPolicyVersion,
  CapitalAllocationPortfolioSource,
  CapitalAllocationPosition,
  CapitalAllocationPropertyImprovementSource,
  PortfolioGoalReference,
  PortfolioHealthAssessment,
} from "../domain";

export type EvaluateCapitalAllocationQuery = Readonly<{
  ownerId: PortfolioOwnerId;
  portfolioId: PortfolioId;
  healthAssessmentId?: string;
  policyVersion?: CapitalAllocationPolicyVersion;
  evaluatedAt: Date;
}>;
export type EvaluateCapitalAllocationError =
  | Readonly<{ code: "CAPITAL_ALLOCATION_PORTFOLIO_NOT_FOUND" }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_NOT_AUTHORIZED" }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_HEALTH_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_CAPITAL_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_POLICY_NOT_FOUND" }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_SOURCE_UNAVAILABLE"; source: "portfolio" | "health" | "capital" | "strategy" | "opportunities" | "improvements" | "obligations"; retryable: boolean }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_CURRENCY_INCOMPATIBLE" }>
  | Readonly<{ code: "CAPITAL_ALLOCATION_UNEXPECTED"; correlationId?: string }>;
export interface CapitalAllocationPortfolioReader {
  readPortfolio(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<CapitalAllocationPortfolioSource | null>;
}
export interface CapitalAllocationHealthReader {
  readLatestCompatibleHealth(ownerId: PortfolioOwnerId, portfolioId: PortfolioId, assessmentId?: string): Promise<Readonly<{ assessmentId?: string; assessment: PortfolioHealthAssessment }> | null>;
}
export interface CapitalAllocationCapitalReader {
  readCapitalPosition(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<CapitalAllocationPosition>;
}
export interface CapitalAllocationOpportunityReader {
  readCandidates(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly CapitalAllocationAcquisitionSource[]>;
}
export interface CapitalAllocationPropertyImprovementReader {
  readImprovementCandidates(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly CapitalAllocationPropertyImprovementSource[]>;
}
export interface CapitalAllocationObligationReader {
  readMandatoryObligations(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly CapitalAllocationObligationSource[]>;
}
export interface CapitalAllocationStrategyReader {
  readGoals(ownerId: PortfolioOwnerId, portfolioId: PortfolioId): Promise<readonly PortfolioGoalReference[]>;
}
export interface CapitalAllocationPolicyProvider {
  get(version?: CapitalAllocationPolicyVersion): CapitalAllocationPolicy | null;
}
export interface CapitalAllocationInstrumentation {
  record(input: Readonly<{ portfolioId: string; policyVersion: string; outcome: "evaluated" | "failure"; durationMilliseconds: number }>): void;
}
export type CapitalAllocationReaders = Readonly<{
  portfolio: CapitalAllocationPortfolioReader; health: CapitalAllocationHealthReader; capital: CapitalAllocationCapitalReader;
  opportunities: CapitalAllocationOpportunityReader; improvements: CapitalAllocationPropertyImprovementReader;
  obligations: CapitalAllocationObligationReader; strategy: CapitalAllocationStrategyReader;
}>;
export type EvaluateCapitalAllocation = (query: EvaluateCapitalAllocationQuery) => Promise<ResultType<CapitalAllocationAssessment, EvaluateCapitalAllocationError>>;

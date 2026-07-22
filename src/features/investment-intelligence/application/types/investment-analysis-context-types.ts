import type {
  AppliedLearningReference,
  InvestmentAppliedLearningContext,
  InvestmentConstraint,
  InvestmentRiskContext,
} from "./investment-learning-application-types";
import type {
  RunInvestmentAnalysisCommand,
} from "../run-investment-analysis";
import type {
  InvestmentMarketContext,
  InvestmentMarketEvidenceUsability,
} from "./investment-market-context-types";

export type InvestmentAnalysisAssumptionSource =
  | "user"
  | "applied-learning"
  | "market"
  | "system-default";

export type InvestmentAnalysisAssumption = Readonly<{
  key: string;
  value: number | string | boolean;
  source: InvestmentAnalysisAssumptionSource;
  applicationId?: string;
  marketAnalysisId?: string;
  marketEvidenceIds?: readonly string[];
  confidenceScore?: number;
}>;

export type InvestmentAnalysisAssumptions =
  readonly InvestmentAnalysisAssumption[];

export type InvestmentAnalysisInput =
  RunInvestmentAnalysisCommand;

export type BuildInvestmentAnalysisContextCommand = Readonly<{
  input: InvestmentAnalysisInput;
  /**
   * Required provenance for the legacy route input, whose required fields
   * otherwise cannot distinguish operator values from prefilled defaults.
   */
  userProvidedAssumptionKeys: readonly string[];
  appliedLearning?: InvestmentAppliedLearningContext;
  marketContext?: InvestmentMarketContext;
}>;

export type InvestmentAnalysisContext = Readonly<{
  input: InvestmentAnalysisInput;
  assumptions: InvestmentAnalysisAssumptions;
  constraints: readonly InvestmentConstraint[];
  resolvedDataGaps: readonly string[];
  persistentRiskContext: readonly InvestmentRiskContext[];
  lineage: readonly AppliedLearningReference[];
  marketContext?: InvestmentMarketContext;
  marketEvidenceUsability?: InvestmentMarketEvidenceUsability;
}>;

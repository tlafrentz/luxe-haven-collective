import type {
  AppliedLearningReference,
  InvestmentAppliedLearningContext,
  InvestmentConstraint,
  InvestmentRiskContext,
} from "./investment-learning-application-types";
import type {
  RunInvestmentAnalysisCommand,
} from "../run-investment-analysis";

export type InvestmentAnalysisAssumptionSource =
  | "user"
  | "applied-learning"
  | "system-default";

export type InvestmentAnalysisAssumption = Readonly<{
  key: string;
  value: number | string | boolean;
  source: InvestmentAnalysisAssumptionSource;
  applicationId?: string;
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
}>;

export type InvestmentAnalysisContext = Readonly<{
  input: InvestmentAnalysisInput;
  assumptions: InvestmentAnalysisAssumptions;
  constraints: readonly InvestmentConstraint[];
  resolvedDataGaps: readonly string[];
  persistentRiskContext: readonly InvestmentRiskContext[];
  lineage: readonly AppliedLearningReference[];
}>;

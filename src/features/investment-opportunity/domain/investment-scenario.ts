import type {
  OpportunityAnalysisSnapshot,
  OpportunityAnalysisSourceSummary,
  OpportunityAnalysisPolicyVersions,
} from "./model";

export type InvestmentScenarioType =
  | "base"
  | "optimistic"
  | "conservative"
  | "cash-purchase"
  | "leveraged-purchase"
  | "rental-arbitrage"
  | "renovation"
  | "value-add"
  | "custom";

export type InvestmentScenarioStatus =
  | "draft"
  | "calculated"
  | "preferred"
  | "archived"
  | "superseded";

export type InvestmentScenarioSnapshot = Readonly<{
  calculationVersion: string;
  engineVersion: string;
  evidenceVersion: string;
  recommendationVersion: string;
  scoreVersion: string;
  assumptions: Readonly<Record<string, string | number | boolean>>;
  result: OpportunityAnalysisSnapshot;
  sourceSummary: OpportunityAnalysisSourceSummary;
  policyVersions: OpportunityAnalysisPolicyVersions;
  capturedAt: Date;
}>;

export type InvestmentScenario = Readonly<{
  id: string;
  opportunityId: string;
  name: string;
  description?: string;
  type: InvestmentScenarioType;
  status: InvestmentScenarioStatus;
  preferred: boolean;
  revision: number;
  snapshot: InvestmentScenarioSnapshot;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ScenarioDifferenceState =
  | "improved"
  | "declined"
  | "unchanged"
  | "unavailable";

export type ScenarioComparison = Readonly<{
  scenarioIds: readonly string[];
  changedAssumptions: readonly Readonly<{
    key: string;
    values: readonly Readonly<{ scenarioId: string; value?: string | number | boolean }>[];
  }>[];
  financialDifferences: readonly Readonly<{
    metric: string;
    values: readonly Readonly<{
      scenarioId: string;
      value?: number;
      difference?: number;
      state: ScenarioDifferenceState;
    }>[];
  }>[];
  recommendationDifferences: readonly Readonly<{
    scenarioId: string;
    recommendation: string;
    confidence: string;
    primaryRisk?: string;
  }>[];
}>;

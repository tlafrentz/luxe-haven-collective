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
  | "seller-financing"
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
  sourceAnalysisVersionId: string;
  sourceAnalysisVersionNumber?: number;
  sourceScenarioId?: string;
  sourceScenarioName?: string;
  name: string;
  description?: string;
  type: InvestmentScenarioType;
  status: InvestmentScenarioStatus;
  preferred: boolean;
  revision: number;
  metadataRevision?: number;
  notes?: string;
  snapshot: InvestmentScenarioSnapshot;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}>;

export type ScenarioDifferenceState =
  | "improved"
  | "declined"
  | "unchanged"
  | "unavailable";

export type ScenarioComparison = Readonly<{
  projectionVersion: string;
  generatedAt: Date;
  scenarioIds: readonly string[];
  executiveSummary: Readonly<{ bestOverallScenarioId: string; decision: string; highestCashFlowScenarioId?: string; lowestRiskScenarioId?: string; fastestPaybackScenarioId?: string }>;
  metrics: readonly Readonly<{ key: string; label: string; category: "revenue" | "expenses" | "returns" | "risk"; unit: "currency" | "percentage" | "months" | "rating"; favorable: "higher" | "lower"; bestScenarioIds: readonly string[]; worstScenarioIds: readonly string[]; values: readonly Readonly<{ scenarioId: string; value?: number | string; state: "best" | "worst" | "higher" | "lower" | "equal" | "unavailable" }>[] }>[];
  tradeoffs: readonly Readonly<{ scenarioId: string; benefits: readonly string[]; tradeoffs: readonly string[]; risks: readonly string[] }>[];
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

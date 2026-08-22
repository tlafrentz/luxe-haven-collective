import type { Money } from "@/platform/kernel";
import type {
  FinancialConfidence,
  FinancialFreshness,
  FinancialPeriod,
  FinancialReadModel,
} from "../../domain";
import type { FinancialOverviewScope } from "../overview";

export type PlanningMetric =
  "revenue" | "expenses" | "noi" | "cash" | "capital" | "reserve";
export type PlanValues = Readonly<Partial<Record<PlanningMetric, Money>>>;
export type PlanScope = Readonly<{
  type: "workspace" | "portfolio" | "property";
  workspaceId: string;
  portfolioId?: string;
  propertyId?: string;
  label: string;
}>;
export type ForecastAssumptionType =
  | "occupancy"
  | "adr"
  | "expense-inflation"
  | "insurance"
  | "utilities"
  | "taxes"
  | "seasonality"
  | "capital-event"
  | "market"
  | "growth"
  | "other";
export type ForecastAssumption = Readonly<{
  id: string;
  type: ForecastAssumptionType;
  label: string;
  value: string;
  status: "confirmed" | "changed" | "invalidated" | "unknown";
  effectiveFrom: string;
  evidenceIds: readonly string[];
}>;
export type FinancialBudgetPlan = Readonly<{
  id: string;
  scope: PlanScope;
  period: FinancialPeriod;
  values: PlanValues;
  assumptions: readonly ForecastAssumption[];
  status: "draft" | "under-review" | "approved" | "superseded" | "archived";
  version: number;
  revisionOf?: string;
  approvedAt?: string;
  evidenceIds: readonly string[];
}>;
export type FinancialForecastPlan = Readonly<{
  id: string;
  scope: PlanScope;
  period: FinancialPeriod;
  values: PlanValues;
  assumptions: readonly ForecastAssumption[];
  status: "current" | "superseded" | "expired" | "scenario";
  scenario: "base" | "optimistic" | "conservative" | "custom";
  version: number;
  confidence: FinancialConfidence;
  evidenceIds: readonly string[];
}>;
export type PlanningVariance = Readonly<{
  metric: PlanningMetric;
  actual: Money | null;
  plan: Money | null;
  amount: Money | null;
  percentage: number | null;
  classification: "favorable" | "unfavorable" | "neutral" | "unavailable";
  explanation: string;
  confidence: FinancialConfidence;
  evidenceIds: readonly string[];
}>;
export type ScenarioComparison = Readonly<{
  id: string;
  label: string;
  kind: FinancialForecastPlan["scenario"];
  version: number;
  values: PlanValues;
  confidence: FinancialConfidence;
  assumptionCount: number;
}>;
export type PropertyPlanningSummary = Readonly<{
  propertyId: string;
  label: string;
  budget: PlanValues | null;
  forecast: PlanValues | null;
  actual: PlanValues;
  variances: readonly PlanningVariance[];
  noiContribution: number | null;
  confidence: FinancialConfidence;
}>;
export type PlanningEvidence = Readonly<{
  budgetCoverage: number;
  forecastCoverage: number;
  propertyCoverage: number;
  assumptionCoverage: number;
  historyMonths: number;
  gaps: readonly string[];
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
}>;
export type ForecastRequirement =
  | "revenue_history"
  | "operating_expenses"
  | "cash_position"
  | "recurring_obligations";
export type ForecastReadiness = Readonly<{
  ready: boolean;
  missing: readonly ForecastRequirement[];
  requirements: Readonly<Record<ForecastRequirement, "ready" | "required">>;
  percentage: number;
}>;
export type FinancialPlanning = Readonly<{
  identity: FinancialReadModel["identity"];
  scope: FinancialOverviewScope;
  period: FinancialPeriod;
  budget: FinancialBudgetPlan | null;
  forecast: FinancialForecastPlan | null;
  actuals: PlanValues;
  budgetVariance: readonly PlanningVariance[];
  forecastVariance: readonly PlanningVariance[];
  scenarios: readonly ScenarioComparison[];
  properties: readonly PropertyPlanningSummary[];
  health:
    | "on-track"
    | "minor-variance"
    | "attention-needed"
    | "off-plan"
    | "unavailable";
  healthExplanation: string;
  evidence: PlanningEvidence;
  readiness: ForecastReadiness;
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
  evaluatedAt: string;
  projectionVersion: string;
  state:
    | "ready"
    | "empty"
    | "incomplete"
    | "partial"
    | "degraded"
    | "permission-limited";
  permissionLimited: boolean;
  canEditForecast: boolean;
  canApproveBudget: boolean;
}>;
export type BuildFinancialPlanningInput = Readonly<{
  actuals: FinancialReadModel;
  scope: FinancialOverviewScope;
  budget?: FinancialBudgetPlan | null;
  forecast?: FinancialForecastPlan | null;
  scenarios: readonly FinancialForecastPlan[];
  propertyPlans: readonly Readonly<{
    propertyId: string;
    label: string;
    actuals: FinancialReadModel;
    budget?: FinancialBudgetPlan | null;
    forecast?: FinancialForecastPlan | null;
  }>[];
  canViewPlanning: boolean;
  canEditForecast: boolean;
  canApproveBudget: boolean;
  permissionLimited?: boolean;
  projectionVersion?: string;
}>;
export type GetFinancialPlanningQuery = Readonly<{
  workspaceId: string;
  propertyIds?: readonly string[];
  portfolioId?: string;
  period: FinancialPeriod;
  forecastVersion?: number;
  scenarioIds?: readonly string[];
  evaluatedAt?: string;
}>;
export interface FinancialPlanningReader {
  read(query: GetFinancialPlanningQuery): Promise<BuildFinancialPlanningInput>;
}
export interface FinancialPlanningCache {
  get(key: string): Promise<FinancialPlanning | null>;
  put(key: string, value: FinancialPlanning): Promise<void>;
  invalidate(
    input: Readonly<{
      workspaceId: string;
      from?: string;
      reason:
        | "budget-revision"
        | "forecast-update"
        | "scenario-update"
        | "actuals-update"
        | "assumption-update"
        | "permission-change";
    }>,
  ): Promise<void>;
}
export interface FinancialPlanningRepository {
  getApprovedBudget(
    workspaceId: string,
    scope: FinancialOverviewScope,
    period: FinancialPeriod,
  ): Promise<FinancialBudgetPlan | null>;
  getCurrentForecast(
    workspaceId: string,
    scope: FinancialOverviewScope,
    period: FinancialPeriod,
    version?: number,
  ): Promise<FinancialForecastPlan | null>;
  listScenarios(
    workspaceId: string,
    scope: FinancialOverviewScope,
    period: FinancialPeriod,
  ): Promise<readonly FinancialForecastPlan[]>;
  listPropertyPlans(
    workspaceId: string,
    propertyIds: readonly string[],
    period: FinancialPeriod,
  ): Promise<
    readonly Readonly<{
      propertyId: string;
      budget?: FinancialBudgetPlan | null;
      forecast?: FinancialForecastPlan | null;
    }>[]
  >;
  saveBudgetRevision(plan: FinancialBudgetPlan): Promise<void>;
  saveForecastVersion(plan: FinancialForecastPlan): Promise<void>;
}

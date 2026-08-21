import type { Money } from "@/platform/kernel";
import type {
  AccountingMethod, FinancialConfidence, FinancialFreshness, FinancialPeriod,
  FinancialReadModel, FinancialSnapshot,
} from "../../domain";

export type FinancialOverviewScope = Readonly<{
  type: "workspace" | "portfolio" | "selected-properties" | "single-property";
  label: string;
  propertyIds: readonly string[];
  propertyCount: number;
}>;
export type FinancialValueQualification = "measured" | "estimated" | "projected" | "forecast" | "mixed" | "unavailable";
export type MetricAvailability = "available" | "partial" | "restricted" | "unavailable";
export type FinancialMetric = "revenue" | "operating-expenses" | "noi" | "operating-margin" | "cash-balance" | "net-cash-movement";
export type FinancialValueState = Readonly<{ money?: Money; percentage?: number; qualification: FinancialValueQualification; asOf?: string; limitation?: string }>;
export type FinancialMetricChange = Readonly<{ amount?: Money; percentageChange?: number; percentagePointChange?: number; kind: "absolute-and-percentage" | "absolute-only" | "new" | "unavailable"; direction: "improved" | "declined" | "stable" | "uncertain" }>;
export type FinancialMetricSummary = Readonly<{
  metric: FinancialMetric; current: FinancialValueState; comparison?: FinancialValueState;
  change?: FinancialMetricChange; availability: MetricAvailability; confidence: FinancialConfidence;
  freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type FinancialConditionStatus = "strong" | "stable" | "attention-needed" | "at-risk" | "insufficient-evidence";
export type FinancialCondition = Readonly<{
  status: FinancialConditionStatus; summary: string; positiveDrivers: readonly string[];
  limitingConditions: readonly string[]; confidence: FinancialConfidence; evidenceIds: readonly string[];
  destination?: string; policyVersion: string;
}>;
export type ProfitabilitySummary = Readonly<{ status: "strongly-profitable" | "profitable" | "near-break-even" | "unprofitable" | "insufficient-evidence"; noi: FinancialValueState; margin: FinancialValueState; explanation: string; confidence: FinancialConfidence }>;
export type LiquiditySummary = Readonly<{ status: "strong" | "adequate" | "tight" | "critical" | "insufficient-evidence"; cash: FinancialValueState; movement: FinancialValueState; reserveCoverageMonths?: number; reserveTargetConfigured: boolean; explanation: string; confidence: FinancialConfidence }>;
export type FinancialChangeSummary = Readonly<{
  id: string; category: "revenue" | "expenses" | "noi" | "margin" | "cash" | "budget-variance" | "property-contribution" | "data-quality";
  direction: "improved" | "declined" | "stable" | "new" | "removed" | "reclassified" | "uncertain";
  title: string; description: string; amount?: Money; percentageChange?: number; percentagePointChange?: number;
  affectedPropertyIds: readonly string[]; accountIds: readonly string[];
  classification: "economic-change" | "scope-change" | "reclassification" | "data-change";
  confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type FinancialDriver = Readonly<{ id: string; label: string; amount: Money; share?: number; change?: Money; qualification: FinancialValueQualification; confidence: FinancialConfidence }>;
export type FinancialDriverSummary = Readonly<{ revenue: readonly FinancialDriver[]; expenses: readonly FinancialDriver[] }>;
export type FinancialPropertyContribution = Readonly<{ propertyId: string; label: string; revenue: Money; noi: Money | null; noiShare?: number; expenseCoverage: number; confidence: FinancialConfidence }>;
export type FinancialObligation = Readonly<{ id: string; description: string; amount: Money; dueDate: string; propertyId?: string; scopeLabel: string; status: "upcoming" | "due-soon" | "due" | "overdue" | "paid" | "unknown"; evidenceIds: readonly string[]; confidence: FinancialConfidence }>;
export type FinancialPlanVariancePreview = Readonly<{ available: boolean; kind?: "budget" | "forecast"; status: "available" | "unavailable" | "incompatible-basis"; lines: readonly Readonly<{ metric: "revenue" | "expenses" | "noi" | "cash"; actual: Money; plan: Money; variance: Money; favorable: boolean }>[]; explanation: string }>;
export type FinancialAttentionItem = Readonly<{ id: string; type: "profitability-decline" | "expense-increase" | "cash-pressure" | "reserve-pressure" | "budget-variance" | "upcoming-obligation" | "uncategorized-transactions" | "data-limitation" | "stale-source" | "currency-mismatch" | "accounting-basis-mismatch"; title: string; description: string; whyItMatters: string; impact?: Money; confidence: FinancialConfidence; evidenceIds: readonly string[]; destination?: string }>;
export type FinancialExecutionSummary = Readonly<{ activeDecisions: number; openActions: number; committedCapital?: Money; spentCapital?: Money; items: readonly Readonly<{ id: string; title: string; kind: "decision" | "action"; status: string; destination: string }>[] }>;
export type FinancialEvidenceSummary = Readonly<{ revenueCoverage: number; expenseCoverage: number; cashCoverage: number; propertyCoverage: number; accountCoverage: number; categorizationCoverage: number; uncategorizedTransactionCount: number; reconciliation: "reconciled" | "partially-reconciled" | "unreconciled" | "not-applicable" | "unknown"; historyMonths: number; gaps: readonly string[]; oldestSourceUpdate?: string }>;
export type FinancialPerformanceTrendPoint = Readonly<{ date: string; revenue: number; expenses: number; noi: number }>;
export type FinancialOverviewState = "ready" | "empty" | "partial" | "degraded" | "permission-limited";

export type FinancialOverview = Readonly<{
  identity: FinancialReadModel["identity"]; scope: FinancialOverviewScope; period: FinancialPeriod;
  comparison?: Readonly<{ type: "previous-period" | "previous-year" | "budget" | "forecast"; available: boolean; limitation?: string }>;
  accountingBasis: AccountingMethod; reportingCurrency: string; condition: FinancialCondition;
  metrics: readonly FinancialMetricSummary[]; profitability: ProfitabilitySummary; liquidity: LiquiditySummary;
  changes: readonly FinancialChangeSummary[]; drivers: FinancialDriverSummary;
  propertyContribution: readonly FinancialPropertyContribution[]; obligations: Readonly<{ sourceAvailable: boolean; items: readonly FinancialObligation[] }>;
  planning: FinancialPlanVariancePreview; attention: readonly FinancialAttentionItem[];
  execution: FinancialExecutionSummary; evidence: FinancialEvidenceSummary;
  performanceTrend: readonly FinancialPerformanceTrendPoint[];
  confidence: FinancialConfidence; freshness: FinancialFreshness; evaluatedAt: string;
  projectionVersion: string; state: FinancialOverviewState; permissionLimited: boolean;
}>;

export type FinancialCashSource = Readonly<{ balance: Money; netMovement: Money; asOf: string; qualification: Exclude<FinancialValueQualification, "unavailable" | "mixed">; confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[]; reserveTarget?: Money; internalTransfersEliminated: boolean }>;
export type FinancialPlanSource = Readonly<{ kind: "budget" | "forecast"; accountingBasis: AccountingMethod; values: Partial<Record<"revenue" | "expenses" | "noi" | "cash", Money>> }>;
export type FinancialOverviewBuildInput = Readonly<{
  current: FinancialReadModel; comparison?: FinancialReadModel; comparisonType?: "previous-period" | "previous-year" | "budget" | "forecast";
  scope: FinancialOverviewScope; propertySnapshots?: readonly Readonly<{ propertyId: string; label: string; snapshot: FinancialSnapshot }>[];
  cash?: FinancialCashSource; plan?: FinancialPlanSource; obligations?: Readonly<{ sourceAvailable: boolean; items: readonly FinancialObligation[] }>;
  execution?: FinancialExecutionSummary; canViewCash: boolean; canViewDetail: boolean; permissionLimited?: boolean;
  projectionVersion?: string;
}>;

export interface FinancialOverviewReader { read(input: GetFinancialOverviewQuery): Promise<FinancialOverviewBuildInput>; }
export type GetFinancialOverviewQuery = Readonly<{ workspaceId: string; propertyIds?: readonly string[]; portfolioId?: string; period: FinancialPeriod; comparisonType: "previous-period" | "previous-year" | "budget" | "forecast" | "none"; accountingBasis?: AccountingMethod; reportingCurrency?: string; evaluatedAt?: string }>;
export interface FinancialOverviewCache { get(key: string): Promise<FinancialOverview | null>; put(key: string, value: FinancialOverview): Promise<void>; invalidate(input: Readonly<{ workspaceId: string; from?: string; reason: "backdated-entry" | "reclassification" | "source-sync" | "plan-update" | "permission-change" }>): Promise<void>; }

import type { Money } from "@/platform/kernel";
import type {
  AccountingMethod, FinancialConfidence, FinancialFreshness, FinancialPeriod, FinancialReadModel,
} from "../../domain";
import type { FinancialOverviewScope, FinancialValueQualification } from "../overview";

export type ProfitabilityAvailability = "available" | "partial" | "restricted" | "unavailable";
export type VarianceDirection = "positive" | "negative" | "neutral" | "unavailable";
export type ProfitabilityTrendClassification = "improving" | "stable" | "declining" | "mixed" | "insufficient-evidence";
export type MarginHealth = "strong" | "healthy" | "moderate" | "weak" | "negative" | "unavailable";

export type IncomeStatementLine = Readonly<{
  id: string; label: string; amount: Money | null; qualification: FinancialValueQualification;
  availability: ProfitabilityAvailability; confidence: FinancialConfidence; freshness: FinancialFreshness;
  evidenceIds: readonly string[];
}>;
export type FinancialCategorySummary = IncomeStatementLine & Readonly<{
  category: string; share: number | null; transactionCount?: number;
}>;
export type RevenueSummary = Readonly<{ total: IncomeStatementLine; categories: readonly FinancialCategorySummary[] }>;
export type ExpenseSummary = Readonly<{
  total: IncomeStatementLine; costOfRevenue: IncomeStatementLine | null;
  operatingExpenses: IncomeStatementLine; categories: readonly FinancialCategorySummary[];
  uncategorized: Money; categorizationCoverage: number;
}>;
export type CanonicalProfitabilitySummary = Readonly<{
  revenue: Money | null; expenses: Money | null; grossProfit: Money | null; grossMargin: number | null;
  noi: Money | null; operatingMargin: number | null; marginHealth: MarginHealth;
  confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type PropertyProfitability = Readonly<{
  propertyId: string; label: string; market?: string; operatingModel?: string;
  revenue: Money; expenses: Money | null; noi: Money | null; margin: number | null;
  revenueContribution: number | null; expenseContribution: number | null; noiContribution: number | null;
  trend: ProfitabilityTrendClassification; variance: Money | null; evidenceCoverage: number;
  confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type ProfitabilityTrend = Readonly<{
  metric: "revenue" | "expenses" | "noi" | "operating-margin";
  current: Money | number | null; comparison: Money | number | null; variance: Money | number | null;
  varianceDirection: VarianceDirection; percentageChange: number | null;
  classification: ProfitabilityTrendClassification; confidence: FinancialConfidence;
}>;
export type ProfitabilityDriver = Readonly<{
  id: string; kind: "revenue" | "expense"; label: string; amount: Money; variance: Money | null;
  contribution: number | null; classification: "largest-contributor" | "largest-improvement" | "largest-decline" | "uncategorized";
  confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type ProfitabilityDimensionSummary = Readonly<{ label: string; propertyIds: readonly string[]; revenue: Money; expenses: Money | null; noi: Money | null; margin: number | null; confidence: FinancialConfidence }>;
export type ProfitabilityEvidence = Readonly<{
  revenueCoverage: number; expenseCoverage: number; propertyCoverage: number; categorizationCoverage: number;
  historyMonths: number; gaps: readonly string[]; confidence: FinancialConfidence; freshness: FinancialFreshness;
}>;
export type IncomeStatementState = "ready" | "empty" | "partial" | "degraded" | "permission-limited";
export type IncomeStatement = Readonly<{
  identity: FinancialReadModel["identity"]; scope: FinancialOverviewScope; period: FinancialPeriod;
  comparison?: Readonly<{ type: "previous-period" | "previous-year"; available: boolean; limitation?: string }>;
  accountingBasis: AccountingMethod; reportingCurrency: string;
  revenue: RevenueSummary; expenses: ExpenseSummary; profitability: CanonicalProfitabilitySummary;
  properties: readonly PropertyProfitability[]; rankings: Readonly<{
    highestNoi: readonly PropertyProfitability[]; highestMargin: readonly PropertyProfitability[];
    largestRevenue: readonly PropertyProfitability[]; largestExpense: readonly PropertyProfitability[];
    largestImprovement: readonly PropertyProfitability[]; largestDecline: readonly PropertyProfitability[];
  }>;
  dimensions: Readonly<{ markets: readonly ProfitabilityDimensionSummary[]; operatingModels: readonly ProfitabilityDimensionSummary[] }>;
  trends: readonly ProfitabilityTrend[]; drivers: Readonly<{ revenue: readonly ProfitabilityDriver[]; expenses: readonly ProfitabilityDriver[] }>;
  materialChanges: readonly ProfitabilityDriver[]; evidence: ProfitabilityEvidence;
  confidence: FinancialConfidence; freshness: FinancialFreshness; state: IncomeStatementState;
  permissionLimited: boolean; evaluatedAt: string; projectionVersion: string;
}>;

export type IncomeStatementPropertyContext = Readonly<{ propertyId: string; label: string; market?: string; operatingModel?: string }>;
export type BuildIncomeStatementInput = Readonly<{
  current: FinancialReadModel; comparison?: FinancialReadModel; comparisonType?: "previous-period" | "previous-year";
  scope: FinancialOverviewScope; properties: readonly IncomeStatementPropertyContext[];
  canViewRevenueDetail: boolean; canViewExpenseDetail: boolean; permissionLimited?: boolean; projectionVersion?: string;
}>;
export type GetIncomeStatementQuery = Readonly<{
  workspaceId: string; propertyIds?: readonly string[]; portfolioId?: string; period: FinancialPeriod;
  comparisonType: "previous-period" | "previous-year" | "none"; evaluatedAt?: string;
}>;
export interface IncomeStatementReader { read(query: GetIncomeStatementQuery): Promise<BuildIncomeStatementInput>; }
export interface IncomeStatementCache {
  get(key: string): Promise<IncomeStatement | null>; put(key: string, value: IncomeStatement): Promise<void>;
  invalidate(input: Readonly<{ workspaceId: string; from?: string; reason: "backdated-entry" | "reclassification" | "source-sync" | "permission-change" }>): Promise<void>;
}

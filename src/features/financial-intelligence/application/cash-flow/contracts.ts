import type { Money } from "@/platform/kernel";
import type { FinancialConfidence, FinancialFreshness, FinancialPeriod, FinancialReadModel } from "../../domain";
import type { FinancialOverviewScope, FinancialValueQualification } from "../overview";

export type CashAccountType = "operating" | "reserve" | "tax" | "capital" | "security-deposit" | "debt-service" | "owner" | "escrow" | "other";
export type CashRestriction = "available" | "legally-restricted" | "contractually-restricted" | "reserved" | "committed" | "unknown";
export type CashAccountStatus = "current" | "stale" | "disconnected" | "unreconciled" | "restricted" | "unknown";
export type CashReconciliationStatus = "reconciled" | "partially-reconciled" | "unreconciled" | "not-applicable" | "unknown";
export type CashActivity = "operating" | "investing" | "financing" | "other";
export type CashEconomicClassification = "economic-inflow" | "economic-outflow" | "internal-transfer" | "reclassification" | "adjustment" | "unknown";

export type CashAccountBalance = Readonly<{
  id: string; workspaceId: string; propertyId?: string; label: string; type: CashAccountType;
  sourceLabel?: string; currency: string; openingBalance?: Money; closingBalance?: Money;
  restriction: CashRestriction; restrictedAmount?: Money; committedAmount?: Money;
  restrictionsComplete: boolean; openingAsOf?: string; closingAsOf?: string;
  status: CashAccountStatus; reconciliation: CashReconciliationStatus;
  confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type CashMovement = Readonly<{
  id: string; workspaceId: string; accountId: string; propertyId?: string;
  amount: Money; direction: "inflow" | "outflow"; activity: CashActivity;
  classification: CashEconomicClassification; category: string; occurredAt: string;
  transferReference?: string; matchedAccountId?: string; recurring: "recurring" | "nonrecurring" | "unknown";
  allocated: boolean; qualification: Exclude<FinancialValueQualification, "unavailable" | "mixed">;
  confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type CashObligation = Readonly<{
  id: string; description: string; category: "operating-expense" | "rent" | "debt-service" | "insurance" | "tax" | "payroll-contractor" | "vendor" | "subscription" | "capital-commitment" | "owner-distribution" | "other";
  amount: Money; dueDate: string; status: "upcoming" | "due-soon" | "due-today" | "overdue" | "scheduled" | "paid" | "cancelled" | "unknown";
  propertyId?: string; scopeLabel: string; recurrence: "one-time" | "recurring" | "unknown"; fundingAccountId?: string;
  confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type ReservePolicy = Readonly<{
  id: string; type: "operating" | "maintenance" | "capital" | "tax" | "insurance" | "debt-service";
  scope: "workspace" | "property"; propertyId?: string; target: Money; lookbackMonths: number;
  includesNonrecurringCapital: boolean; evidenceIds: readonly string[];
}>;
export type ScheduledCash = Readonly<{ inflows?: Money; outflows?: Money; horizonDays: 7 | 30 | 60 | 90; qualification: FinancialValueQualification; assumptions: readonly string[]; evidenceIds: readonly string[] }>;

export type CashPositionSummary = Readonly<{
  openingCash: Money | null; closingCash: Money | null; totalCash: Money | null;
  availableCash: Money | null; restrictedCash: Money | null; committedCash: Money | null;
  netCashMovement: Money | null; asOf?: string; confidence: FinancialConfidence;
  freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type CashFlowLine = Readonly<{
  id: string; category: string; label: string; amount: Money; direction: "inflow" | "outflow" | "net";
  classification: CashEconomicClassification; qualification: FinancialValueQualification;
  comparison?: Money; confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type CashFlowSection = Readonly<{ activity: CashActivity; inflows: Money; outflows: Money; net: Money; lines: readonly CashFlowLine[] }>;
export type CashReconciliationResult = Readonly<{
  status: CashReconciliationStatus; openingCash: Money | null; classifiedMovement: Money;
  closingCash: Money | null; unmatchedAmount: Money | null; toleranceMinorUnits: number; explanation: string;
}>;
export type CashFlowStatement = Readonly<{
  operatingActivities: CashFlowSection; investingActivities: CashFlowSection;
  financingActivities: CashFlowSection; otherAdjustments: CashFlowSection;
  netCashMovement: Money; openingCash: Money | null; closingCash: Money | null;
  internalTransfersEliminated: number; unmatchedTransfers: readonly CashMovement[];
  reconciliation: CashReconciliationResult; confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type CashAccountSummary = Readonly<{
  id: string; label: string; type: CashAccountType; balance: Money | null; availableBalance: Money | null;
  restriction: CashRestriction; status: CashAccountStatus; reconciliation: CashReconciliationStatus;
  currency: string; propertyId?: string; asOf?: string; confidence: FinancialConfidence; freshness: FinancialFreshness;
}>;
export type CashMovementDriver = Readonly<{
  id: string; label: string; amount: Money; direction: "inflow" | "outflow"; activity: CashActivity;
  classification: CashEconomicClassification; recurring: CashMovement["recurring"]; propertyIds: readonly string[];
  confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type PropertyCashContribution = Readonly<{
  propertyId: string; label: string; operatingInflows: Money; operatingOutflows: Money;
  operatingCashFlow: Money; investingCashFlow: Money; financingCashFlow: Money; netCashContribution: Money;
  confidence: FinancialConfidence; freshness: FinancialFreshness; evidenceIds: readonly string[];
}>;
export type FinancialObligationSummary = Readonly<{
  sourceAvailable: boolean; coverage: number; horizonDays: 7 | 30 | 60 | 90; items: readonly CashObligation[];
  totalKnown: Money | null; availableCashCoverage: number | null; fundingGap: Money | null;
  confidence: FinancialConfidence;
}>;
export type ReserveCoverageItem = Readonly<{
  policyId: string; type: ReservePolicy["type"]; currentBalance: Money | null; target: Money;
  gap: Money | null; coveragePercentage: number | null; monthsOfCoverage: number | null;
  status: "above-target" | "at-target" | "below-target" | "critical" | "not-configured" | "insufficient-evidence";
  lookbackMonths: number; confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type ReserveCoverageSummary = Readonly<{ configured: boolean; items: readonly ReserveCoverageItem[]; overallStatus: ReserveCoverageItem["status"] }>;
export type CashBurnRateSummary = Readonly<{
  grossCashBurn: Money | null; netCashBurn: Money | null; operatingCashBurn: Money | null;
  basis: "average-qualifying-outflows" | "negative-net-movement" | "negative-operating-cash-flow";
  lookbackMonths: number; exclusions: readonly string[]; applicable: boolean; explanation: string; confidence: FinancialConfidence;
}>;
export type CashRunwaySummary = Readonly<{
  months: number | null; status: "available" | "not-applicable" | "insufficient-evidence";
  basis: string; assumptions: readonly string[]; exclusions: readonly string[]; confidence: FinancialConfidence;
}>;
export type LiquidityOutlook = Readonly<{
  horizonDays: 7 | 30 | 60 | 90; openingAvailableCash: Money | null; scheduledInflows: Money | null;
  scheduledOutflows: Money | null; projectedClosingAvailableCash: Money | null; fundingGap: Money | null;
  status: "surplus-expected" | "balanced" | "pressure-expected" | "funding-gap-expected" | "insufficient-evidence";
  qualification: FinancialValueQualification; assumptions: readonly string[]; confidence: FinancialConfidence; evidenceIds: readonly string[];
}>;
export type LiquidityCondition = Readonly<{
  status: "strong" | "adequate" | "tight" | "critical" | "insufficient-evidence";
  summary: string; positiveDrivers: readonly string[]; limitingConditions: readonly string[];
  confidence: FinancialConfidence; evidenceIds: readonly string[]; policyVersion: string;
}>;
export type CashFlowTrend = Readonly<{
  metric: "opening-cash" | "closing-cash" | "operating-cash-flow" | "investing-cash-flow" | "financing-cash-flow" | "net-cash-movement" | "available-cash";
  current: Money | null; comparison: Money | null; variance: Money | null;
  classification: "improving" | "stable" | "declining" | "volatile" | "mixed" | "insufficient-evidence";
  confidence: FinancialConfidence;
}>;
export type LiquidityAttentionItem = Readonly<{
  id: string; type: "low-available-cash" | "negative-operating-cash-flow" | "reserve-gap" | "upcoming-funding-gap" | "large-nonrecurring-outflow" | "overdue-obligation" | "unreconciled-cash" | "stale-account" | "restricted-cash-dependence" | "cash-concentration" | "unmatched-transfer" | "currency-mismatch" | "missing-obligation-coverage";
  subject: string; condition: string; whyItMatters: string; amount?: Money; ratio?: number;
  horizonDays?: number; propertyId?: string; accountId?: string; confidence: FinancialConfidence;
  evidenceIds: readonly string[]; destination?: string;
}>;
export type CashFlowEvidenceSummary = Readonly<{
  accountCoverage: number; balanceCoverage: number; transactionCoverage: number; transferMatchCoverage: number;
  obligationCoverage: number; reserveClassificationCoverage: number; propertyAttribution: number;
  reconciliation: CashReconciliationStatus; historyMonths: number; currencyCompatible: boolean;
  limitingSource?: string; gaps: readonly string[]; confidence: FinancialConfidence; freshness: FinancialFreshness;
}>;
export type CashFlowState = "ready" | "empty" | "balances-only" | "transactions-only" | "partial" | "degraded" | "permission-limited" | "unreconciled";

export type CashFlowLiquidityView = Readonly<{
  identity: FinancialReadModel["identity"]; scope: FinancialOverviewScope; period: FinancialPeriod;
  comparison?: Readonly<{ type: "previous-period" | "previous-year" | "forecast"; available: boolean; limitation?: string }>;
  reportingCurrency: string; condition: LiquidityCondition; position: CashPositionSummary; statement: CashFlowStatement;
  drivers: Readonly<{ inflows: readonly CashMovementDriver[]; outflows: readonly CashMovementDriver[]; nonrecurring: readonly CashMovementDriver[]; unmatched: readonly CashMovementDriver[] }>;
  accounts: readonly CashAccountSummary[]; propertyContribution: readonly PropertyCashContribution[];
  unallocatedCashActivity: Money; obligations: FinancialObligationSummary; reserves: ReserveCoverageSummary;
  burnRate: CashBurnRateSummary; runway: CashRunwaySummary; outlook: LiquidityOutlook;
  trends: readonly CashFlowTrend[]; attention: readonly LiquidityAttentionItem[];
  evidence: CashFlowEvidenceSummary; confidence: FinancialConfidence; freshness: FinancialFreshness;
  evaluatedAt: string; projectionVersion: string; state: CashFlowState; permissionLimited: boolean;
}>;

export type BuildCashFlowLiquidityInput = Readonly<{
  financial: FinancialReadModel; comparisonFinancial?: FinancialReadModel; scope: FinancialOverviewScope;
  accounts: readonly CashAccountBalance[]; movements: readonly CashMovement[];
  comparisonAccounts?: readonly CashAccountBalance[]; comparisonMovements?: readonly CashMovement[];
  propertyLabels: Readonly<Record<string, string>>; obligations: Readonly<{ sourceAvailable: boolean; coverage: number; items: readonly CashObligation[] }>;
  reservePolicies: readonly ReservePolicy[]; scheduledCash?: ScheduledCash; historyMonths: number;
  comparisonType?: "previous-period" | "previous-year" | "forecast"; obligationHorizonDays?: 7 | 30 | 60 | 90;
  canViewAccounts: boolean; canViewTransactions: boolean; canViewObligations: boolean; canViewReserves: boolean;
  permissionLimited?: boolean; evaluatedAt?: string; projectionVersion?: string;
}>;
export type GetCashFlowLiquidityQuery = Readonly<{
  workspaceId: string; propertyIds?: readonly string[]; accountIds?: readonly string[]; portfolioId?: string;
  period: FinancialPeriod; comparisonType: "previous-period" | "previous-year" | "forecast" | "none";
  obligationHorizonDays?: 7 | 30 | 60 | 90; evaluatedAt?: string;
}>;
export interface CashFlowLiquidityReader { read(query: GetCashFlowLiquidityQuery): Promise<BuildCashFlowLiquidityInput>; }
export interface CashFlowLiquidityCache {
  get(key: string): Promise<CashFlowLiquidityView | null>; put(key: string, value: CashFlowLiquidityView): Promise<void>;
  invalidate(input: Readonly<{ workspaceId: string; from?: string; reason: "account-balance" | "transaction-import" | "reclassification" | "transfer-rematch" | "obligation" | "reserve-policy" | "permission" | "account-access" | "backdated-entry" | "currency-conversion" | "reconciliation" }>): Promise<void>;
}

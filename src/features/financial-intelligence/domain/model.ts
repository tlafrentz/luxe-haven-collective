import { Money } from "@/platform/kernel";

export type AccountingMethod = "cash" | "accrual";
export type FinancialBasis = "actual" | "forecast" | "scenario" | "budget" | "target";
/** @deprecated Transport compatibility for observations created before BI-001. */
export type FinancialMeasurement = FinancialBasis | "measured" | "projected" | "estimated";
export type FinancialFreshness = "current" | "partial" | "stale" | "unknown";
export type FinancialConfidence = "high" | "moderate" | "low" | "insufficient-evidence";
export type FinancialAccountCategory =
  | "revenue" | "cost-of-revenue" | "operating-expense" | "capital-expense"
  | "asset" | "liability" | "equity" | "reserve";
export type FinancialPeriodKind = "day" | "week" | "month" | "quarter" | "year" | "custom";

export type FinancialPeriod = Readonly<{
  kind: FinancialPeriodKind;
  from: string;
  to: string;
  comparison?: Readonly<{ from: string; to: string }>;
  reportingCalendar: "calendar" | "fiscal";
}>;

export function assertFinancialPeriod(period: FinancialPeriod): void {
  const valid = (from: string, to: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    !Number.isNaN(Date.parse(`${from}T00:00:00Z`)) && !Number.isNaN(Date.parse(`${to}T00:00:00Z`)) && from <= to;
  if (!valid(period.from, period.to)) throw new FinancialDomainError("INVALID_PERIOD", "Financial period must be a valid inclusive date range.");
  if (period.comparison && !valid(period.comparison.from, period.comparison.to)) {
    throw new FinancialDomainError("INVALID_PERIOD", "Financial comparison period must be a valid inclusive date range.");
  }
}

export type FinancialIdentity = Readonly<{
  workspaceId: string;
  organizationId: string;
  reportingCurrency: string;
  fiscalYearStartMonth: number;
  timezone: string;
  reportingStandards: readonly string[];
  accountingMethod: AccountingMethod;
}>;

export type FinancialAccount = Readonly<{
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  category: FinancialAccountCategory;
  subcategory?: string;
  parentAccountId?: string;
  active: boolean;
}>;

export type FinancialTransactionStatus = "pending" | "posted" | "voided";
export type FinancialTransactionProps = Readonly<{
  id: string;
  accountId: string;
  workspaceId: string;
  propertyId?: string;
  amount: Money;
  category: string;
  measurement: FinancialMeasurement;
  effectiveDate: string;
  postingDate?: string;
  source: Readonly<{ provider: string; externalId?: string }>;
  status: FinancialTransactionStatus;
  evidenceIds: readonly string[];
}>;

export type FinancialObservationType = "revenue"|"expense"|"capital"|"debt"|"cash"|"variance"|"reserve";
export type FinancialObservation = Readonly<{
  id:string;workspaceId:string;propertyId?:string;type:FinancialObservationType;basis:FinancialBasis;
  category:string;amount:Money;period:Readonly<{from:string;to:string}>;currency:string;
  confidence:FinancialConfidence;source:Readonly<{provider:string;externalId?:string}>;
  evidenceIds:readonly string[];recordedAt:string;
}>;
export type FinancialValueAvailability<T> =
  | Readonly<{status:"available";value:T;observationIds:readonly string[]}>
  | Readonly<{status:"unavailable";reason:string;observationIds:readonly[]}>;

export class FinancialTransaction {
  private constructor(private readonly value: FinancialTransactionProps) { Object.freeze(this); }
  static create(props: FinancialTransactionProps): FinancialTransaction {
    if (!props.id || !props.accountId || !props.workspaceId) throw new FinancialDomainError("INVALID_TRANSACTION", "Transaction identity and scope are required.");
    if (props.status === "posted" && !props.postingDate) throw new FinancialDomainError("INVALID_TRANSACTION", "Posted transactions require a posting date.");
    return new FinancialTransaction(Object.freeze({ ...props, evidenceIds: Object.freeze([...props.evidenceIds]), source: Object.freeze({ ...props.source }) }));
  }
  get props(): FinancialTransactionProps { return this.value; }
  post(postingDate: string): FinancialTransaction {
    if (this.value.status === "posted") throw new FinancialDomainError("POSTED_TRANSACTION_IMMUTABLE", "Posted transactions are immutable.");
    return FinancialTransaction.create({ ...this.value, status: "posted", postingDate });
  }
  revise(changes: Partial<Omit<FinancialTransactionProps, "id" | "workspaceId">>): FinancialTransaction {
    if (this.value.status === "posted") throw new FinancialDomainError("POSTED_TRANSACTION_IMMUTABLE", "Posted transactions are immutable.");
    return FinancialTransaction.create({ ...this.value, ...changes });
  }
}

export type FinancialEvidence = Readonly<{
  transactionCoverage: number;
  expenseCoverage: number;
  revenueCoverage: number;
  providerCoverage: number;
  manualAdjustments: number;
  historyMonths: number;
  sourceIds: readonly string[];
  gaps: readonly string[];
}>;

export const financialExpenseCategories = [
  "platform-fees", "merchant-fees",
  "mortgage", "lease", "insurance", "property-tax", "hoa", "software", "internet", "licensing", "subscriptions",
  "cleaning", "utilities", "supplies", "laundry", "guest-amenities", "maintenance", "repairs", "consumables",
  "management-fees", "co-host-fees", "accounting", "virtual-assistant", "operations", "legal", "marketing", "education", "professional-services",
  "furniture", "equipment", "renovations", "replacement-reserve", "capital-improvements",
] as const;
export type FinancialExpenseCategory = typeof financialExpenseCategories[number];
export type FinancialExpenseGroup = "fixed" | "variable" | "management" | "capital";

export type FinancialMetricLineage = Readonly<{
  metric: string;
  formula: string;
  inputTransactionIds: readonly string[];
  evidenceIds: readonly string[];
  sourceProviders: readonly string[];
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
  calculatedAt: string;
  calculationVersion: string;
}>;

export type FinancialExpenseSummary = Readonly<{
  category: FinancialExpenseCategory;
  group: FinancialExpenseGroup;
  amount: Money;
  measurements: Readonly<Partial<Record<FinancialMeasurement, Money>>>;
  transactionIds: readonly string[];
  evidenceIds: readonly string[];
  confidence: FinancialConfidence;
}>;

export type FinancialVariance = Readonly<{
  metric: "revenue" | "expenses" | "noi" | "cash-flow" | "margin" | "capital";
  basis: Exclude<FinancialBasis, "actual">;
  actual: Money;
  projected: Money;
  magnitude: Money;
  percentage?: number;
  direction: "favorable" | "unfavorable" | "on-plan";
  reason: string;
  confidence: FinancialConfidence;
  evidenceIds: readonly string[];
}>;

export type FinancialHealthComponent = Readonly<{
  key: "liquidity" | "profitability" | "expense" | "revenue" | "capital";
  score: number | null;
  status: "healthy" | "watch" | "critical" | "insufficient-evidence";
  evidenceIds: readonly string[];
}>;
export type FinancialHealth = Readonly<{
  score: number | null;
  confidence: FinancialConfidence;
  breakdown: readonly FinancialHealthComponent[];
}>;
export type FinancialRisk = Readonly<{
  code: "expense-growth" | "revenue-decline" | "negative-cash-flow" | "capital-shortfall" | "large-variance" | "low-confidence" | "seasonality";
  severity: "critical" | "high" | "medium" | "low";
  likelihood: "high" | "moderate" | "low";
  summary: string;
  mitigation: string;
  evidenceIds: readonly string[];
}>;

export type FinancialSnapshot = Readonly<{
  id: string;
  snapshotVersion: number;
  schemaVersion: "financial-snapshot.v1";
  basis: FinancialBasis;
  workspaceId: string;
  portfolioId?: string;
  propertyId?: string;
  period: FinancialPeriod;
  revenue: Money | null;
  expenses: Money | null;
  assets: Money | null;
  liabilities: Money | null;
  equity: Money | null;
  valuesByMeasurement: Readonly<Record<FinancialMeasurement, Readonly<{ revenue: Money; expenses: Money }>>>;
  valuesByBasis: Readonly<Record<FinancialBasis,Readonly<{
    revenue:FinancialValueAvailability<Money>;expenses:FinancialValueAvailability<Money>;
  }>>>;
  expenseBreakdown: readonly FinancialExpenseSummary[];
  profitability: Readonly<{
    grossRevenue: Money|null; operatingExpenses: Money|null; grossProfit:Money|null; noi: Money|null; ebitda: Money|null;
    operatingMargin: number|null; netCashFlow: Money|null; cashPosition: Money|null;
    expenseRatio: number|null; revenueEfficiency: number|null;
  }>;
  capital: Readonly<{
    initialInvestment: Money|null; workingCapital:Money|null; capitalExpenses: Money|null; capitalReserve: Money|null;
    replacementReserve:Money|null;remainingCapital: Money|null;
  }>;
  variances: readonly FinancialVariance[];
  health: FinancialHealth;
  risks: readonly FinancialRisk[];
  lineage: Readonly<Record<string, FinancialMetricLineage>>;
  evidence: FinancialEvidence;
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
  evaluatedAt: string;
  capturedAt: string;
}>;

export type Ledger = Readonly<{
  workspaceId: string;
  period: FinancialPeriod;
  accounts: readonly FinancialAccount[];
  transactions: readonly FinancialTransaction[];
}>;

export type Budget = Readonly<{ id: string; workspaceId: string; period: FinancialPeriod; lines: readonly Readonly<{ accountId: string; amount: Money }>[]; version: number }>;
export type Forecast = Readonly<{ id: string; workspaceId: string; period: FinancialPeriod; lines: readonly Readonly<{ accountId: string; amount: Money }>[]; version: number }>;
export type FinancialProjection = Readonly<{ period: FinancialPeriod; measurement: Exclude<FinancialMeasurement, "measured">; amount: Money; evidenceIds: readonly string[] }>;
export type FinancialWorkspace = Readonly<{ identity: FinancialIdentity; portfolioIds: readonly string[] }>;
export type FinancialPortfolio = Readonly<{ id: string; workspaceId: string; propertyIds: readonly string[] }>;
export type FinancialProperty = Readonly<{ id: string; workspaceId: string; portfolioId?: string }>;

export type FinancialReadModel = Readonly<{
  identity: FinancialIdentity;
  period: FinancialPeriod;
  ledger: Ledger;
  accounts: readonly FinancialAccount[];
  transactions: readonly FinancialTransaction[];
  snapshot: FinancialSnapshot;
  evidence: FinancialEvidence;
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
  evaluatedAt: string;
}>;

export class FinancialDomainError extends Error {
  constructor(readonly code: "INVALID_PERIOD" | "INVALID_TRANSACTION" | "POSTED_TRANSACTION_IMMUTABLE" | "CURRENCY_MISMATCH", message: string) {
    super(message); this.name = "FinancialDomainError";
  }
}

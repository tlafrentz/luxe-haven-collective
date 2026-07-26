import { Money } from "@/platform/kernel";

export type AccountingMethod = "cash" | "accrual";
export type FinancialMeasurement = "measured" | "projected" | "forecast" | "estimated";
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

export type FinancialSnapshot = Readonly<{
  workspaceId: string;
  portfolioId?: string;
  propertyId?: string;
  period: FinancialPeriod;
  revenue: Money;
  expenses: Money;
  assets: Money;
  liabilities: Money;
  equity: Money;
  valuesByMeasurement: Readonly<Record<FinancialMeasurement, Readonly<{ revenue: Money; expenses: Money }>>>;
  evidence: FinancialEvidence;
  confidence: FinancialConfidence;
  freshness: FinancialFreshness;
  evaluatedAt: string;
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
export type FinancialObservation = Readonly<{ id: string; workspaceId: string; propertyId?: string; period: FinancialPeriod; measurement: FinancialMeasurement; amount: Money; evidenceIds: readonly string[] }>;
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

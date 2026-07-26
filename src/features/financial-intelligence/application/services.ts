import { evaluatePropertyAccess, evaluateWorkspacePermission } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import type {
  FinancialAccountCategory, FinancialConfidence, FinancialEvidence,
  FinancialFreshness, FinancialMeasurement, FinancialReadModel, FinancialSnapshot, Ledger,
} from "../domain";
import { assertFinancialPeriod } from "../domain";
import type {
  FinancialBuildContext, FinancialEvidenceResult, FinancialObservability, FinancialReadModelRepository,
  FinancialSource, GetFinancialSnapshotQuery,
} from "./contracts";

const permissions = {
  read: "financial.read", detail: "financial.detail",
  planning: "financial.planning", administration: "financial.administration",
} as const;

export class FinancialReadError extends Error {
  constructor(readonly code: "ANONYMOUS_DENIED" | "CROSS_WORKSPACE_DENIED" | "FINANCIAL_ACCESS_DENIED" | "PROPERTY_ACCESS_DENIED" | "IDENTITY_NOT_FOUND" | "SOURCE_SCOPE_VIOLATION" | "CURRENCY_MISMATCH", message: string) {
    super(message); this.name = "FinancialReadError";
  }
}

export function authorizeFinancialRead(query: GetFinancialSnapshotQuery): void {
  const access = query.access;
  if (!access) throw new FinancialReadError("ANONYMOUS_DENIED", "Authentication is required to read financial information.");
  if (access.workspaceId !== query.workspaceId) throw new FinancialReadError("CROSS_WORKSPACE_DENIED", "Financial access cannot cross workspace boundaries.");
  if (!evaluateWorkspacePermission(access, permissions[query.authorizationLevel ?? "read"])) {
    throw new FinancialReadError("FINANCIAL_ACCESS_DENIED", "The requested financial capability is not permitted.");
  }
  if (query.propertyId && !evaluatePropertyAccess(access, query.propertyId)) {
    throw new FinancialReadError("PROPERTY_ACCESS_DENIED", "Financial access to this property is not permitted.");
  }
  if (query.propertyIds?.some(propertyId => !evaluatePropertyAccess(access, propertyId))) {
    throw new FinancialReadError("PROPERTY_ACCESS_DENIED", "Financial access to one or more selected properties is not permitted.");
  }
}

export function financialCacheKey(query: GetFinancialSnapshotQuery, reportingCurrency: string): string {
  const comparison = query.period.comparison ? `${query.period.comparison.from}:${query.period.comparison.to}` : "none";
  const scope = query.propertyId ?? (query.propertyIds ? [...query.propertyIds].sort().join(",") : query.portfolioId) ?? "workspace";
  const authorization = `${query.access?.membershipId ?? "anonymous"}:${query.authorizationLevel ?? "read"}:${scope}`;
  return ["financial", query.workspaceId, query.period.from, query.period.to, comparison, authorization, reportingCurrency, query.projectionVersion ?? 0].join("|");
}

export function buildFinancialEvidence(context: FinancialBuildContext): FinancialEvidenceResult {
  const { accounts, transactions, synchronization } = context;
  const posted = transactions.filter(({ props }) => props.status === "posted");
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const revenue = posted.filter(({ props }) => accountById.get(props.accountId)?.category === "revenue");
  const expenses = posted.filter(({ props }) => ["cost-of-revenue", "operating-expense", "capital-expense"].includes(accountById.get(props.accountId)?.category ?? ""));
  const covered = posted.filter(({ props }) => props.evidenceIds.length > 0);
  const ratio = (part: number, total: number) => total ? part / total : 0;
  const providerCoverage = synchronization.expectedProviders ? Math.min(1, synchronization.connectedProviders / synchronization.expectedProviders) : 0;
  const evidence: FinancialEvidence = Object.freeze({
    transactionCoverage: ratio(covered.length, posted.length),
    revenueCoverage: ratio(revenue.filter(({ props }) => props.evidenceIds.length).length, revenue.length),
    expenseCoverage: ratio(expenses.filter(({ props }) => props.evidenceIds.length).length, expenses.length),
    providerCoverage,
    manualAdjustments: posted.filter(({ props }) => props.source.provider === "manual").length,
    historyMonths: synchronization.historyMonths,
    sourceIds: Object.freeze([...new Set(covered.flatMap(({ props }) => props.evidenceIds))]),
    gaps: Object.freeze([
      ...(revenue.length ? [] : ["Revenue data unavailable."]),
      ...(expenses.length ? [] : ["Expense coverage incomplete."]),
      ...(providerCoverage < 1 ? ["Provider coverage incomplete."] : []),
      ...(covered.length < posted.length ? ["Some posted transactions lack evidence."] : []),
    ]),
  });
  const freshness = buildFinancialFreshness(synchronization.lastSuccessfulAt, context.query.evaluatedAt);
  const minimumCoverage = Math.min(evidence.transactionCoverage, evidence.providerCoverage);
  const confidence: FinancialConfidence = !posted.length || !revenue.length
    ? "insufficient-evidence"
    : minimumCoverage >= .9 && evidence.expenseCoverage >= .9 && freshness === "current"
      ? "high"
      : minimumCoverage >= .6 && freshness !== "unknown" ? "moderate" : "low";
  return Object.freeze({ evidence, freshness, confidence });
}

export function buildFinancialFreshness(lastSuccessfulAt: string | undefined, evaluatedAt = new Date().toISOString()): FinancialFreshness {
  if (!lastSuccessfulAt) return "unknown";
  const ageHours = (Date.parse(evaluatedAt) - Date.parse(lastSuccessfulAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) return "unknown";
  if (ageHours <= 24) return "current";
  if (ageHours <= 72) return "partial";
  return "stale";
}

const measurements: readonly FinancialMeasurement[] = ["measured", "projected", "forecast", "estimated"];

export function buildFinancialSnapshot(context: FinancialBuildContext): FinancialSnapshot {
  const currency = context.query.reportingCurrency ?? context.identity.reportingCurrency;
  const accountById = new Map(context.accounts.map((account) => [account.id, account]));
  const posted = context.transactions.filter(({ props }) => props.status === "posted");
  for (const transaction of posted) {
    if (transaction.props.amount.currency !== currency) throw new FinancialReadError("CURRENCY_MISMATCH", "Transactions must be converted to reporting currency before snapshot construction.");
    if (!accountById.has(transaction.props.accountId)) throw new FinancialReadError("SOURCE_SCOPE_VIOLATION", "A transaction references an account outside the canonical ledger.");
  }
  const sum = (selectedCategories: readonly FinancialAccountCategory[], measurement?: FinancialMeasurement) =>
    posted.filter(({ props }) => selectedCategories.includes(accountById.get(props.accountId)!.category) && (!measurement || props.measurement === measurement))
      .reduce((total, { props }) => total.add(props.amount), Money.zero(currency));
  const quality = buildFinancialEvidence(context);
  const valuesByMeasurement = Object.fromEntries(measurements.map((measurement) => [measurement, Object.freeze({
    revenue: sum(["revenue"], measurement),
    expenses: sum(["cost-of-revenue", "operating-expense"], measurement),
  })])) as Record<FinancialMeasurement, Readonly<{ revenue: Money; expenses: Money }>>;
  return Object.freeze({
    workspaceId: context.query.workspaceId, portfolioId: context.query.portfolioId, propertyId: context.query.propertyId,
    period: context.query.period,
    revenue: sum(["revenue"]), expenses: sum(["cost-of-revenue", "operating-expense"]),
    assets: sum(["asset", "reserve"]), liabilities: sum(["liability"]), equity: sum(["equity"]),
    valuesByMeasurement: Object.freeze(valuesByMeasurement),
    evidence: quality.evidence, confidence: quality.confidence, freshness: quality.freshness,
    evaluatedAt: context.query.evaluatedAt ?? new Date().toISOString(),
  });
}

export async function buildFinancialReadModel(source: FinancialSource, query: GetFinancialSnapshotQuery): Promise<FinancialReadModel> {
  assertFinancialPeriod(query.period);
  authorizeFinancialRead(query);
  const identity = await source.getIdentity(query.workspaceId);
  if (!identity) throw new FinancialReadError("IDENTITY_NOT_FOUND", "Financial identity is not configured.");
  const [accounts, transactions, synchronization] = await Promise.all([
    source.listAccounts(query.workspaceId),
    source.listTransactions({ workspaceId: query.workspaceId, period: query.period, portfolioId: query.portfolioId, propertyId: query.propertyId, propertyIds: query.propertyIds }),
    source.getSynchronization(query.workspaceId),
  ]);
  const selected = query.propertyIds ? new Set(query.propertyIds) : undefined;
  if (accounts.some((account) => account.workspaceId !== query.workspaceId) || transactions.some(({ props }) => props.workspaceId !== query.workspaceId || (query.propertyId && props.propertyId !== query.propertyId) || (selected && (!props.propertyId || !selected.has(props.propertyId))))) {
    throw new FinancialReadError("SOURCE_SCOPE_VIOLATION", "A financial source returned data outside the authorized scope.");
  }
  const context = { query, identity, accounts, transactions, synchronization };
  const snapshot = buildFinancialSnapshot(context);
  const ledger: Ledger = Object.freeze({ workspaceId: query.workspaceId, period: query.period, accounts: Object.freeze([...accounts]), transactions: Object.freeze([...transactions]) });
  return Object.freeze({
    identity, period: query.period, ledger, accounts: ledger.accounts,
    transactions: query.authorizationLevel === "detail" || query.authorizationLevel === "administration" ? ledger.transactions : Object.freeze([]),
    snapshot, evidence: snapshot.evidence, confidence: snapshot.confidence, freshness: snapshot.freshness, evaluatedAt: snapshot.evaluatedAt,
  });
}

export function getFinancialSnapshot(repository: FinancialReadModelRepository, query: GetFinancialSnapshotQuery) {
  return repository.getFinancialSnapshot(query);
}

export class BuildFinancialReadModel {
  constructor(private readonly source: FinancialSource) {}
  execute(query: GetFinancialSnapshotQuery) { return buildFinancialReadModel(this.source, query); }
}
export class BuildFinancialSnapshot {
  execute(context: FinancialBuildContext) { return buildFinancialSnapshot(context); }
}
export class BuildFinancialEvidence {
  execute(context: FinancialBuildContext) { return buildFinancialEvidence(context); }
}
export class BuildFinancialFreshness {
  execute(lastSuccessfulAt?: string, evaluatedAt?: string) { return buildFinancialFreshness(lastSuccessfulAt, evaluatedAt); }
}
export class GetFinancialSnapshot {
  constructor(private readonly repository: FinancialReadModelRepository) {}
  execute(query: GetFinancialSnapshotQuery) { return getFinancialSnapshot(this.repository, query); }
}

export function observeFinancialEvaluation(observability: FinancialObservability | undefined, model: FinancialReadModel, startedAt: number, finishedAt: number): void {
  observability?.evaluated({
    workspaceId: model.identity.workspaceId, period: model.period, transactionCount: model.ledger.transactions.length,
    evidenceCoverage: model.evidence.transactionCoverage, confidence: model.confidence, freshness: model.freshness,
    durationMs: Math.max(0, finishedAt - startedAt),
  });
}

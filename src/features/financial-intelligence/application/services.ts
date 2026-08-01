import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
} from "@/features/workspace/domain/team-access";
import { Money } from "@/platform/kernel";
import type {
  FinancialAccountCategory, FinancialConfidence, FinancialEvidence,
  FinancialBasis, FinancialExpenseCategory, FinancialExpenseGroup, FinancialFreshness, FinancialMeasurement,
  FinancialMetricLineage, FinancialReadModel, FinancialRisk, FinancialSnapshot, FinancialTransaction, Ledger,
} from "../domain";
import { assertFinancialPeriod, financialExpenseCategories } from "../domain";
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

const measurements: readonly FinancialMeasurement[] = ["measured", "projected", "scenario", "budget", "forecast", "estimated", "actual", "target"];
const bases: readonly FinancialBasis[] = ["actual", "forecast", "scenario", "budget", "target"];
function basisOf(measurement:FinancialMeasurement):FinancialBasis {
  if(measurement==="measured")return"actual";
  if(measurement==="projected")return"forecast";
  if(measurement==="estimated")return"target";
  return measurement;
}

const expenseGroups: Readonly<Record<FinancialExpenseGroup, readonly FinancialExpenseCategory[]>> = {
  fixed: ["mortgage", "lease", "insurance", "property-tax", "hoa", "software", "internet", "licensing", "subscriptions"],
  variable: ["platform-fees","merchant-fees","cleaning", "utilities", "supplies", "laundry", "guest-amenities", "maintenance", "repairs", "consumables"],
  management: ["management-fees", "co-host-fees", "accounting", "virtual-assistant", "operations","legal","marketing","education","professional-services"],
  capital: ["furniture", "equipment", "renovations", "replacement-reserve", "capital-improvements"],
};
const expenseAliases: Readonly<Record<string, FinancialExpenseCategory>> = {
  taxes: "property-tax", tax: "property-tax", management: "management-fees", "management-fee": "management-fees",
  "co-host": "co-host-fees", cohost: "co-host-fees", amenities: "guest-amenities", reserve: "replacement-reserve",
  "capital-reserve": "replacement-reserve", "capital-improvement": "capital-improvements",
};
function expenseCategory(value?: string): FinancialExpenseCategory {
  const normalized = (value ?? "operations").trim().toLowerCase().replaceAll("_", "-").replace(/\s+/g, "-");
  return financialExpenseCategories.includes(normalized as FinancialExpenseCategory)
    ? normalized as FinancialExpenseCategory
    : expenseAliases[normalized] ?? "operations";
}
function expenseGroup(category: FinancialExpenseCategory): FinancialExpenseGroup {
  return (Object.entries(expenseGroups) as [FinancialExpenseGroup, readonly FinancialExpenseCategory[]][])
    .find(([, categories]) => categories.includes(category))?.[0] ?? "variable";
}
function deterministicId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `financial-snapshot-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildFinancialSnapshot(context: FinancialBuildContext): FinancialSnapshot {
  const currency = context.query.reportingCurrency ?? context.identity.reportingCurrency;
  const accountById = new Map(context.accounts.map((account) => [account.id, account]));
  const posted = context.transactions.filter(({ props }) => props.status === "posted");
  for (const transaction of posted) {
    if (transaction.props.amount.currency !== currency) throw new FinancialReadError("CURRENCY_MISMATCH", "Transactions must be converted to reporting currency before snapshot construction.");
    if (!accountById.has(transaction.props.accountId)) throw new FinancialReadError("SOURCE_SCOPE_VIOLATION", "A transaction references an account outside the canonical ledger.");
  }
  const selectedBasis=context.query.basis??"actual";
  const entriesFor=(selectedCategories:readonly FinancialAccountCategory[],basis?:FinancialBasis)=>
    posted.filter(({props})=>selectedCategories.includes(accountById.get(props.accountId)!.category)&&(!basis||basisOf(props.measurement)===basis));
  const sumEntries=(entries:readonly FinancialTransaction[])=>entries.length
    ?entries.reduce((total,{props})=>total.add(props.amount),Money.zero(currency))
    :null;
  const available=(entries:readonly FinancialTransaction[],reason:string)=>{
    const value=sumEntries(entries);
    const observationIds=Object.freeze(entries.map(({props})=>props.id).sort());
    return value?Object.freeze({status:"available" as const,value,observationIds}):Object.freeze({status:"unavailable" as const,reason,observationIds});
  };
  const quality = buildFinancialEvidence(context);
  const valuesByMeasurement = Object.fromEntries(measurements.map((measurement) => [measurement, Object.freeze({
    revenue: sumEntries(posted.filter(({props})=>accountById.get(props.accountId)?.category==="revenue"&&props.measurement===measurement))??Money.zero(currency),
    expenses: sumEntries(posted.filter(({props})=>["cost-of-revenue","operating-expense"].includes(accountById.get(props.accountId)?.category??"")&&props.measurement===measurement))??Money.zero(currency),
  })])) as Record<FinancialMeasurement, Readonly<{ revenue: Money; expenses: Money }>>;
  const valuesByBasis=Object.fromEntries(bases.map(basis=>[basis,Object.freeze({
    revenue:available(entriesFor(["revenue"],basis),`No ${basis} revenue observations are available for this period.`),
    expenses:available(entriesFor(["cost-of-revenue","operating-expense"],basis),`No ${basis} expense observations are available for this period.`),
  })])) as FinancialSnapshot["valuesByBasis"];
  const evaluatedAt = context.query.evaluatedAt ?? new Date().toISOString();
  const selected=posted.filter(({props})=>basisOf(props.measurement)===selectedBasis);
  const operatingEntries=entriesFor(["cost-of-revenue","operating-expense"],selectedBasis);
  const revenueEntries=entriesFor(["revenue"],selectedBasis);
  const capitalEntries=entriesFor(["capital-expense"],selectedBasis);
  const assetEntries=entriesFor(["asset"],selectedBasis),liabilityEntries=entriesFor(["liability"],selectedBasis);
  const equityEntries=entriesFor(["equity"],selectedBasis),reserveEntries=entriesFor(["reserve"],selectedBasis);
  const operatingExpenses=sumEntries(operatingEntries),grossRevenue=sumEntries(revenueEntries),capitalExpenses=sumEntries(capitalEntries);
  const grossProfit=grossRevenue&&operatingExpenses?grossRevenue.subtract(operatingExpenses):null;
  const noi=grossProfit;
  const netCashFlow=noi&&capitalExpenses?noi.subtract(capitalExpenses):null;
  const assets=sumEntries(assetEntries),liabilities=sumEntries(liabilityEntries),equity=sumEntries(equityEntries);
  const cashPosition=assets&&liabilities?assets.subtract(liabilities):null;
  const initialInvestment=equity&&capitalExpenses?equity.add(capitalExpenses):null;
  const capitalReserve=sumEntries(reserveEntries);
  const remainingCapital=capitalReserve&&capitalExpenses?capitalReserve.subtract(capitalExpenses):null;
  const ratio=(numerator:Money|null,denominator:Money|null)=>numerator&&denominator&&denominator.amount!==0?numerator.amount/denominator.amount:null;
  const expenseBreakdown = financialExpenseCategories.map((category) => {
    const entries = posted.filter(({ props }) => {
      const account = accountById.get(props.accountId)!;
      return basisOf(props.measurement)===selectedBasis&&["cost-of-revenue", "operating-expense", "capital-expense"].includes(account.category) && expenseCategory(account.subcategory ?? props.category) === category;
    });
    if (!entries.length) return null;
    const measurementValues = Object.fromEntries(measurements.map((measurement) => {
      const selected = entries.filter(({ props }) => props.measurement === measurement);
      return selected.length ? [measurement, selected.reduce((total, item) => total.add(item.props.amount), Money.zero(currency))] : null;
    }).filter((entry): entry is [FinancialMeasurement, Money] => entry !== null));
    const evidenceIds = [...new Set(entries.flatMap(({ props }) => props.evidenceIds))].sort();
    return Object.freeze({
      category, group: expenseGroup(category),
      amount: entries.reduce((total, item) => total.add(item.props.amount), Money.zero(currency)),
      measurements: Object.freeze(measurementValues),
      transactionIds: Object.freeze(entries.map(({ props }) => props.id).sort()),
      evidenceIds: Object.freeze(evidenceIds),
      confidence: evidenceIds.length === entries.length ? quality.confidence : "low" as const,
    });
  }).filter((item): item is NonNullable<typeof item> => item !== null);
  const variances:FinancialSnapshot["variances"]=bases.filter((basis):basis is Exclude<FinancialBasis,"actual">=>basis!=="actual").flatMap(basis=>{
    const actual=valuesByBasis.actual,baseline=valuesByBasis[basis];
    if(actual.revenue.status!=="available"||actual.expenses.status!=="available"||baseline.revenue.status!=="available"||baseline.expenses.status!=="available")return[];
    const varianceInputs = [
      ["revenue", actual.revenue.value, baseline.revenue.value],
      ["expenses", actual.expenses.value, baseline.expenses.value],
      ["noi", actual.revenue.value.subtract(actual.expenses.value), baseline.revenue.value.subtract(baseline.expenses.value)],
      ["cash-flow", actual.revenue.value.subtract(actual.expenses.value), baseline.revenue.value.subtract(baseline.expenses.value)],
    ] as const;
    return varianceInputs.map(([metric, actualValue, projectedValue]) => {
    const magnitude = actualValue.subtract(projectedValue);
    const favorable = metric === "expenses" ? magnitude.amount < 0 : magnitude.amount > 0;
    return Object.freeze({
      metric,basis,actual: actualValue, projected: projectedValue, magnitude,
      percentage: projectedValue.amount === 0 ? undefined : magnitude.amount / Math.abs(projectedValue.amount),
      direction: magnitude.amount === 0 ? "on-plan" as const : favorable ? "favorable" as const : "unfavorable" as const,
      reason: projectedValue.amount === 0 ? "No projected baseline is available for this period." : `${metric.replace("-", " ")} actuals were ${magnitude.amount === 0 ? "on plan" : favorable ? "favorable to plan" : "unfavorable to plan"}.`,
      confidence: quality.confidence,
      evidenceIds: quality.evidence.sourceIds,
    });
    });
  });
  const component = (key: "liquidity"|"profitability"|"expense"|"revenue"|"capital", score: number|null) => Object.freeze({
    key, score:score===null?null:Math.max(0,Math.min(100,Math.round(score))),
    status: score===null||quality.confidence === "insufficient-evidence" ? "insufficient-evidence" as const : score >= 70 ? "healthy" as const : score >= 40 ? "watch" as const : "critical" as const,
    evidenceIds: quality.evidence.sourceIds,
  });
  const healthFactors = Object.freeze([
    component("liquidity",cashPosition?cashPosition.amount>0?80:20:null),
    component("profitability",noi&&grossRevenue?noi.amount>0?Math.min(100,60+(ratio(noi,grossRevenue)??0)*100):20:null),
    component("expense",grossRevenue&&operatingExpenses?100-Math.min(100,(ratio(operatingExpenses,grossRevenue)??0)*100):null),
    component("revenue",grossRevenue?grossRevenue.amount>0?80:10:null),
    component("capital",remainingCapital?remainingCapital.amount>=0?80:20:null),
  ]);
  const availableScores=healthFactors.flatMap(item=>item.score===null?[]:[item.score]);
  const health = Object.freeze({score:availableScores.length?Math.round(availableScores.reduce((total,item)=>total+item,0)/availableScores.length):null,confidence:quality.confidence,breakdown:healthFactors});
  const risks: FinancialRisk[] = [];
  const risk = (value: FinancialRisk) => risks.push(Object.freeze(value));
  if (netCashFlow?.isNegative()) risk({ code: "negative-cash-flow", severity: "critical", likelihood: "high", summary: "Net cash flow is negative for this period.", mitigation: "Review revenue recovery and the largest controllable expense categories.", evidenceIds: quality.evidence.sourceIds });
  if (remainingCapital?.isNegative()) risk({ code: "capital-shortfall", severity: "high", likelihood: "high", summary: "Capital spending exceeds the recorded reserve.", mitigation: "Rephase capital work or identify an authorized funding source.", evidenceIds: quality.evidence.sourceIds });
  if (variances.some((item) => item.percentage !== undefined && Math.abs(item.percentage) >= .15)) risk({ code: "large-variance", severity: "high", likelihood: "moderate", summary: "At least one actual result differs from plan by 15% or more.", mitigation: "Open variance evidence and refresh the operating forecast.", evidenceIds: quality.evidence.sourceIds });
  if (quality.confidence === "low" || quality.confidence === "insufficient-evidence") risk({ code: "low-confidence", severity: "medium", likelihood: "high", summary: "Financial conclusions are limited by evidence coverage.", mitigation: "Connect missing providers or attach evidence to uncited transactions.", evidenceIds: quality.evidence.sourceIds });
  const lineageFor = (metric: string, formula: string, entries: readonly FinancialTransaction[]): FinancialMetricLineage => Object.freeze({
    metric, formula, inputTransactionIds: Object.freeze(entries.map(({ props }) => props.id).sort()),
    evidenceIds: Object.freeze([...new Set(entries.flatMap(({ props }) => props.evidenceIds))].sort()),
    sourceProviders: Object.freeze([...new Set(entries.map(({ props }) => props.source.provider))].sort()),
    confidence: quality.confidence, freshness: quality.freshness, calculatedAt: evaluatedAt, calculationVersion: "financial-calculation.v1",
  });
  const lineage = Object.freeze({
    revenue: lineageFor("gross-revenue", "sum(posted revenue observations)", revenueEntries),
    expenses: lineageFor("operating-expenses", "sum(posted cost-of-revenue and operating-expense observations)", operatingEntries),
    noi: lineageFor("noi", "gross revenue - operating expenses", [...revenueEntries, ...operatingEntries]),
    cashFlow: lineageFor("net-cash-flow", "NOI - capital expenses", [...revenueEntries, ...operatingEntries, ...capitalEntries]),
  });
  const sourceFingerprint = selected.map(({ props }) => `${props.id}:${props.amount.minorUnits}:${basisOf(props.measurement)}`).sort().join("|");
  return Object.freeze({
    id: deterministicId(`${context.query.workspaceId}|${context.query.propertyId ?? context.query.portfolioId ?? "workspace"}|${context.query.period.from}|${context.query.period.to}|${selectedBasis}|${sourceFingerprint}`),
    snapshotVersion: 1, schemaVersion: "financial-snapshot.v1",
    basis:selectedBasis,
    workspaceId: context.query.workspaceId, portfolioId: context.query.portfolioId, propertyId: context.query.propertyId,
    period: context.query.period,
    revenue: grossRevenue, expenses: operatingExpenses,assets,liabilities,equity,
    valuesByMeasurement: Object.freeze(valuesByMeasurement),
    valuesByBasis:Object.freeze(valuesByBasis),
    expenseBreakdown: Object.freeze(expenseBreakdown),
    profitability: Object.freeze({
      grossRevenue,operatingExpenses,grossProfit,noi,ebitda:noi,operatingMargin:ratio(noi,grossRevenue),
      netCashFlow,cashPosition,expenseRatio:ratio(operatingExpenses,grossRevenue),
      revenueEfficiency:ratio(grossRevenue,operatingExpenses),
    }),
    capital:Object.freeze({initialInvestment,workingCapital:assets,capitalExpenses,capitalReserve,replacementReserve:capitalReserve,remainingCapital}),
    variances: Object.freeze(variances), health, risks: Object.freeze(risks), lineage,
    evidence: quality.evidence, confidence: quality.confidence, freshness: quality.freshness,
    evaluatedAt, capturedAt: evaluatedAt,
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

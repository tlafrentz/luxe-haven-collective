import { Money } from "@/platform/kernel";
import type { FinancialAccount, FinancialReadModel } from "../../domain";
import type {
  FinancialAttentionItem, FinancialChangeSummary, FinancialDriver, FinancialEvidenceSummary,
  FinancialExecutionSummary, FinancialMetricSummary, FinancialOverview, FinancialOverviewBuildInput,
  FinancialPerformanceTrendPoint, FinancialPlanVariancePreview, FinancialPropertyContribution,
} from "./contracts";
import {
  condition, FINANCIAL_OVERVIEW_POLICY_VERSION, FINANCIAL_OVERVIEW_THRESHOLDS,
  liquidity, metricChange, profitability, qualification,
} from "./policies";

function operating(model: FinancialReadModel) {
  const values=model.snapshot.valuesByMeasurement,actual=model.snapshot.valuesByBasis.actual;
  const revenue=actual.revenue.status==="available"?actual.revenue.value:null;
  const expenses=actual.expenses.status==="available"?actual.expenses.value:null;
  const expenseReliable = expenses!==null&&model.evidence.expenseCoverage >= FINANCIAL_OVERVIEW_THRESHOLDS.minimumExpenseCoverage;
  const revenueReliable = revenue!==null&&model.evidence.revenueCoverage > 0;
  const noi = expenseReliable && revenueReliable ? revenue.subtract(expenses) : null;
  const margin = noi && revenue && revenue.amount !== 0 ? noi.amount / revenue.amount : null;
  const marginUnavailableReason = margin !== null ? undefined
    : !revenueReliable ? "Reliable revenue is required to calculate operating margin."
    : revenue && revenue.amount === 0 ? "Revenue is required to calculate operating margin."
    : !expenseReliable ? "Reliable operating expenses are required to calculate operating margin."
    : "Operating margin requires reliable non-zero revenue and expenses.";
  return {revenue,expenses,noi,margin,marginUnavailableReason,expenseReliable,revenueReliable,qualification:revenue?qualification(revenue,values.estimated.revenue,values.projected.revenue,values.forecast.revenue):"unavailable" as const};
}

function valueMetric(metric: FinancialMetricSummary["metric"], current: Money | null, previous: Money | null, input: FinancialOverviewBuildInput, favorable: boolean, limitation?: string): FinancialMetricSummary {
  const available = current !== null;
  return {
    metric,
    current: available ? { money: current, qualification: "measured" } : { qualification: "unavailable", limitation },
    ...(previous ? { comparison: { money: previous, qualification: "measured" } } : {}),
    change: metricChange(current, previous, favorable),
    availability: available ? "available" : "unavailable", confidence: available ? input.current.confidence : "insufficient-evidence",
    freshness: input.current.freshness, evidenceIds: input.current.evidence.sourceIds,
  };
}

export function buildFinancialMetricSummaries(input: FinancialOverviewBuildInput): readonly FinancialMetricSummary[] {
  const current = operating(input.current);
  const previous = input.comparison ? operating(input.comparison) : undefined;
  const metrics: FinancialMetricSummary[] = [
    { ...valueMetric("revenue", current.revenueReliable ? current.revenue : null, previous?.revenueReliable ? previous.revenue : null, input, true, "Recognized revenue is unavailable."), current: current.revenueReliable&&current.revenue ? { money: current.revenue, qualification: current.qualification } : { qualification: "unavailable", limitation: "Recognized revenue is unavailable." } },
    valueMetric("operating-expenses", current.expenseReliable ? current.expenses : null, previous?.expenseReliable ? previous.expenses : null, input, false, "Operating expenses unavailable because coverage is incomplete."),
    valueMetric("noi", current.noi, previous?.noi ?? null, input, true, "NOI requires reliable recognized revenue and operating expenses."),
    {
      metric: "operating-margin",
      current: current.margin === null ? { qualification: "unavailable", limitation: current.marginUnavailableReason } : { percentage: current.margin, qualification: "measured" },
      ...(previous?.margin !== null && previous?.margin !== undefined ? { comparison: { percentage: previous.margin, qualification: "measured" as const } } : {}),
      ...(current.margin !== null && previous?.margin !== null && previous?.margin !== undefined ? { change: { kind: "absolute-only" as const, direction: current.margin === previous.margin ? "stable" as const : current.margin > previous.margin ? "improved" as const : "declined" as const, percentagePointChange: current.margin - previous.margin } } : {}),
      availability: current.margin === null ? "unavailable" : "available", confidence: current.margin === null ? "insufficient-evidence" : input.current.confidence,
      freshness: input.current.freshness, evidenceIds: input.current.evidence.sourceIds,
    },
    {
      metric: "cash-balance",
      current: !input.canViewCash ? { qualification: "unavailable", limitation: "Cash balances are restricted." } : input.cash ? { money: input.cash.balance, qualification: input.cash.qualification, asOf: input.cash.asOf } : { qualification: "unavailable", limitation: "Connect or import a cash-account balance." },
      availability: !input.canViewCash ? "restricted" : input.cash ? "available" : "unavailable", confidence: input.cash?.confidence ?? "insufficient-evidence",
      freshness: input.cash?.freshness ?? "unknown", evidenceIds: input.cash?.evidenceIds ?? [],
    },
    {
      metric: "net-cash-movement",
      current: !input.canViewCash ? { qualification: "unavailable", limitation: "Cash movement is restricted." } : input.cash ? { money: input.cash.netMovement, qualification: input.cash.qualification } : { qualification: "unavailable", limitation: "Net cash movement requires a cash source and is not inferred from NOI." },
      availability: !input.canViewCash ? "restricted" : input.cash ? "available" : "unavailable", confidence: input.cash?.confidence ?? "insufficient-evidence",
      freshness: input.cash?.freshness ?? "unknown", evidenceIds: input.cash?.evidenceIds ?? [],
    },
  ];
  return Object.freeze(metrics);
}

function groupedDrivers(model: FinancialReadModel, categories: readonly FinancialAccount["category"][], limit = 4): readonly FinancialDriver[] {
  const accounts = new Map(model.accounts.map(account => [account.id, account]));
  const totals = new Map<string, Money>();
  for (const transaction of model.ledger.transactions) {
    const account = accounts.get(transaction.props.accountId);
    if (transaction.props.status !== "posted" || !["actual","measured"].includes(transaction.props.measurement) || !account || !categories.includes(account.category)) continue;
    const key = account.subcategory ?? account.name;
    totals.set(key, (totals.get(key) ?? Money.zero(transaction.props.amount.currency)).add(transaction.props.amount));
  }
  const total = [...totals.values()].reduce((sum, item) => sum + item.amount, 0);
  return Object.freeze([...totals.entries()].map(([label, amount]) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, amount,
    share: total ? amount.amount / total : undefined, qualification: "measured" as const,
    confidence: model.confidence,
  })).sort((a, b) => b.amount.amount - a.amount.amount).slice(0, limit));
}

function buildFinancialPerformanceTrend(model: FinancialReadModel): readonly FinancialPerformanceTrendPoint[] {
  const accounts = new Map(model.accounts.map(account => [account.id, account]));
  const byDay = new Map<string, { revenue: number; expenses: number }>();
  for (let cursor = new Date(`${model.period.from}T00:00:00Z`), end = new Date(`${model.period.to}T00:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    byDay.set(cursor.toISOString().slice(0, 10), { revenue: 0, expenses: 0 });
  }
  for (const transaction of model.ledger.transactions) {
    const account = accounts.get(transaction.props.accountId);
    const bucket = byDay.get(transaction.props.effectiveDate.slice(0, 10));
    if (transaction.props.status !== "posted" || !["actual", "measured"].includes(transaction.props.measurement) || !account || !bucket) continue;
    if (account.category === "revenue") bucket.revenue += transaction.props.amount.amount;
    else if (account.category === "cost-of-revenue" || account.category === "operating-expense") bucket.expenses += transaction.props.amount.amount;
  }
  let revenue = 0, expenses = 0;
  return Object.freeze([...byDay.entries()].map(([date, bucket]) => {
    revenue += bucket.revenue; expenses += bucket.expenses;
    return { date, revenue, expenses, noi: revenue - expenses };
  }));
}

function withDriverChange(current: readonly FinancialDriver[], previous: readonly FinancialDriver[]): readonly FinancialDriver[] {
  const previousByLabel = new Map(previous.map(item => [item.label, item.amount]));
  return current.map(item => {
    const prior = previousByLabel.get(item.label);
    return prior ? { ...item, change: item.amount.subtract(prior) } : item;
  });
}

export function buildFinancialPropertyContributionPreview(input: FinancialOverviewBuildInput): readonly FinancialPropertyContribution[] {
  const values = (input.propertySnapshots ?? []).flatMap(({ propertyId, label, snapshot }) => {
    const actual=snapshot.valuesByBasis.actual;
    if(actual.revenue.status!=="available")return[];
    const expenses=actual.expenses.status==="available"?actual.expenses.value:null;
    const reliable = expenses!==null&&snapshot.evidence.expenseCoverage >= FINANCIAL_OVERVIEW_THRESHOLDS.minimumExpenseCoverage;
    return [{propertyId,label,revenue:actual.revenue.value,noi:reliable?actual.revenue.value.subtract(expenses):null,expenseCoverage:snapshot.evidence.expenseCoverage,confidence:snapshot.confidence}];
  });
  const totalNoi = values.reduce((sum, value) => sum + (value.noi?.amount ?? 0), 0);
  return Object.freeze(values.map(value => ({ ...value, noiShare: value.noi && totalNoi ? value.noi.amount / totalNoi : undefined })).sort((a, b) => b.revenue.amount - a.revenue.amount).slice(0, 5));
}

export function buildFinancialPlanVariancePreview(input: FinancialOverviewBuildInput): FinancialPlanVariancePreview {
  if (!input.plan) return { available: false, status: "unavailable", lines: [], explanation: "No approved compatible budget or forecast is available." };
  if (input.plan.accountingBasis !== input.current.identity.accountingMethod) return { available: false, status: "incompatible-basis", lines: [], explanation: "The selected plan uses a different accounting basis." };
  const actual = operating(input.current);
  const actuals = { revenue: actual.revenue, expenses: actual.expenses, noi: actual.noi, cash: input.cash?.balance };
  const lines = (["revenue", "expenses", "noi", "cash"] as const).flatMap(metric => {
    const plan = input.plan!.values[metric], value = actuals[metric];
    if (!plan || !value) return [];
    const variance = value.subtract(plan);
    return [{ metric, actual: value, plan, variance, favorable: metric === "expenses" ? variance.amount <= 0 : variance.amount >= 0 }];
  });
  return { available: Boolean(lines.length), kind: input.plan.kind, status: lines.length ? "available" : "unavailable", lines: Object.freeze(lines), explanation: lines.length ? `Actual values are compared with the approved ${input.plan.kind} using account-type variance conventions.` : "The plan does not contain compatible overview metrics." };
}

export function identifyMaterialFinancialChanges(input: FinancialOverviewBuildInput): readonly FinancialChangeSummary[] {
  if (!input.comparison) return Object.freeze([]);
  const current = operating(input.current), previous = operating(input.comparison);
  const candidates = [
    ["revenue", current.revenueReliable ? current.revenue : null, previous.revenueReliable ? previous.revenue : null, true],
    ["expenses", current.expenseReliable ? current.expenses : null, previous.expenseReliable ? previous.expenses : null, false],
    ["noi", current.noi, previous.noi, true],
  ] as const;
  return Object.freeze(candidates.flatMap(([category, value, prior, favorable]) => {
    const change = metricChange(value, prior, favorable);
    if (!change?.amount || Math.abs(change.amount.minorUnits) < FINANCIAL_OVERVIEW_THRESHOLDS.materialAbsoluteMinorUnits) return [];
    const title = `${category === "noi" ? "NOI" : category[0]!.toUpperCase() + category.slice(1)} ${change.direction === "improved" ? "improved" : "declined"}`;
    return [{
      id: `financial-change:${category}`, category, direction: change.direction, title,
      description: change.kind === "new" ? `A new ${category} measurement is available this period.` : `${title} by ${change.amount.format()} versus the compatible comparison period.`,
      amount: change.amount, percentageChange: change.percentageChange, affectedPropertyIds: input.scope.propertyIds,
      accountIds: [], classification: "economic-change" as const, confidence: input.current.confidence, evidenceIds: input.current.evidence.sourceIds,
    }];
  }).sort((a, b) => Math.abs(b.amount?.amount ?? 0) - Math.abs(a.amount?.amount ?? 0)).slice(0, 5));
}

export function identifyFinancialAttentionItems(input: FinancialOverviewBuildInput, plan: FinancialPlanVariancePreview): readonly FinancialAttentionItem[] {
  const current = operating(input.current);
  const items: FinancialAttentionItem[] = [];
  if (!current.expenseReliable) items.push({ id: "expense-coverage", type: "data-limitation", title: "Operating expense coverage", description: "Expense coverage is incomplete.", whyItMatters: "NOI and operating margin cannot be calculated reliably.", confidence: input.current.confidence, evidenceIds: input.current.evidence.sourceIds, destination: "#financial-evidence" });
  if (input.current.freshness === "stale" || input.current.freshness === "unknown") items.push({ id: "stale-source", type: "stale-source", title: "Financial source freshness", description: "One or more financial sources are stale or unknown.", whyItMatters: "Recent financial changes may not yet be represented.", confidence: input.current.confidence, evidenceIds: input.current.evidence.sourceIds, destination: "#financial-evidence" });
  if (input.canViewCash && input.cash?.balance.isNegative()) items.push({ id: "cash-pressure", type: "cash-pressure", title: "Cash pressure", description: "The authorized cash balance is negative.", whyItMatters: "Known liquidity may not cover near-term activity.", impact: input.cash.balance, confidence: input.cash.confidence, evidenceIds: input.cash.evidenceIds, destination: "#liquidity" });
  for (const line of plan.lines.filter(line => !line.favorable).slice(0, 1)) items.push({ id: `plan-${line.metric}`, type: "budget-variance", title: `${line.metric} plan variance`, description: `${line.metric} is ${line.variance.format()} versus plan.`, whyItMatters: "Performance is outside the compatible approved plan.", impact: line.variance, confidence: input.current.confidence, evidenceIds: input.current.evidence.sourceIds, destination: "#financial-planning" });
  const next = input.obligations?.items.filter(item => item.status === "overdue" || item.status === "due" || item.status === "due-soon")[0];
  if (next) items.push({ id: `obligation-${next.id}`, type: "upcoming-obligation", title: next.description, description: `${next.amount.format()} is ${next.status.replace("-", " ")}.`, whyItMatters: "A known obligation may affect near-term cash.", impact: next.amount, confidence: next.confidence, evidenceIds: next.evidenceIds, destination: "#financial-obligations" });
  return Object.freeze(items.slice(0, 5));
}

export function buildFinancialEvidenceSummary(input: FinancialOverviewBuildInput): FinancialEvidenceSummary {
  const model = input.current;
  const categorized = model.ledger.transactions.filter(({ props }) => props.category.trim() && props.category !== "uncategorized").length;
  return {
    revenueCoverage: model.evidence.revenueCoverage, expenseCoverage: model.evidence.expenseCoverage,
    cashCoverage: input.canViewCash && input.cash ? 1 : 0,
    propertyCoverage: input.scope.propertyCount ? (input.propertySnapshots?.length ?? input.scope.propertyCount) / input.scope.propertyCount : 0,
    accountCoverage: model.accounts.length ? model.ledger.transactions.filter(({ props }) => model.accounts.some(account => account.id === props.accountId)).length / Math.max(1, model.ledger.transactions.length) : 0,
    categorizationCoverage: model.ledger.transactions.length ? categorized / model.ledger.transactions.length : 0,
    uncategorizedTransactionCount: model.ledger.transactions.length - categorized,
    reconciliation: "unknown", historyMonths: model.evidence.historyMonths, gaps: model.evidence.gaps,
    oldestSourceUpdate: input.cash?.asOf,
  };
}

export function buildFinancialOverview(input: FinancialOverviewBuildInput): FinancialOverview {
  if (input.plan && input.plan.values[Object.keys(input.plan.values)[0] as keyof typeof input.plan.values]?.currency !== input.current.identity.reportingCurrency) throw new Error("FINANCIAL_CURRENCY_MISMATCH");
  const current = operating(input.current);
  const metrics = buildFinancialMetricSummaries(input);
  const profitabilitySummary = profitability(current.noi, current.margin, input.current.confidence);
  const liquiditySummary = liquidity(input);
  const planning = buildFinancialPlanVariancePreview(input);
  const changes = identifyMaterialFinancialChanges(input);
  const attention = identifyFinancialAttentionItems(input, planning);
  const evidence = buildFinancialEvidenceSummary(input);
  const financialCondition = condition({
    profitability: profitabilitySummary, liquidity: liquiditySummary, confidence: input.current.confidence,
    stale: input.current.freshness === "stale" || input.current.freshness === "unknown",
    adversePlan: planning.lines.some(line => !line.favorable), expenseIncrease: changes.some(change => change.category === "expenses" && change.direction === "declined"),
    evidenceIds: input.current.evidence.sourceIds,
  });
  const state = !input.current.ledger.transactions.length ? "empty"
    : input.permissionLimited ? "permission-limited"
      : input.current.freshness === "stale" ? "degraded"
        : !current.expenseReliable || !input.cash ? "partial" : "ready";
  return Object.freeze({
    identity: input.current.identity, scope: input.scope, period: input.current.period,
    ...(input.comparisonType && input.comparisonType !== "budget" && input.comparisonType !== "forecast" ? { comparison: { type: input.comparisonType, available: Boolean(input.comparison), ...(!input.comparison ? { limitation: "Compatible comparison evidence is unavailable." } : {}) } } : {}),
    accountingBasis: input.current.identity.accountingMethod, reportingCurrency: input.current.identity.reportingCurrency,
    condition: financialCondition, metrics, profitability: profitabilitySummary, liquidity: liquiditySummary,
    changes, drivers: {
      revenue: groupedDrivers(input.current, ["revenue"]),
      expenses: withDriverChange(
        groupedDrivers(input.current, ["cost-of-revenue", "operating-expense"], 8),
        input.comparison ? groupedDrivers(input.comparison, ["cost-of-revenue", "operating-expense"], 8) : [],
      ),
    },
    propertyContribution: buildFinancialPropertyContributionPreview(input),
    obligations: input.obligations ?? { sourceAvailable: false, items: [] }, planning, attention,
    execution: input.execution ?? emptyExecution(input.current.identity.reportingCurrency),
    performanceTrend: buildFinancialPerformanceTrend(input.current),
    evidence, confidence: input.current.confidence, freshness: input.current.freshness,
    evaluatedAt: input.current.evaluatedAt, projectionVersion: input.projectionVersion ?? FINANCIAL_OVERVIEW_POLICY_VERSION,
    state, permissionLimited: Boolean(input.permissionLimited),
  });
}

function emptyExecution(currency: string): FinancialExecutionSummary {
  return { activeDecisions: 0, openActions: 0, committedCapital: Money.zero(currency), spentCapital: Money.zero(currency), items: [] };
}

import { Money } from "@/platform/kernel";
import type { FinancialAccountCategory, FinancialConfidence, FinancialReadModel, FinancialTransaction } from "../../domain";
import type {
  BuildIncomeStatementInput, CanonicalProfitabilitySummary, ExpenseSummary, FinancialCategorySummary,
  IncomeStatement, IncomeStatementLine, ProfitabilityDimensionSummary, ProfitabilityDriver,
  ProfitabilityTrend, PropertyProfitability, RevenueSummary,
} from "./contracts";
import { marginHealth, PROFITABILITY_POLICY, PROFITABILITY_POLICY_VERSION, safePercentageChange, trendClassification } from "./policies";

const revenueCategories: readonly FinancialAccountCategory[] = ["revenue"];
const expenseCategories: readonly FinancialAccountCategory[] = ["cost-of-revenue", "operating-expense"];

type Totals = Readonly<{
  revenue: Money; costOfRevenue: Money; operatingExpenses: Money; expenses: Money;
  grossProfit: Money | null; grossMargin: number | null; noi: Money | null; margin: number | null;
  expenseReliable: boolean; grossModeled: boolean;
}>;

function measured(model: FinancialReadModel, propertyId?: string) {
  return model.ledger.transactions.filter(({ props }) => props.status === "posted" && props.measurement === "measured" && (!propertyId || props.propertyId === propertyId));
}
function accountMap(model: FinancialReadModel) { return new Map(model.accounts.map(account => [account.id, account])); }
function sum(model: FinancialReadModel, transactions: readonly FinancialTransaction[], categories: readonly FinancialAccountCategory[]) {
  const accounts = accountMap(model), currency = model.identity.reportingCurrency;
  return transactions.filter(({ props }) => categories.includes(accounts.get(props.accountId)?.category as FinancialAccountCategory))
    .reduce((total, transaction) => total.add(transaction.props.amount), Money.zero(currency));
}
function totals(model: FinancialReadModel, propertyId?: string): Totals {
  const transactions = measured(model, propertyId);
  const revenue = sum(model, transactions, revenueCategories);
  const costOfRevenue = sum(model, transactions, ["cost-of-revenue"]);
  const operatingExpenses = sum(model, transactions, ["operating-expense"]);
  const expenses = costOfRevenue.add(operatingExpenses);
  const expenseReliable = model.evidence.expenseCoverage >= PROFITABILITY_POLICY.minimumExpenseCoverage;
  const revenueReliable = model.evidence.revenueCoverage > 0;
  const grossModeled = model.accounts.some(account => account.category === "cost-of-revenue");
  const grossProfit = grossModeled && expenseReliable && revenueReliable ? revenue.subtract(costOfRevenue) : null;
  const grossMargin = grossProfit && revenue.amount !== 0 ? grossProfit.amount / revenue.amount : null;
  const noi = expenseReliable && revenueReliable ? revenue.subtract(expenses) : null;
  return { revenue, costOfRevenue, operatingExpenses, expenses, grossProfit, grossMargin, noi, margin: noi && revenue.amount !== 0 ? noi.amount / revenue.amount : null, expenseReliable, grossModeled };
}
function line(model: FinancialReadModel, id: string, label: string, amount: Money | null, confidence = model.confidence): IncomeStatementLine {
  return { id, label, amount, qualification: amount ? "measured" : "unavailable", availability: amount ? "available" : "unavailable", confidence: amount ? confidence : "insufficient-evidence", freshness: model.freshness, evidenceIds: model.evidence.sourceIds };
}
function categories(model: FinancialReadModel, types: readonly FinancialAccountCategory[], visible: boolean): readonly FinancialCategorySummary[] {
  if (!visible) return Object.freeze([]);
  const accounts = accountMap(model), grouped = new Map<string, { amount: Money; count: number }>();
  for (const transaction of measured(model)) {
    const account = accounts.get(transaction.props.accountId);
    if (!account || !types.includes(account.category)) continue;
    const label = account.subcategory?.trim() || "Uncategorized";
    const current = grouped.get(label) ?? { amount: Money.zero(transaction.props.amount.currency), count: 0 };
    grouped.set(label, { amount: current.amount.add(transaction.props.amount), count: current.count + 1 });
  }
  const total = [...grouped.values()].reduce((value, item) => value + item.amount.amount, 0);
  return Object.freeze([...grouped.entries()].map(([label, value]) => ({
    ...line(model, `${types.join("-")}:${slug(label)}`, label, value.amount),
    category: label, share: total ? value.amount.amount / total : null, transactionCount: value.count,
  })).sort((a, b) => (b.amount?.amount ?? 0) - (a.amount?.amount ?? 0)));
}

export function buildRevenueSummary(input: BuildIncomeStatementInput): RevenueSummary {
  const current = totals(input.current);
  return { total: line(input.current, "revenue", "Operating Revenue", current.revenue), categories: categories(input.current, revenueCategories, input.canViewRevenueDetail) };
}
export function buildExpenseSummary(input: BuildIncomeStatementInput): ExpenseSummary {
  const current = totals(input.current);
  const visibleCategories = categories(input.current, expenseCategories, input.canViewExpenseDetail);
  const uncategorized = visibleCategories.find(item => item.category === "Uncategorized")?.amount ?? Money.zero(input.current.identity.reportingCurrency);
  const transactionCount = measured(input.current).filter(transaction => expenseCategories.includes(accountMap(input.current).get(transaction.props.accountId)?.category as FinancialAccountCategory)).length;
  const categorizedCount = measured(input.current).filter(transaction => {
    const account = accountMap(input.current).get(transaction.props.accountId);
    return account && expenseCategories.includes(account.category) && Boolean(account.subcategory?.trim());
  }).length;
  return {
    total: line(input.current, "expenses", "Total Operating Costs", current.expenseReliable ? current.expenses : null),
    costOfRevenue: current.grossModeled ? line(input.current, "cost-of-revenue", "Cost of Revenue", current.expenseReliable ? current.costOfRevenue : null) : null,
    operatingExpenses: line(input.current, "operating-expenses", "Operating Expenses", current.expenseReliable ? current.operatingExpenses : null),
    categories: visibleCategories, uncategorized,
    categorizationCoverage: transactionCount ? categorizedCount / transactionCount : 0,
  };
}
export function buildProfitabilitySummary(input: BuildIncomeStatementInput): CanonicalProfitabilitySummary {
  const current = totals(input.current);
  return {
    revenue: current.revenue, expenses: current.expenseReliable ? current.expenses : null,
    grossProfit: current.grossProfit, grossMargin: current.grossMargin, noi: current.noi,
    operatingMargin: current.margin, marginHealth: marginHealth(current.margin),
    confidence: current.noi ? input.current.confidence : "insufficient-evidence", freshness: input.current.freshness,
    evidenceIds: input.current.evidence.sourceIds,
  };
}

export function buildPropertyProfitability(input: BuildIncomeStatementInput): readonly PropertyProfitability[] {
  const workspace = totals(input.current), previousWorkspace = input.comparison ? totals(input.comparison) : undefined;
  void previousWorkspace;
  return Object.freeze(input.properties.map(property => {
    const current = totals(input.current, property.propertyId);
    const previous = input.comparison ? totals(input.comparison, property.propertyId) : undefined;
    const variance = current.noi && previous?.noi ? current.noi.subtract(previous.noi) : null;
    const relevant = measured(input.current, property.propertyId);
    const covered = relevant.filter(({ props }) => props.evidenceIds.length).length;
    return {
      ...property, revenue: current.revenue, expenses: current.expenseReliable ? current.expenses : null,
      noi: current.noi, margin: current.margin,
      revenueContribution: workspace.revenue.amount ? current.revenue.amount / workspace.revenue.amount : null,
      expenseContribution: current.expenseReliable && workspace.expenses.amount ? current.expenses.amount / workspace.expenses.amount : null,
      noiContribution: current.noi && workspace.noi?.amount ? current.noi.amount / workspace.noi.amount : null,
      trend: trendClassification(current.noi?.amount ?? null, previous?.noi?.amount ?? null, true), variance,
      evidenceCoverage: relevant.length ? covered / relevant.length : 0,
      confidence: current.noi ? input.current.confidence : "insufficient-evidence",
      freshness: input.current.freshness, evidenceIds: relevant.flatMap(({ props }) => props.evidenceIds),
    };
  }));
}

function trend(model: FinancialReadModel, comparison: FinancialReadModel | undefined, metric: ProfitabilityTrend["metric"]): ProfitabilityTrend {
  const current = totals(model), previous = comparison ? totals(comparison) : undefined;
  const values = metric === "revenue" ? [current.revenue, previous?.revenue] as const
    : metric === "expenses" ? [current.expenseReliable ? current.expenses : null, previous?.expenseReliable ? previous.expenses : null] as const
      : metric === "noi" ? [current.noi, previous?.noi] as const : [current.margin, previous?.margin] as const;
  const currentNumber = typeof values[0] === "number" ? values[0] : values[0]?.amount ?? null;
  const previousNumber = typeof values[1] === "number" ? values[1] : values[1]?.amount ?? null;
  const isMoney = metric !== "operating-margin";
  const variance = currentNumber !== null && previousNumber !== null
    ? isMoney ? Money.of(currentNumber - previousNumber, model.identity.reportingCurrency) : currentNumber - previousNumber : null;
  const direction = currentNumber === null || previousNumber === null ? "unavailable" : currentNumber === previousNumber ? "neutral"
    : (metric === "expenses" ? currentNumber < previousNumber : currentNumber > previousNumber) ? "positive" : "negative";
  return {
    metric, current: values[0] ?? null, comparison: values[1] ?? null, variance,
    varianceDirection: direction, percentageChange: currentNumber !== null && previousNumber !== null ? safePercentageChange(currentNumber, previousNumber) : null,
    classification: trendClassification(currentNumber, previousNumber, metric !== "expenses"), confidence: values[0] === null ? "insufficient-evidence" : model.confidence,
  };
}
export function buildProfitabilityTrends(input: BuildIncomeStatementInput): readonly ProfitabilityTrend[] {
  return Object.freeze((["revenue", "expenses", "noi", "operating-margin"] as const).map(metric => trend(input.current, input.comparison, metric)));
}

function categoryAmounts(model: FinancialReadModel, types: readonly FinancialAccountCategory[]) {
  const accounts = accountMap(model), values = new Map<string, Money>();
  for (const transaction of measured(model)) {
    const account = accounts.get(transaction.props.accountId);
    if (!account || !types.includes(account.category)) continue;
    const label = account.subcategory?.trim() || "Uncategorized";
    values.set(label, (values.get(label) ?? Money.zero(transaction.props.amount.currency)).add(transaction.props.amount));
  }
  return values;
}
function drivers(input: BuildIncomeStatementInput, kind: "revenue" | "expense"): readonly ProfitabilityDriver[] {
  const types = kind === "revenue" ? revenueCategories : expenseCategories;
  const current = categoryAmounts(input.current, types), previous = input.comparison ? categoryAmounts(input.comparison, types) : new Map<string, Money>();
  const total = [...current.values()].reduce((sum, value) => sum + value.amount, 0);
  const items = [...current.entries()].map(([label, amount]) => {
    const prior = previous.get(label), variance = prior ? amount.subtract(prior) : null;
    const classification = label === "Uncategorized" ? "uncategorized" as const
      : variance && variance.amount < 0 ? kind === "expense" ? "largest-improvement" as const : "largest-decline" as const
        : variance && variance.amount > 0 ? kind === "expense" ? "largest-decline" as const : "largest-improvement" as const
          : "largest-contributor" as const;
    return { id: `${kind}:${slug(label)}`, kind, label, amount, variance, contribution: total ? amount.amount / total : null, classification, confidence: input.current.confidence, evidenceIds: input.current.evidence.sourceIds };
  });
  return Object.freeze(items.sort((a, b) => Math.abs(b.variance?.amount ?? b.amount.amount) - Math.abs(a.variance?.amount ?? a.amount.amount)).slice(0, 5));
}

function dimensions(properties: readonly PropertyProfitability[], field: "market" | "operatingModel", currency: string): readonly ProfitabilityDimensionSummary[] {
  const values = new Map<string, PropertyProfitability[]>();
  for (const property of properties) {
    const label = property[field] ?? "Unclassified";
    values.set(label, [...(values.get(label) ?? []), property]);
  }
  return Object.freeze([...values.entries()].map(([label, items]) => {
    const revenue = items.reduce((value, item) => value.add(item.revenue), Money.zero(currency));
    const expensesAvailable = items.every(item => item.expenses);
    const expense = expensesAvailable ? items.reduce((value, item) => value.add(item.expenses!), Money.zero(currency)) : null;
    const noi = expense ? revenue.subtract(expense) : null;
    return { label, propertyIds: items.map(item => item.propertyId), revenue, expenses: expense, noi, margin: noi && revenue.amount ? noi.amount / revenue.amount : null, confidence: minimumConfidence(items.map(item => item.confidence)) };
  }).sort((a, b) => b.revenue.amount - a.revenue.amount));
}
const confidenceRank: Record<FinancialConfidence, number> = { high: 0, moderate: 1, low: 2, "insufficient-evidence": 3 };
function minimumConfidence(values: readonly FinancialConfidence[]) { return values.reduce((lowest, value) => confidenceRank[value] > confidenceRank[lowest] ? value : lowest, "high"); }

export function buildIncomeStatement(input: BuildIncomeStatementInput): IncomeStatement {
  if (input.comparison && input.comparison.identity.accountingMethod !== input.current.identity.accountingMethod) throw new Error("INCOME_STATEMENT_ACCOUNTING_BASIS_MISMATCH");
  if (input.comparison && input.comparison.identity.reportingCurrency !== input.current.identity.reportingCurrency) throw new Error("INCOME_STATEMENT_CURRENCY_MISMATCH");
  const revenue = buildRevenueSummary(input), expenses = buildExpenseSummary(input), profitability = buildProfitabilitySummary(input);
  const properties = buildPropertyProfitability(input);
  const byNoi = [...properties].filter(item => item.noi).sort((a, b) => b.noi!.amount - a.noi!.amount);
  const byMargin = [...properties].filter(item => item.margin !== null).sort((a, b) => b.margin! - a.margin!);
  const byRevenue = [...properties].sort((a, b) => b.revenue.amount - a.revenue.amount);
  const byExpense = [...properties].filter(item => item.expenses).sort((a, b) => b.expenses!.amount - a.expenses!.amount);
  const byVariance = [...properties].filter(item => item.variance).sort((a, b) => b.variance!.amount - a.variance!.amount);
  const revenueDrivers = drivers(input, "revenue"), expenseDrivers = drivers(input, "expense");
  const materialChanges = [...revenueDrivers, ...expenseDrivers].filter(item => item.variance && Math.abs(item.variance.minorUnits) >= PROFITABILITY_POLICY.materialMinorUnits).sort((a, b) => Math.abs(b.variance!.amount) - Math.abs(a.variance!.amount)).slice(0, 5);
  const empty = !input.current.ledger.transactions.length;
  const state = empty ? "empty" : input.permissionLimited ? "permission-limited"
    : input.current.freshness === "stale" ? "degraded" : profitability.noi === null ? "partial" : "ready";
  return Object.freeze({
    identity: input.current.identity, scope: input.scope, period: input.current.period,
    ...(input.comparisonType ? { comparison: { type: input.comparisonType, available: Boolean(input.comparison), ...(!input.comparison ? { limitation: "Compatible comparison evidence is unavailable." } : {}) } } : {}),
    accountingBasis: input.current.identity.accountingMethod, reportingCurrency: input.current.identity.reportingCurrency,
    revenue, expenses, profitability, properties,
    rankings: { highestNoi: byNoi.slice(0, 5), highestMargin: byMargin.slice(0, 5), largestRevenue: byRevenue.slice(0, 5), largestExpense: byExpense.slice(0, 5), largestImprovement: byVariance.slice(0, 5), largestDecline: byVariance.reverse().slice(0, 5) },
    dimensions: { markets: dimensions(properties, "market", input.current.identity.reportingCurrency), operatingModels: dimensions(properties, "operatingModel", input.current.identity.reportingCurrency) },
    trends: buildProfitabilityTrends(input), drivers: { revenue: revenueDrivers, expenses: expenseDrivers }, materialChanges,
    evidence: {
      revenueCoverage: input.current.evidence.revenueCoverage, expenseCoverage: input.current.evidence.expenseCoverage,
      propertyCoverage: input.scope.propertyCount ? properties.filter(item => item.evidenceIds.length).length / input.scope.propertyCount : 0,
      categorizationCoverage: expenses.categorizationCoverage, historyMonths: input.current.evidence.historyMonths,
      gaps: input.current.evidence.gaps, confidence: input.current.confidence, freshness: input.current.freshness,
    },
    confidence: profitability.confidence, freshness: input.current.freshness, state,
    permissionLimited: Boolean(input.permissionLimited), evaluatedAt: input.current.evaluatedAt,
    projectionVersion: input.projectionVersion ?? PROFITABILITY_POLICY_VERSION,
  });
}
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

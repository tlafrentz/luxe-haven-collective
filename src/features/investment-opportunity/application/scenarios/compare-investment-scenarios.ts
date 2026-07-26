import type {
  InvestmentScenario,
  ScenarioComparison,
  ScenarioDifferenceState,
} from "../../domain";

export class InvestmentScenarioComparisonError extends Error {
  constructor(public readonly code: "TOO_FEW_SCENARIOS" | "TOO_MANY_SCENARIOS" | "DUPLICATE_SCENARIO") {
    super(code === "TOO_FEW_SCENARIOS" ? "Select at least two scenarios." : code === "TOO_MANY_SCENARIOS" ? "Compare no more than four scenarios." : "Select each scenario only once.");
  }
}

export function compareInvestmentScenarios(
  scenarios: readonly InvestmentScenario[],
  generatedAt = new Date(),
): ScenarioComparison {
  if (scenarios.length < 2) throw new InvestmentScenarioComparisonError("TOO_FEW_SCENARIOS");
  if (scenarios.length > 4) throw new InvestmentScenarioComparisonError("TOO_MANY_SCENARIOS");
  if (new Set(scenarios.map(({ id }) => id)).size !== scenarios.length) {
    throw new InvestmentScenarioComparisonError("DUPLICATE_SCENARIO");
  }
  const baseline = scenarios[0];
  const assumptionKeys = [...new Set(scenarios.flatMap(({ snapshot }) => Object.keys(snapshot.assumptions)))].sort();
  const changedAssumptions = assumptionKeys
    .map((key) => ({
      key,
      values: scenarios.map(({ id, snapshot }) => ({ id, value: snapshot.assumptions[key] })),
    }))
    .filter(({ values }) => new Set(values.map(({ value }) => JSON.stringify(value))).size > 1)
    .map(({ key, values }) => ({
      key,
      values: values.map(({ id, value }) => ({ scenarioId: id, ...(value === undefined ? {} : { value }) })),
    }));
  const financialDifferences = METRICS.map(({ key, label, favorable }) => {
    const baselineValue = metric(baseline, key);
    return {
      metric: label,
      values: scenarios.map((scenario) => {
        const value = metric(scenario, key);
        const difference = value === undefined || baselineValue === undefined ? undefined : value - baselineValue;
        return {
          scenarioId: scenario.id,
          ...(value === undefined ? {} : { value }),
          ...(difference === undefined ? {} : { difference }),
          state: classify(difference, favorable),
        };
      }),
    };
  });
  const metrics = COMPARISON_METRICS.map((definition) => projectMetric(definition, scenarios));
  const winner = bestOverall(metrics, scenarios);
  const highestCashFlow = metrics.find(({ key }) => key === "annualCashFlow")?.bestScenarioIds[0];
  const lowestRisk = metrics.find(({ key }) => key === "risk")?.bestScenarioIds[0];
  return deepFreeze({
    projectionVersion: "scenario-comparison-projection.v1",
    generatedAt: new Date(generatedAt),
    scenarioIds: scenarios.map(({ id }) => id),
    executiveSummary: {
      bestOverallScenarioId: winner.id,
      decision: `${winner.name} is the strongest overall strategy across the available canonical return, capital, risk, recommendation, and confidence evidence.${highestCashFlow ? ` ${scenarios.find(({ id }) => id === highestCashFlow)?.name} produces the highest annual cash flow.` : ""}${lowestRisk ? ` ${scenarios.find(({ id }) => id === lowestRisk)?.name} has the lowest recorded risk burden.` : ""}`,
      ...(highestCashFlow ? { highestCashFlowScenarioId: highestCashFlow } : {}),
      ...(lowestRisk ? { lowestRiskScenarioId: lowestRisk } : {}),
    },
    metrics,
    tradeoffs: scenarios.map((scenario) => tradeoff(scenario, metrics)),
    changedAssumptions,
    financialDifferences,
    recommendationDifferences: scenarios.map(({ id, snapshot }) => ({
      scenarioId: id,
      recommendation: snapshot.result.recommendation.recommendation,
      confidence: snapshot.result.confidence.level,
      ...(snapshot.result.risks[0]?.title ? { primaryRisk: snapshot.result.risks[0].title } : {}),
    })),
  });
}

const METRICS = [
  { key: "projectedAnnualRevenue", label: "Revenue", favorable: "higher" },
  { key: "operatingExpenses", label: "Operating expenses", favorable: "lower" },
  { key: "netOperatingIncome", label: "NOI", favorable: "higher" },
  { key: "annualCashFlow", label: "Annual cash flow", favorable: "higher" },
  { key: "capRate", label: "Cap rate", favorable: "higher" },
  { key: "cashOnCashReturn", label: "Cash-on-cash return", favorable: "higher" },
  { key: "projectedOccupancy", label: "Occupancy", favorable: "higher" },
] as const;

const COMPARISON_METRICS = [
  { key: "projectedAdr", label: "ADR", category: "revenue", unit: "currency", favorable: "higher" },
  { key: "projectedOccupancy", label: "Occupancy", category: "revenue", unit: "percentage", favorable: "higher" },
  { key: "projectedAnnualRevenue", label: "Annual Revenue", category: "revenue", unit: "currency", favorable: "higher" },
  { key: "operatingExpenses", label: "Operating Expenses", category: "expenses", unit: "currency", favorable: "lower" },
  { key: "debtService", label: "Debt Service", category: "expenses", unit: "currency", favorable: "lower" },
  { key: "initialCashRequired", label: "Cash Required", category: "expenses", unit: "currency", favorable: "lower" },
  { key: "netOperatingIncome", label: "NOI", category: "returns", unit: "currency", favorable: "higher" },
  { key: "annualCashFlow", label: "Annual Cash Flow", category: "returns", unit: "currency", favorable: "higher" },
  { key: "capRate", label: "Cap Rate", category: "returns", unit: "percentage", favorable: "higher" },
  { key: "cashOnCashReturn", label: "Cash-on-Cash Return", category: "returns", unit: "percentage", favorable: "higher" },
  { key: "roi", label: "ROI", category: "returns", unit: "percentage", favorable: "higher" },
  { key: "paybackPeriod", label: "Payback Period", category: "returns", unit: "months", favorable: "lower" },
  { key: "breakEvenOccupancy", label: "Break-even Occupancy", category: "risk", unit: "percentage", favorable: "lower" },
  { key: "risk", label: "Risk Burden", category: "risk", unit: "rating", favorable: "lower" },
] as const;

function projectMetric(definition: typeof COMPARISON_METRICS[number], scenarios: readonly InvestmentScenario[]) {
  const values = scenarios.map((scenario) => ({ scenarioId: scenario.id, value: comparisonValue(scenario, definition.key) }));
  const available = values.filter((item): item is { scenarioId: string; value: number } => typeof item.value === "number");
  const numbers = available.map(({ value }) => value);
  const bestValue = numbers.length ? definition.favorable === "higher" ? Math.max(...numbers) : Math.min(...numbers) : undefined;
  const worstValue = numbers.length ? definition.favorable === "higher" ? Math.min(...numbers) : Math.max(...numbers) : undefined;
  const bestScenarioIds = available.filter(({ value }) => value === bestValue).map(({ scenarioId }) => scenarioId);
  const worstScenarioIds = available.filter(({ value }) => value === worstValue).map(({ scenarioId }) => scenarioId);
  return {
    ...definition, bestScenarioIds, worstScenarioIds,
    values: values.map((item) => {
      if (item.value === undefined) return { scenarioId: item.scenarioId, state: "unavailable" as const };
      if (bestValue === worstValue) return { ...item, state: "equal" as const };
      if (item.value === bestValue) return { ...item, state: "best" as const };
      if (item.value === worstValue) return { ...item, state: "worst" as const };
      const baseline = values[0]?.value;
      return { ...item, state: typeof baseline !== "number" ? "equal" as const : item.value > baseline ? "higher" as const : "lower" as const };
    }),
  };
}
function comparisonValue(scenario: InvestmentScenario, key: typeof COMPARISON_METRICS[number]["key"]): number | undefined {
  if (key === "risk") return scenario.snapshot.result.risks.reduce((total, risk) => total + risk.probability * severity(risk.severity), 0);
  if (["debtService", "roi", "paybackPeriod", "breakEvenOccupancy"].includes(key)) return undefined;
  const value = scenario.snapshot.result.financials[key as keyof typeof scenario.snapshot.result.financials];
  return value && typeof value === "object" ? "amount" in value ? value.amount : "value" in value ? value.value : undefined : undefined;
}
function severity(value: string) { return value === "critical" ? 4 : value === "high" ? 3 : value === "medium" || value === "moderate" ? 2 : 1; }
function bestOverall(metrics: ReturnType<typeof projectMetric>[], scenarios: readonly InvestmentScenario[]) {
  const scores = new Map(scenarios.map((scenario) => [scenario.id, 0]));
  metrics.forEach((item) => item.bestScenarioIds.forEach((id) => scores.set(id, (scores.get(id) ?? 0) + 1)));
  const recommendation: Record<string, number> = { "strong-buy": 5, buy: 4, "buy-with-conditions": 3, wait: 2, pass: 1 };
  return [...scenarios].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || (recommendation[b.snapshot.result.recommendation.recommendation] ?? 0) - (recommendation[a.snapshot.result.recommendation.recommendation] ?? 0))[0]!;
}
function tradeoff(scenario: InvestmentScenario, metrics: ReturnType<typeof projectMetric>[]) {
  return {
    scenarioId: scenario.id,
    benefits: metrics.filter((item) => item.bestScenarioIds.includes(scenario.id)).map((item) => `Best ${item.label.toLowerCase()} among compared scenarios.`),
    tradeoffs: metrics.filter((item) => item.worstScenarioIds.includes(scenario.id) && !item.bestScenarioIds.includes(scenario.id)).map((item) => `Weakest ${item.label.toLowerCase()} among compared scenarios.`),
    risks: scenario.snapshot.result.risks.slice(0, 3).map((risk) => `${risk.title}: ${risk.mitigation ?? risk.description}`),
  };
}

function metric(scenario: InvestmentScenario, key: typeof METRICS[number]["key"]): number | undefined {
  const value = scenario.snapshot.result.financials[key];
  if (!value) return undefined;
  return "amount" in value ? value.amount : value.value;
}

function classify(
  difference: number | undefined,
  favorable: string,
): ScenarioDifferenceState {
  if (difference === undefined) return "unavailable";
  if (Math.abs(difference) < 0.000001) return "unchanged";
  return (difference > 0) === (favorable === "higher") ? "improved" : "declined";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

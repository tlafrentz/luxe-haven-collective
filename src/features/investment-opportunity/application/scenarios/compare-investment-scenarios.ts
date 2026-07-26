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
  return deepFreeze({
    scenarioIds: scenarios.map(({ id }) => id),
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

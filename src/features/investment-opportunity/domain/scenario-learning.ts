import type { InvestmentScenario } from "./investment-scenario";

export type ScenarioOutcomeMetricKey =
  | "annualRevenue" | "adr" | "occupancy" | "operatingExpenses"
  | "noi" | "annualCashFlow" | "cashOnCashReturn";

export type ScenarioOutcomeRevision = Readonly<{
  id: string;
  scenarioId: string;
  opportunityId: string;
  revision: number;
  periodStart: string;
  periodEnd: string;
  actualMetrics: Readonly<Partial<Record<ScenarioOutcomeMetricKey, number>>>;
  recommendationOutcome: "successful" | "mixed" | "unsuccessful" | "insufficient-data";
  confidence: "high" | "moderate" | "low" | "insufficient-evidence";
  evidence: readonly Readonly<{ source: "financial" | "bookings" | "market" | "operator-notes" | "manual-observation"; label: string; quality: "high" | "moderate" | "low" }>[];
  createdBy: string;
  createdAt: string;
}>;

export type ScenarioLearningProjection = Readonly<{
  projectionVersion: "scenario-learning-projection.v1";
  generatedAt: string;
  scenarioId: string;
  outcomeRevision?: number;
  state: "no-outcome" | "partial" | "complete";
  metrics: readonly Readonly<{
    key: ScenarioOutcomeMetricKey;
    label: string;
    unit: "currency" | "percentage";
    projected?: number;
    actual?: number;
    absoluteVariance?: number;
    percentageVariance?: number;
    direction: "higher" | "lower" | "unchanged" | "unavailable";
  }>[];
  assumptionValidations: readonly Readonly<{
    assumption: string;
    projected: string | number | boolean;
    actual?: number;
    status: "validated" | "partially-validated" | "invalidated" | "insufficient-data";
    rationale: string;
  }>[];
  confidenceCalibration: Readonly<{
    original: string;
    observedAccuracy: "high" | "moderate" | "low" | "insufficient-evidence";
    meanAbsolutePercentageVariance?: number;
  }>;
  recommendationValidation: Readonly<{ recommendation: string; outcome: ScenarioOutcomeRevision["recommendationOutcome"]; summary: string }>;
  lessons: readonly Readonly<{ category: "revenue" | "financial" | "operations" | "investment"; statement: string; evidence: readonly string[]; confidence: string }>[];
  summary: Readonly<{ predictionAccuracy: string; confidenceAccuracy: string; bestAssumption?: string; weakestAssumption?: string; overallLearning: string }>;
}>;

export function buildScenarioLearningProjection(
  scenario: InvestmentScenario,
  outcome?: ScenarioOutcomeRevision,
  generatedAt = new Date().toISOString(),
): ScenarioLearningProjection {
  const definitions = metricDefinitions(scenario);
  const metrics = definitions.map((definition) => {
    const actual = outcome?.actualMetrics[definition.key];
    const absoluteVariance = actual === undefined || definition.projected === undefined ? undefined : actual - definition.projected;
    const percentageVariance = absoluteVariance === undefined || !definition.projected ? undefined : absoluteVariance / Math.abs(definition.projected) * 100;
    return Object.freeze({
      ...definition,
      ...(actual !== undefined ? { actual } : {}),
      ...(absoluteVariance !== undefined ? { absoluteVariance } : {}),
      ...(percentageVariance !== undefined ? { percentageVariance } : {}),
      direction: absoluteVariance === undefined ? "unavailable" as const : Math.abs(absoluteVariance) < 0.000001 ? "unchanged" as const : absoluteVariance > 0 ? "higher" as const : "lower" as const,
    });
  });
  const measured = metrics.filter((item) => item.percentageVariance !== undefined);
  const mean = measured.length ? measured.reduce((sum, item) => sum + Math.abs(item.percentageVariance!), 0) / measured.length : undefined;
  const observedAccuracy = accuracy(mean);
  const assumptionValidations = Object.entries(scenario.snapshot.assumptions).map(([assumption, projected]) => validateAssumption(assumption, projected, metrics));
  const ranked = assumptionValidations.filter((item) => item.actual !== undefined).sort((a, b) => validationRank(b.status) - validationRank(a.status));
  const lessons = outcome ? metrics.flatMap((item) => lessonFor(item, outcome)) : [];
  const state = !outcome ? "no-outcome" : measured.length === definitions.length ? "complete" : "partial";
  return deepFreeze({
    projectionVersion: "scenario-learning-projection.v1",
    generatedAt,
    scenarioId: scenario.id,
    ...(outcome ? { outcomeRevision: outcome.revision } : {}),
    state,
    metrics,
    assumptionValidations,
    confidenceCalibration: { original: scenario.snapshot.result.confidence.level, observedAccuracy, ...(mean !== undefined ? { meanAbsolutePercentageVariance: mean } : {}) },
    recommendationValidation: {
      recommendation: scenario.snapshot.result.recommendation.recommendation,
      outcome: outcome?.recommendationOutcome ?? "insufficient-data",
      summary: recommendationSummary(scenario.snapshot.result.recommendation.recommendation, outcome?.recommendationOutcome),
    },
    lessons,
    summary: {
      predictionAccuracy: mean === undefined ? "Insufficient operational evidence" : `${Math.max(0, 100 - mean).toFixed(1)}%`,
      confidenceAccuracy: `${scenario.snapshot.result.confidence.level} forecast confidence; ${observedAccuracy} observed accuracy`,
      ...(ranked[0] ? { bestAssumption: ranked[0].assumption } : {}),
      ...(ranked.at(-1) ? { weakestAssumption: ranked.at(-1)!.assumption } : {}),
      overallLearning: !outcome ? "Learning begins after an operational outcome is recorded." : lessons[0]?.statement ?? "Measured performance is within the available forecast tolerances.",
    },
  });
}

function metricDefinitions(scenario: InvestmentScenario) {
  const values = scenario.snapshot.result.financials;
  return [
    { key: "annualRevenue" as const, label: "Annual Revenue", unit: "currency" as const, projected: values.projectedAnnualRevenue.amount },
    { key: "adr" as const, label: "ADR", unit: "currency" as const, projected: values.projectedAdr.amount },
    { key: "occupancy" as const, label: "Occupancy", unit: "percentage" as const, projected: values.projectedOccupancy.value },
    { key: "operatingExpenses" as const, label: "Operating Expenses", unit: "currency" as const, projected: values.operatingExpenses.amount },
    { key: "noi" as const, label: "NOI", unit: "currency" as const, ...(values.netOperatingIncome ? { projected: values.netOperatingIncome.amount } : {}) },
    { key: "annualCashFlow" as const, label: "Annual Cash Flow", unit: "currency" as const, projected: values.annualCashFlow.amount },
    { key: "cashOnCashReturn" as const, label: "Cash-on-Cash Return", unit: "percentage" as const, projected: values.cashOnCashReturn.value },
  ];
}
function accuracy(mean?: number): "high" | "moderate" | "low" | "insufficient-evidence" { return mean === undefined ? "insufficient-evidence" : mean <= 5 ? "high" : mean <= 15 ? "moderate" : "low"; }
function validateAssumption(assumption: string, projected: string | number | boolean, metrics: ScenarioLearningProjection["metrics"]): ScenarioLearningProjection["assumptionValidations"][number] {
  const normalized = assumption.toLowerCase();
  const key: ScenarioOutcomeMetricKey | undefined = normalized.includes("occup") ? "occupancy" : normalized.includes("adr") || normalized.includes("daily") ? "adr" : normalized.includes("revenue") ? "annualRevenue" : normalized.includes("expense") ? "operatingExpenses" : undefined;
  const actual = key ? metrics.find((metric) => metric.key === key)?.actual : undefined;
  if (typeof projected !== "number" || actual === undefined) return Object.freeze({ assumption, projected, status: "insufficient-data" as const, rationale: "No authoritative measured value maps to this assumption yet." });
  const variance = projected ? Math.abs((actual - projected) / projected * 100) : Math.abs(actual - projected);
  const status = variance <= 5 ? "validated" as const : variance <= 15 ? "partially-validated" as const : "invalidated" as const;
  return Object.freeze({ assumption, projected, actual, status, rationale: `${variance.toFixed(1)}% absolute variance against measured performance.` });
}
function validationRank(value: string) { return value === "validated" ? 3 : value === "partially-validated" ? 2 : value === "invalidated" ? 1 : 0; }
function lessonFor(metric: ScenarioLearningProjection["metrics"][number], outcome: ScenarioOutcomeRevision) {
  if (metric.percentageVariance === undefined || Math.abs(metric.percentageVariance) < 5) return [];
  const category = metric.key === "occupancy" ? "operations" as const : ["annualRevenue", "adr"].includes(metric.key) ? "revenue" as const : "financial" as const;
  const direction = metric.percentageVariance > 0 ? "exceeded" : "fell below";
  return [Object.freeze({ category, statement: `${metric.label} ${direction} the scenario projection by ${Math.abs(metric.percentageVariance).toFixed(1)}%.`, evidence: outcome.evidence.map((item) => item.label), confidence: outcome.confidence })];
}
function recommendationSummary(recommendation: string, outcome?: ScenarioOutcomeRevision["recommendationOutcome"]) { return outcome ? `The ${recommendation.replaceAll("-", " ")} recommendation produced a ${outcome.replaceAll("-", " ")} observed outcome.` : "Recommendation effectiveness cannot be evaluated until an outcome is recorded."; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }

import { describe, expect, it } from "vitest";
import { Money, Percentage } from "@/features/portfolio";
import { evaluatePortfolioHealth, aggregateWeightedMetric, assessCapital, assessConcentration, fingerprintPortfolioHealthSnapshot } from "./engine";
import { PORTFOLIO_HEALTH_POLICY_V1 } from "./policy";
import { evaluatedAt, healthSnapshot, metric, window } from "./test-fixtures";

const evaluate = (snapshot = healthSnapshot()) => evaluatePortfolioHealth({ snapshot, policy: PORTFOLIO_HEALTH_POLICY_V1, observationWindow: window, evaluatedAt });
const assessment = (snapshot = healthSnapshot()) => {
  const result = evaluate(snapshot);
  if (result.status !== "evaluated") throw new Error("Expected evaluated result.");
  return result.assessment;
};

describe("Portfolio health engine", () => {
  it("returns an explainable, versioned, bounded assessment", () => {
    const value = assessment();
    expect(value.portfolioVersion).toBe(7);
    expect(value.policyVersion).toBe("portfolio-health-1");
    expect(value.dimensions).toHaveLength(7);
    expect(value.dimensions.every((dimension) => dimension.findings && dimension.dataGaps && dimension.observations)).toBe(true);
    expect(value.overall.breakdown.components).toHaveLength(7);
    expect(value.attentionPriorities.length).toBeLessThanOrEqual(5);
    expect(value.snapshotFingerprint).toMatch(/^phs-fnv1a-/);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("aggregates revenue and NOI, derives aggregate margin, and explains contribution shares", () => {
    const value = assessment();
    const performance = value.dimensions.find((item) => item.dimension === "performance")!;
    expect(performance.score.value).toBeGreaterThan(80);
    expect(value.contributionSummary.topRevenueContributors.map((item) => item.revenueShare?.value)).toEqual([60, 40]);
    expect(value.contributionSummary.topNoiContributors.map((item) => item.noiShare?.value)).toEqual([60, 40]);
  });

  it("weights occupancy and ADR by their economic denominators and refuses unsafe averaging", () => {
    expect(aggregateWeightedMetric([metric("observation-one", 80, { numerator: 240, denominator: 300 }), metric("observation-two", 60, { numerator: 120, denominator: 200 })]).value).toBe(72);
    expect(aggregateWeightedMetric([metric("observation-one", 80), metric("observation-two", 60)]).value).toBeNull();
    expect(aggregateWeightedMetric([metric("observation-one", 200, { numerator: 48_000, denominator: 240 }), metric("observation-two", 150, { numerator: 18_000, denominator: 120 })]).value).toBeCloseTo(183.3333);
  });

  it("makes mixed observation windows and currencies explicitly unevaluable", () => {
    const base = healthSnapshot();
    const wrongWindow = { start: new Date("2026-01-01"), end: new Date("2026-02-01") };
    const period = { ...base, properties: base.properties.map((item, index) => index ? item : { ...item, revenue: metric("observation-wrong-period", 10, { window: wrongWindow }) }) };
    const periodResult = evaluate(period);
    expect(periodResult.status).toBe("evaluated");
    const performanceResult = periodResult.status === "evaluated"
      ? periodResult.assessment.dimensionResults.find((item) => item.status === "evaluated" ? item.assessment.dimension === "performance" : item.dimension === "performance")
      : undefined;
    expect(performanceResult?.status === "insufficient-data" ? performanceResult.dataGaps[0].code : undefined).toBe("PORTFOLIO_PERFORMANCE_PERIOD_INCOMPATIBLE");
    const currency = { ...base, properties: base.properties.map((item, index) => index ? item : { ...item, revenue: metric("observation-eur", 10, { currency: "EUR" }) }) };
    const currencyResult = evaluate(currency);
    expect(currencyResult.status === "evaluated" && currencyResult.assessment.dataGaps.some((gap) => gap.code === "PORTFOLIO_CURRENCY_INCOMPATIBLE")).toBe(true);
  });

  it("keeps capital buckets distinct and derives utilization, coverage, and unfunded commitments", () => {
    const capital = assessCapital(healthSnapshot(), PORTFOLIO_HEALTH_POLICY_V1);
    expect(capital.available.amount).toBe(300_000);
    expect(capital.reserved.amount).toBe(100_000);
    expect(capital.committed.amount).toBe(100_000);
    expect(capital.allocated.amount).toBe(50_000);
    expect(capital.utilization?.value).toBeCloseTo(27.2727, 2);
    expect(capital.liquidityCoverage?.value).toBe(100);
    expect(capital.unfundedCommitment.amount).toBe(0);
  });

  it("detects overcommitment and applies a critical override", () => {
    const base = healthSnapshot();
    const result = assessment({ ...base, capital: { ...base.capital, available: Money.usd(10_000), committed: Money.usd(400_000), futureRequirements: Money.usd(100_000) } });
    expect(result.capitalAssessment.unfundedCommitment.amount).toBe(490_000);
    expect(result.risks.some((item) => item.code === "PORTFOLIO_CAPITAL_OVERCOMMITTED")).toBe(true);
    expect(result.overall.band).toBe("critical");
    expect(result.overall.score.value).toBeLessThanOrEqual(29);
  });

  it("uses explicit concentration, reports HHI/top shares, and treats one property as structural exposure", () => {
    const equal = assessConcentration("market", [
      { type: "market", key: "a", share: Percentage.create(50), basis: "revenue" },
      { type: "market", key: "b", share: Percentage.create(50), basis: "revenue" },
    ], PORTFOLIO_HEALTH_POLICY_V1)!;
    const dominant = assessConcentration("market", [
      { type: "market", key: "a", share: Percentage.create(90), basis: "revenue" },
      { type: "market", key: "b", share: Percentage.create(10), basis: "revenue" },
    ], PORTFOLIO_HEALTH_POLICY_V1)!;
    const single = assessConcentration("property", [{ type: "property", key: "a", share: Percentage.create(100), basis: "property-count" }], PORTFOLIO_HEALTH_POLICY_V1)!;
    expect(equal.concentrationIndex).toBe(5000);
    expect(dominant.concentrationIndex).toBe(8200);
    expect(dominant.score.value).toBeLessThan(equal.score.value);
    expect(single.findings[0]).toMatchObject({ severity: "informational", code: "PORTFOLIO_REVENUE_CONCENTRATED" });
  });

  it("keeps resilience distinct and identifies top-property dependency", () => {
    const base = healthSnapshot();
    const concentrated = { ...base, properties: base.properties.map((item, index) => ({ ...item, revenue: metric(`observation-concentrated-${index}`, index ? 5_000 : 95_000) })) };
    const value = assessment(concentrated);
    const resilience = value.dimensions.find((item) => item.dimension === "resilience")!;
    const diversification = value.dimensions.find((item) => item.dimension === "diversification")!;
    expect(resilience.dimension).not.toBe(diversification.dimension);
    expect(resilience.findings.some((item) => item.code === "PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY")).toBe(true);
  });

  it("weights active risk by severity and economic exposure, excluding resolved duplicates", () => {
    const base = healthSnapshot();
    const risks = [
      { riskId: "risk-1", severity: "critical" as const, status: "active" as const, subjectType: "property" as const, subjectId: "property-a", economicExposure: Percentage.create(60), blocking: true, observedAt: evaluatedAt },
      { riskId: "risk-1", severity: "critical" as const, status: "resolved" as const, subjectType: "property" as const, subjectId: "property-a", economicExposure: Percentage.create(60), blocking: false, observedAt: new Date(evaluatedAt.getTime() + 1) },
      { riskId: "risk-2", severity: "low" as const, status: "active" as const, subjectType: "portfolio" as const, blocking: false, observedAt: evaluatedAt },
    ];
    const resolved = assessment({ ...base, risks });
    expect(resolved.risks.some((item) => item.code === "PORTFOLIO_RISK_CRITICAL")).toBe(false);
    const critical = assessment({ ...base, risks: [risks[0]] });
    expect(critical.risks.some((item) => item.code === "PORTFOLIO_RISK_CRITICAL")).toBe(true);
    expect(critical.overall.band).not.toBe("healthy");
  });

  it("evaluates only explicit strategy and reports missing or unsupported strategy", () => {
    const aligned = assessment();
    expect(aligned.strengths.some((item) => item.code === "PORTFOLIO_STRATEGY_ALIGNED")).toBe(true);
    const base = healthSnapshot();
    const missing = assessment({ ...base, strategy: null, dataCoverage: { ...base.dataCoverage, sourceAvailable: { ...base.dataCoverage.sourceAvailable, strategy: false } } });
    expect(missing.dataGaps.some((item) => item.code === "PORTFOLIO_STRATEGY_MISSING")).toBe(true);
    const unsupported = assessment({ ...base, strategy: { strategyKind: "custom", updatedAt: evaluatedAt, objectives: [{ objectiveId: "custom", type: "custom", priority: "high" }] } });
    expect(unsupported.dataGaps.some((item) => item.code === "PORTFOLIO_STRATEGY_GOAL_UNSUPPORTED")).toBe(true);
  });

  it("scores data quality separately from confidence and never rewards missing data", () => {
    const complete = assessment();
    const base = healthSnapshot();
    const incomplete = assessment({
      ...base,
      properties: base.properties.map((item, index) => index ? { ...item, revenue: undefined, netOperatingIncome: undefined, dataCompleteness: Percentage.create(20) } : item),
      dataCoverage: { ...base.dataCoverage, coveredPropertyCount: 1, availableMetricCount: 2 },
    });
    expect(incomplete.confidence.score.value).toBeLessThan(complete.confidence.score.value);
    expect(incomplete.dimensions.find((item) => item.dimension === "data-quality")?.score.value).not.toBe(incomplete.confidence.score.value);
  });

  it("returns explicit empty and formation-stage results without a fabricated midpoint", () => {
    const base = healthSnapshot();
    const empty = evaluate({ ...base, properties: [], opportunities: [] });
    expect(empty).toMatchObject({ status: "insufficient-data", reason: "PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES", context: "empty" });
    const formation = evaluate({ ...base, properties: [], opportunities: [{ opportunityId: "opportunity-1", planningStatus: "approved", acquisitionRoute: "purchase", updatedAt: evaluatedAt }] });
    expect(formation).toMatchObject({ status: "insufficient-data", context: "formation-stage" });
    expect(formation).not.toHaveProperty("assessment.overall.score");
  });

  it("is deterministic across repeated evaluation and shuffled canonical inputs", () => {
    const base = healthSnapshot();
    const first = assessment(base);
    const second = assessment({ ...base, properties: [...base.properties].reverse(), exposures: [...base.exposures].reverse(), risks: [...base.risks].reverse(), observations: [...base.observations].reverse() });
    expect(second.snapshotFingerprint).toBe(first.snapshotFingerprint);
    expect(second.overall.score.value).toBe(first.overall.score.value);
    expect(second.attentionPriorities).toEqual(first.attentionPriorities);
    expect(fingerprintPortfolioHealthSnapshot(base)).toBe(fingerprintPortfolioHealthSnapshot(base));
  });
});

import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore, Score, ScoreBreakdown, ScoreComponent, Weight } from "@/platform/scoring";

import {
  PORTFOLIO_HEALTH_DIMENSIONS,
  type EvaluatePortfolioHealthInput,
  type PortfolioCapitalHealthAssessment,
  type PortfolioConcentrationAssessment,
  type PortfolioConcentrationExposure,
  type PortfolioContributionSummary,
  type PortfolioHealthAssessment,
  type PortfolioHealthBand,
  type PortfolioHealthConfidence,
  type PortfolioHealthDataGap,
  type PortfolioHealthDimension,
  type PortfolioHealthDimensionResult,
  type PortfolioHealthEvaluationResult,
  type PortfolioHealthFinding,
  type PortfolioHealthFindingCode,
  type PortfolioHealthPropertySource,
  type PortfolioHealthSnapshot,
  type PortfolioMetricObservation,
  type PortfolioPropertyContribution,
} from "./contracts";
import { bandForScore, type PortfolioHealthPolicy } from "./policy";

type PerformanceFacts = Readonly<{
  revenue: number | null;
  noi: number | null;
  margin: number | null;
  negativeNoiCount: number;
  positiveNoiCount: number;
  observations: readonly PortfolioMetricObservation[];
  compatible: boolean;
  currencyCompatible: boolean;
  windowCompatible: boolean;
}>;
type EvaluationContext = Readonly<{
  input: EvaluatePortfolioHealthInput;
  properties: readonly PortfolioHealthPropertySource[];
  performance: PerformanceFacts;
  capital: PortfolioCapitalHealthAssessment;
  concentrations: readonly PortfolioConcentrationAssessment[];
  contributions: PortfolioContributionSummary;
}>;

export function evaluatePortfolioHealth(input: EvaluatePortfolioHealthInput): PortfolioHealthEvaluationResult {
  validateInput(input);
  const properties = input.snapshot.properties.filter((property) => property.membershipStatus === "active").sort(by("propertyId"));
  const contextStage = properties.length === 0 && activeOpportunities(input.snapshot).length > 0 ? "formation-stage" : properties.length === 0 ? "empty" : "operating";
  if (properties.length === 0) {
    const emptyGap = gap("PORTFOLIO_PERFORMANCE_MISSING", "performance", "portfolio", ["activeProperties"], "blocking", 40);
    const result: Extract<PortfolioHealthEvaluationResult, { status: "insufficient-data" }> = freeze({
      status: "insufficient-data",
      reason: "PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES",
      dimensionResults: [insufficient("performance", [emptyGap])],
      dataGaps: [emptyGap],
      confidence: confidence(10, ["No active operating properties are available."]),
      context: contextStage,
    });
    return result;
  }

  const performance = aggregatePerformance(properties, input);
  const capital = assessCapital(input.snapshot, input.policy);
  const concentrations = assessAllConcentrations(input.snapshot, properties, input.policy);
  const contributions = buildContributionSummary(properties, input.policy);
  const context: EvaluationContext = { input, properties, performance, capital, concentrations, contributions };
  const dimensionResults = PORTFOLIO_HEALTH_DIMENSIONS.map((dimension) => evaluateDimension(dimension, context));
  const gaps = dimensionResults.flatMap((result) => result.status === "not-applicable" ? [] : result.status === "evaluated" ? result.assessment.dataGaps : result.dataGaps);
  const healthConfidence = assessOverallConfidence(input.snapshot, input.policy, input.evaluatedAt, gaps, !performance.compatible);
  const evaluated = dimensionResults.filter((result): result is Extract<PortfolioHealthDimensionResult, { status: "evaluated" }> => result.status === "evaluated");
  const evaluatedWeight = evaluated.reduce((sum, result) => sum + result.assessment.weight.percentage, 0);
  if (evaluated.length === 0 || evaluatedWeight < input.policy.coverage.minimumOverallPercentage) {
    const result: Extract<PortfolioHealthEvaluationResult, { status: "insufficient-data" }> = freeze({
      status: "insufficient-data",
      reason: "PORTFOLIO_HEALTH_COVERAGE_BELOW_MINIMUM",
      dimensionResults,
      dataGaps: sortedGaps(gaps).slice(0, input.policy.dataGapLimit),
      confidence: healthConfidence.assessment,
      context: "operating",
    });
    return result;
  }

  const breakdown = createBreakdown(evaluated);
  const allFindings = evaluated.flatMap((result) => result.assessment.findings);
  const override = applyCriticalOverrides(breakdown.score.value, input.policy, context, healthConfidence.assessment.score.value);
  const score = Score.create(override.score);
  const band = override.band ?? bandForScore(score.value, input.policy);
  const limitingDimensions = evaluated
    .filter((result) => result.assessment.score.value < input.policy.thresholds.stable)
    .sort((left, right) => left.assessment.score.value - right.assessment.score.value || left.assessment.dimension.localeCompare(right.assessment.dimension))
    .slice(0, 3)
    .map((result) => result.assessment.dimension);
  const findings = sortedFindings(allFindings).slice(0, input.policy.findingLimit);
  const boundedGaps = sortedGaps(gaps).slice(0, input.policy.dataGapLimit);
  const assessment: PortfolioHealthAssessment = freeze({
    portfolioId: input.snapshot.portfolio.portfolioId,
    portfolioVersion: input.snapshot.portfolio.portfolioVersion,
    policyVersion: input.policy.version,
    evaluatedAt: new Date(input.evaluatedAt),
    observationWindow: cloneWindow(input.observationWindow),
    overall: freeze({
      score,
      band,
      breakdown,
      limitingDimensions: Object.freeze(limitingDimensions),
      summaryCode: summaryCode(band),
    }),
    dimensions: Object.freeze(evaluated.map((result) => result.assessment)),
    dimensionResults: Object.freeze(dimensionResults),
    confidence: healthConfidence.assessment,
    healthConfidence,
    strengths: Object.freeze(findings.filter((finding) => finding.severity === "positive")),
    risks: Object.freeze(findings.filter((finding) => finding.severity === "high" || finding.severity === "critical")),
    warnings: Object.freeze(findings.filter((finding) => finding.severity === "warning" || finding.severity === "informational")),
    dataGaps: Object.freeze(boundedGaps),
    attentionPriorities: Object.freeze(buildPriorities(findings, input.policy.attentionPriorityLimit)),
    contributionSummary: contributions,
    capitalAssessment: capital,
    concentrationAssessments: Object.freeze(concentrations),
    snapshotFingerprint: fingerprintPortfolioHealthSnapshot(input.snapshot),
  });
  return freeze({ status: "evaluated", assessment });
}

function evaluateDimension(dimension: PortfolioHealthDimension, context: EvaluationContext): PortfolioHealthDimensionResult {
  switch (dimension) {
    case "performance": return evaluatePerformance(context);
    case "capital": return evaluatedDimension("capital", context.capital.score.value, context.capital.findings, context.capital.dataGaps, context);
    case "diversification": return evaluateDiversification(context);
    case "resilience": return evaluateResilience(context);
    case "risk": return evaluateRisk(context);
    case "strategic-alignment": return evaluateStrategy(context);
    case "data-quality": return evaluateDataQuality(context);
  }
}

function evaluatePerformance(context: EvaluationContext): PortfolioHealthDimensionResult {
  const { performance, input } = context;
  const gaps: PortfolioHealthDataGap[] = [];
  if (!performance.windowCompatible) gaps.push(gap("PORTFOLIO_PERFORMANCE_PERIOD_INCOMPATIBLE", "performance", "observation", ["window"], "blocking", 35));
  if (!performance.currencyCompatible) gaps.push(gap("PORTFOLIO_CURRENCY_INCOMPATIBLE", "performance", "observation", ["currency"], "blocking", 40));
  if (performance.observations.length < context.properties.length * 2) gaps.push(gap("PORTFOLIO_PERFORMANCE_MISSING", "performance", "portfolio", ["revenue", "netOperatingIncome"], "blocking", 30));
  if (gaps.some((value) => value.impact === "blocking")) return insufficient("performance", gaps);
  const margin = performance.margin ?? 0;
  const marginScore = clamp((margin + 10) * 3.5);
  const positiveShare = context.properties.length === 0 ? 0 : performance.positiveNoiCount / context.properties.length * 100;
  const score = round(marginScore * 0.65 + positiveShare * 0.35);
  const findings: PortfolioHealthFinding[] = [];
  if ((performance.noi ?? 0) < 0) findings.push(finding("PORTFOLIO_NOI_NEGATIVE", "performance", "critical", "portfolio", performance.noi ?? 0, "money-usd"));
  else if (score >= input.policy.thresholds.healthy) findings.push(finding("PORTFOLIO_PERFORMANCE_STRONG", "performance", "positive", "portfolio", score, "score"));
  if (performance.negativeNoiCount >= 2) findings.push(finding("PORTFOLIO_MULTIPLE_UNDERPERFORMERS", "performance", "high", "portfolio", performance.negativeNoiCount, "count"));
  if (margin < 10) findings.push(finding("PORTFOLIO_MARGIN_WEAK", "performance", "warning", "portfolio", margin, "percentage"));
  return evaluatedDimension("performance", score, findings, gaps, context);
}

function evaluateDiversification(context: EvaluationContext): PortfolioHealthDimensionResult {
  if (context.concentrations.length === 0) return insufficient("diversification", [gap("PORTFOLIO_EXPOSURE_MISSING", "diversification", "portfolio", ["exposures"], "material", 25)]);
  const scores = context.concentrations.map((value) => value.score.value);
  const score = round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  return evaluatedDimension("diversification", score, context.concentrations.flatMap((value) => value.findings), [], context);
}

function evaluateResilience(context: EvaluationContext): PortfolioHealthDimensionResult {
  const revenue = context.concentrations.find((value) => value.type === "revenue") ?? context.concentrations.find((value) => value.type === "property");
  const topShare = revenue?.topExposure?.share.value ?? 100;
  const reserveCoverage = context.capital.liquidityCoverage?.value ?? 0;
  const contributorShare = context.properties.length === 0 ? 0 : context.performance.positiveNoiCount / context.properties.length * 100;
  const score = round(clamp((100 - topShare) * 0.45 + Math.min(reserveCoverage, 100) * 0.3 + contributorShare * 0.25));
  const findings: PortfolioHealthFinding[] = [];
  const gaps: PortfolioHealthDataGap[] = [];
  if (!revenue) gaps.push(gap("PORTFOLIO_EXPOSURE_MISSING", "resilience", "portfolio", ["revenueExposure"], "material", 20));
  if (topShare >= 70) findings.push(finding("PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY", "resilience", topShare >= 90 ? "high" : "warning", "property", topShare, "percentage", revenue?.topExposure?.key));
  if (reserveCoverage < 50) findings.push(finding("PORTFOLIO_CAPITAL_RESERVE_LOW", "resilience", "warning", "capital", reserveCoverage, "percentage"));
  return evaluatedDimension("resilience", score, findings, gaps, context);
}

function evaluateRisk(context: EvaluationContext): PortfolioHealthDimensionResult {
  if (!context.input.snapshot.dataCoverage.sourceAvailable.risk) return insufficient("risk", [gap("PORTFOLIO_RISK_SOURCE_MISSING", "risk", "portfolio", ["risks"], "material", 25)]);
  const active = deduplicateRisks(context.input.snapshot.risks).filter((risk) => risk.status === "active");
  let penalty = 0;
  for (const risk of active) {
    const severity = { low: 5, moderate: 12, high: 25, critical: 45 }[risk.severity];
    const exposure = risk.economicExposure?.ratio ?? 0.5;
    penalty += severity * (0.5 + exposure) + (risk.blocking ? 15 : 0);
  }
  const score = round(clamp(100 - penalty));
  const findings = active.filter((risk) => risk.severity === "critical").map((risk) =>
    finding("PORTFOLIO_RISK_CRITICAL", "risk", "critical", risk.subjectType === "capital" ? "capital" : risk.subjectType, risk.economicExposure?.value, "percentage", risk.subjectId ?? risk.riskId, risk.observationId?.value),
  );
  if (active.length === 0) findings.push(finding("PORTFOLIO_RISK_MANAGED", "risk", "positive", "portfolio", 0, "count"));
  return evaluatedDimension("risk", score, findings, [], context);
}

function evaluateStrategy(context: EvaluationContext): PortfolioHealthDimensionResult {
  const strategy = context.input.snapshot.strategy;
  if (!strategy) return insufficient("strategic-alignment", [gap("PORTFOLIO_STRATEGY_MISSING", "strategic-alignment", "strategy", ["strategy", "objectives"], "material", 30)]);
  const supported = strategy.objectives.filter((objective) => objective.type !== "custom");
  const gaps = strategy.objectives.filter((objective) => objective.type === "custom").map((objective) =>
    gap("PORTFOLIO_STRATEGY_GOAL_UNSUPPORTED", "strategic-alignment", "strategy", ["objectiveEvaluation"], "minor", 5, objective.objectiveId),
  );
  if (supported.length === 0) return insufficient("strategic-alignment", [...gaps, gap("PORTFOLIO_STRATEGY_GOAL_UNSUPPORTED", "strategic-alignment", "strategy", ["supportedObjectives"], "material", 20)].slice(0, context.input.policy.dataGapLimit));
  const evaluations = supported.map((objective) => evaluateObjective(objective, context));
  const totalWeight = evaluations.reduce((sum, value) => sum + value.weight, 0);
  const score = round(evaluations.reduce((sum, value) => sum + value.score * value.weight, 0) / totalWeight);
  const findings = evaluations.map((value) => finding(
    value.aligned ? "PORTFOLIO_STRATEGY_ALIGNED" : "PORTFOLIO_STRATEGY_MISALIGNED",
    "strategic-alignment",
    value.aligned ? "positive" : value.weight >= 3 ? "high" : "warning",
    "portfolio",
    value.score,
    "score",
    value.objectiveId,
  ));
  return evaluatedDimension("strategic-alignment", score, findings, gaps, context);
}

function evaluateDataQuality(context: EvaluationContext): PortfolioHealthDimensionResult {
  const quality = assessOverallConfidence(context.input.snapshot, context.input.policy, context.input.evaluatedAt, [], !context.performance.compatible);
  const score = round(quality.coverage.value * 0.45 + quality.freshness.value * 0.25 + quality.provenance.value * 0.2 + quality.compatibility.value * 0.1);
  const findings: PortfolioHealthFinding[] = [];
  if (quality.coverage.value < 70) findings.push(finding("PORTFOLIO_DATA_COVERAGE_LOW", "data-quality", "warning", "data", quality.coverage.value, "percentage"));
  if (quality.freshness.value < 70) findings.push(finding("PORTFOLIO_DATA_STALE", "data-quality", "warning", "data", quality.freshness.value, "percentage"));
  const gaps = context.properties.filter((property) => property.dataCompleteness.value < 70).map((property) =>
    gap("PORTFOLIO_PROPERTY_DATA_INCOMPLETE", "data-quality", "property", ["canonicalMetrics"], "material", 10, property.propertyId),
  );
  return evaluatedDimension("data-quality", score, findings, gaps, context, quality.assessment);
}

function evaluatedDimension(
  dimension: PortfolioHealthDimension,
  scoreValue: number,
  findings: readonly PortfolioHealthFinding[],
  gaps: readonly PortfolioHealthDataGap[],
  context: EvaluationContext,
  providedConfidence?: ConfidenceAssessment,
): PortfolioHealthDimensionResult {
  const score = Score.create(clamp(scoreValue));
  const penalty = gaps.reduce((sum, value) => sum + value.confidencePenalty.value, 0);
  const dimensionConfidence = providedConfidence ?? confidence(clamp(90 - penalty), gaps.map((value) => value.code));
  const observationIds = dimensionObservationIds(dimension, context, findings);
  return freeze({
    status: "evaluated",
    assessment: freeze({
      dimension,
      score,
      band: bandForScore(score.value, context.input.policy),
      weight: context.input.policy.dimensionWeights[dimension],
      weightedContribution: round(context.input.policy.dimensionWeights[dimension].applyTo(score.value), 4),
      confidence: dimensionConfidence,
      observations: Object.freeze(context.input.snapshot.observations.filter((item) => observationIds.has(item.observationId.value)).map((item) => freeze({ observationId: item.observationId, role: "supporting" as const }))),
      findings: Object.freeze(sortedFindings(findings).slice(0, context.input.policy.findingLimit)),
      dataGaps: Object.freeze(sortedGaps(gaps).slice(0, context.input.policy.dataGapLimit)),
    }),
  });
}

function dimensionObservationIds(dimension: PortfolioHealthDimension, context: EvaluationContext, findings: readonly PortfolioHealthFinding[]): ReadonlySet<string> {
  const ids = new Set(findings.flatMap((item) => item.evidence.filter((evidence) => evidence.kind === "observation").map((evidence) => evidence.referenceId)));
  if (dimension === "performance") for (const observation of context.performance.observations) ids.add(observation.observationId.value);
  if (dimension === "diversification" || dimension === "resilience") for (const exposure of context.input.snapshot.exposures) if (exposure.observationId) ids.add(exposure.observationId.value);
  if (dimension === "risk") for (const risk of context.input.snapshot.risks) if (risk.observationId) ids.add(risk.observationId.value);
  if (dimension === "data-quality") for (const observation of context.input.snapshot.observations) ids.add(observation.observationId.value);
  return ids;
}

export function assessCapital(snapshot: PortfolioHealthSnapshot, policy: PortfolioHealthPolicy): PortfolioCapitalHealthAssessment {
  const value = snapshot.capital;
  const future = value.futureRequirements?.amount;
  const activeOpportunityCommitments = activeOpportunities(snapshot).reduce((sum, opportunity) => sum + (opportunity.committedCapital?.amount ?? 0), 0);
  const committed = Math.max(value.committed.amount, activeOpportunityCommitments);
  const obligations = committed + (future ?? 0);
  const liquid = value.available.amount;
  const unfunded = Math.max(0, obligations - liquid);
  const utilizationBase = liquid + value.reserved.amount + committed + value.allocated.amount;
  const utilization = utilizationBase === 0 ? null : Percentage.create(clamp((committed + value.allocated.amount) / utilizationBase * 100));
  const liquidityCoverage = obligations === 0 ? null : Percentage.create(clamp(liquid / obligations * 100));
  const gaps: PortfolioHealthDataGap[] = [];
  if (future === undefined) gaps.push(gap("PORTFOLIO_CAPITAL_REQUIREMENT_UNKNOWN", "capital", "capital", ["futureRequirements"], "material", 20));
  let score = obligations === 0 ? 85 : clamp(liquid / obligations * 75 + Math.min(value.reserved.amount / obligations, 0.25) * 100);
  if (unfunded > 0) score = Math.min(score, 25);
  const findings: PortfolioHealthFinding[] = [];
  if (unfunded > 0) findings.push(finding("PORTFOLIO_CAPITAL_OVERCOMMITTED", "capital", "critical", "capital", unfunded, "money-usd"));
  else if ((liquidityCoverage?.value ?? 100) >= 100) findings.push(finding("PORTFOLIO_CAPITAL_RESILIENT", "capital", "positive", "capital", liquidityCoverage?.value ?? 100, "percentage"));
  if (obligations > 0 && value.reserved.amount / obligations < 0.1) findings.push(finding("PORTFOLIO_CAPITAL_RESERVE_LOW", "capital", "warning", "capital", value.reserved.amount, "money-usd"));
  return freeze({
    available: value.available,
    reserved: value.reserved,
    committed: value.committed,
    allocated: value.allocated,
    ...(value.futureRequirements ? { futureRequirements: value.futureRequirements } : {}),
    utilization,
    liquidityCoverage,
    unfundedCommitment: Money.usd(roundMoney(unfunded)),
    score: Score.create(round(score)),
    band: bandForScore(score, policy),
    findings: Object.freeze(findings),
    dataGaps: Object.freeze(gaps),
  });
}

export function assessConcentration(
  type: PortfolioConcentrationAssessment["type"],
  exposures: readonly PortfolioConcentrationExposure[],
  policy: PortfolioHealthPolicy,
): PortfolioConcentrationAssessment | null {
  const selected = exposures.filter((value) => value.type === type).sort((a, b) => b.share.value - a.share.value || a.key.localeCompare(b.key));
  if (selected.length === 0) return null;
  const top = selected[0];
  const hhi = round(selected.reduce((sum, value) => sum + value.share.ratio ** 2, 0) * 10_000, 2);
  const topThree = Percentage.create(clamp(selected.slice(0, 3).reduce((sum, value) => sum + value.share.value, 0)));
  const score = selected.length === 1 ? policy.concentration.singlePropertyScore : round(clamp(100 - Math.max(0, (hhi - 1000) / 90)));
  const severity = top.share.value >= policy.concentration.criticalTopShare ? "high" : top.share.value >= policy.concentration.atRiskTopShare ? "warning" : "informational";
  const findings: PortfolioHealthFinding[] = [];
  if (top.share.value >= policy.concentration.attentionTopShare) {
    const code: PortfolioHealthFindingCode = type === "market" ? "PORTFOLIO_MARKET_CONCENTRATED" : type === "revenue" || type === "property" ? "PORTFOLIO_REVENUE_CONCENTRATED" : "PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY";
    findings.push(finding(code, "diversification", selected.length === 1 ? "informational" : severity, type === "market" ? "market" : "portfolio", top.share.value, "percentage", top.key, top.observationId?.value));
  } else if (type === "revenue") findings.push(finding("PORTFOLIO_REVENUE_DIVERSIFIED", "diversification", "positive", "portfolio", top.share.value, "percentage"));
  return freeze({ type, score: Score.create(score), band: bandForScore(score, policy), topExposure: top, exposures: Object.freeze(selected.slice(0, policy.concentrationExposureLimit)), topThreeShare: topThree, concentrationIndex: hhi, findings: Object.freeze(findings.slice(0, policy.findingLimit)) });
}

function assessAllConcentrations(snapshot: PortfolioHealthSnapshot, properties: readonly PortfolioHealthPropertySource[], policy: PortfolioHealthPolicy): readonly PortfolioConcentrationAssessment[] {
  const explicit = [...snapshot.exposures];
  if (!explicit.some((value) => value.type === "revenue")) {
    const revenues = properties.filter((property) => property.revenue);
    const total = revenues.reduce((sum, property) => sum + property.revenue!.value, 0);
    if (total > 0) for (const property of revenues) explicit.push(freeze({ type: "revenue", key: property.propertyId, share: Percentage.create(property.revenue!.value / total * 100), basis: "revenue", observationId: property.revenue!.observationId }));
  }
  if (!explicit.some((value) => value.type === "property")) {
    for (const property of properties) explicit.push(freeze({ type: "property", key: property.propertyId, share: Percentage.create(100 / properties.length), basis: "property-count" }));
  }
  const types = [...new Set(explicit.map((value) => value.type))].sort();
  return Object.freeze(types.map((type) => assessConcentration(type, explicit, policy)).filter((value): value is PortfolioConcentrationAssessment => value !== null));
}

function aggregatePerformance(properties: readonly PortfolioHealthPropertySource[], input: EvaluatePortfolioHealthInput): PerformanceFacts {
  const revenues = properties.flatMap((property) => property.revenue ? [property.revenue] : []);
  const nois = properties.flatMap((property) => property.netOperatingIncome ? [property.netOperatingIncome] : []);
  const metrics = [...revenues, ...nois];
  const windowCompatible = metrics.every((metric) => windowsEqual(metric.window, input.observationWindow));
  const currencyCompatible = new Set(metrics.map((metric) => metric.currency ?? "USD")).size <= 1 && metrics.every((metric) => (metric.currency ?? "USD") === input.snapshot.portfolio.reportingCurrency);
  const compatible = windowCompatible && currencyCompatible;
  const revenue = revenues.length === properties.length && compatible ? sumMoneyValues(revenues.map((value) => value.value)) : null;
  const noi = nois.length === properties.length && compatible ? sumMoneyValues(nois.map((value) => value.value)) : null;
  return freeze({
    revenue,
    noi,
    margin: revenue !== null && revenue !== 0 && noi !== null ? noi / revenue * 100 : null,
    negativeNoiCount: nois.filter((value) => value.value < 0).length,
    positiveNoiCount: nois.filter((value) => value.value > 0).length,
    observations: Object.freeze(metrics),
    compatible,
    currencyCompatible,
    windowCompatible,
  });
}

export function aggregateWeightedMetric(observations: readonly PortfolioMetricObservation[]): Readonly<{ value: number | null; fallbackUsed: boolean }> {
  if (observations.length === 0 || observations.some((item) => item.denominator === undefined || item.denominator <= 0)) return freeze({ value: null, fallbackUsed: false });
  const denominator = observations.reduce((sum, item) => sum + item.denominator!, 0);
  const numerator = observations.reduce((sum, item) => sum + (item.numerator ?? item.value * item.denominator!), 0);
  const ratio = denominator === 0 ? null : numerator / denominator;
  const percentageMetric = observations.every((item) => item.value >= 0 && item.value <= 100 && (item.numerator ?? Number.POSITIVE_INFINITY) <= item.denominator!);
  return freeze({ value: ratio === null ? null : ratio * (percentageMetric ? 100 : 1), fallbackUsed: false });
}

function buildContributionSummary(properties: readonly PortfolioHealthPropertySource[], policy: PortfolioHealthPolicy): PortfolioContributionSummary {
  const totalRevenue = properties.reduce((sum, item) => sum + (item.revenue?.value ?? 0), 0);
  const totalNoi = properties.reduce((sum, item) => sum + Math.max(0, item.netOperatingIncome?.value ?? 0), 0);
  const totalCapital = properties.reduce((sum, item) => sum + (item.capitalBasis?.amount ?? 0), 0);
  const contributions: PortfolioPropertyContribution[] = properties.map((property) => {
    const contribution = property.netOperatingIncome === undefined ? "unknown" : property.netOperatingIncome.value < 0 ? "negative" : property.netOperatingIncome.value > 0 ? "positive" : "neutral";
    const drivers = contribution === "negative" ? [{ code: "PORTFOLIO_NOI_NEGATIVE" as const, subjectId: property.propertyId }] : [];
    return freeze({
      propertyId: property.propertyId,
      ...(property.revenue && totalRevenue > 0 ? { revenueShare: Percentage.create(property.revenue.value / totalRevenue * 100) } : {}),
      ...(property.netOperatingIncome && totalNoi > 0 ? { noiShare: Percentage.create(Math.max(0, property.netOperatingIncome.value) / totalNoi * 100) } : {}),
      ...(property.capitalBasis && totalCapital > 0 ? { capitalShare: Percentage.create(property.capitalBasis.amount / totalCapital * 100) } : {}),
      contribution,
      healthDrivers: Object.freeze(drivers),
      dataQuality: confidence(property.dataCompleteness.value, [`Property data completeness is ${round(property.dataCompleteness.value)}%.`]),
    });
  });
  const revenueSorted = [...contributions].filter((value) => value.revenueShare).sort((a, b) => b.revenueShare!.value - a.revenueShare!.value || a.propertyId.localeCompare(b.propertyId));
  const noiSorted = [...contributions].filter((value) => value.noiShare).sort((a, b) => b.noiShare!.value - a.noiShare!.value || a.propertyId.localeCompare(b.propertyId));
  return freeze({
    topRevenueContributors: Object.freeze(revenueSorted.slice(0, policy.contributionLimit)),
    topNoiContributors: Object.freeze(noiSorted.slice(0, policy.contributionLimit)),
    negativeContributors: Object.freeze(contributions.filter((value) => value.contribution === "negative").sort(by("propertyId")).slice(0, policy.contributionLimit)),
    unknownContributors: Object.freeze(contributions.filter((value) => value.contribution === "unknown").sort(by("propertyId")).slice(0, policy.contributionLimit)),
    concentratedOnSingleProperty: properties.length === 1 || (revenueSorted[0]?.revenueShare?.value ?? 0) >= policy.concentration.atRiskTopShare,
  });
}

function assessOverallConfidence(snapshot: PortfolioHealthSnapshot, policy: PortfolioHealthPolicy, evaluatedAt: Date, gaps: readonly PortfolioHealthDataGap[], incompatible: boolean): PortfolioHealthConfidence {
  const coverage = ratio(snapshot.dataCoverage.coveredPropertyCount, snapshot.dataCoverage.expectedPropertyCount, snapshot.dataCoverage.availableMetricCount, snapshot.dataCoverage.expectedMetricCount);
  const dated = [...snapshot.properties.map((value) => value.updatedAt), ...snapshot.observations.map((value) => value.observedAt), snapshot.capital.capturedAt];
  const freshness = dated.length === 0 ? 0 : dated.reduce((sum, date) => sum + freshnessScore(date, evaluatedAt, policy), 0) / dated.length;
  const provenance = snapshot.observations.length === 0 ? 40 : snapshot.observations.reduce((sum, value) => sum + ({ verified: 100, traceable: 75, unverified: 35 }[value.provenance]), 0) / snapshot.observations.length;
  const compatibility = incompatible ? 0 : 100;
  const penalties = gaps.map((value) => freeze({ code: value.code, points: value.confidencePenalty.value, dimension: value.dimension }));
  const raw = policy.confidence.coverageWeight.applyTo(coverage) + policy.confidence.freshnessWeight.applyTo(freshness) + policy.confidence.provenanceWeight.applyTo(provenance) + policy.confidence.compatibilityWeight.applyTo(compatibility);
  const score = clamp(raw - Math.min(40, penalties.reduce((sum, value) => sum + value.points, 0)));
  return freeze({
    assessment: confidence(round(score), penalties.length ? penalties.map((value) => value.code) : ["Canonical source coverage, freshness, provenance, and compatibility assessed."]),
    coverage: Percentage.create(round(coverage)),
    freshness: Percentage.create(round(freshness)),
    provenance: Percentage.create(round(provenance)),
    compatibility: Percentage.create(round(compatibility)),
    penalties: Object.freeze(penalties),
  });
}

export function fingerprintPortfolioHealthSnapshot(snapshot: PortfolioHealthSnapshot): string {
  const canonical = {
    portfolio: { id: snapshot.portfolio.portfolioId.value, version: snapshot.portfolio.portfolioVersion, currency: snapshot.portfolio.reportingCurrency },
    properties: [...snapshot.properties].sort(by("propertyId")).map((item) => ({
      id: item.propertyId, status: item.membershipStatus, market: item.marketKey, geography: item.geographicKey, type: item.propertyType, model: item.operatingModel,
      capital: item.capitalBasis?.amount, revenue: metricFingerprint(item.revenue), noi: metricFingerprint(item.netOperatingIncome), occupancy: metricFingerprint(item.occupancy), adr: metricFingerprint(item.adr),
      risk: item.riskLevel, completeness: item.dataCompleteness.value, updatedAt: item.updatedAt.toISOString(),
    })),
    opportunities: [...snapshot.opportunities].sort(by("opportunityId")).map((item) => ({ id: item.opportunityId, status: item.planningStatus, route: item.acquisitionRoute, committed: item.committedCapital?.amount, required: item.expectedCapitalRequirement?.amount, market: item.marketKey, type: item.propertyType, risk: item.riskLevel, updatedAt: item.updatedAt.toISOString() })),
    capital: { available: snapshot.capital.available.amount, reserved: snapshot.capital.reserved.amount, committed: snapshot.capital.committed.amount, allocated: snapshot.capital.allocated.amount, future: snapshot.capital.futureRequirements?.amount, capturedAt: snapshot.capital.capturedAt.toISOString() },
    exposures: [...snapshot.exposures].sort((a, b) => `${a.type}:${a.key}`.localeCompare(`${b.type}:${b.key}`)).map((item) => ({ type: item.type, key: item.key, share: item.share.value, basis: item.basis, observationId: item.observationId?.value })),
    risks: [...snapshot.risks].sort(by("riskId")).map((item) => ({ id: item.riskId, severity: item.severity, status: item.status, subject: item.subjectType, subjectId: item.subjectId, exposure: item.economicExposure?.value, blocking: item.blocking, observedAt: item.observedAt.toISOString(), observationId: item.observationId?.value })),
    strategy: snapshot.strategy ? { kind: snapshot.strategy.strategyKind, updatedAt: snapshot.strategy.updatedAt.toISOString(), objectives: [...snapshot.strategy.objectives].sort(by("objectiveId")) } : null,
    observations: [...snapshot.observations].sort((a, b) => a.observationId.value.localeCompare(b.observationId.value)).map((item) => ({ id: item.observationId.value, type: item.type, subjectId: item.subjectId, observedAt: item.observedAt.toISOString(), confidence: item.confidence.score.value, provenance: item.provenance })),
    coverage: snapshot.dataCoverage,
    capturedAt: snapshot.capturedAt.toISOString(),
  };
  const text = JSON.stringify(canonical);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `phs-fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function createBreakdown(results: readonly Extract<PortfolioHealthDimensionResult, { status: "evaluated" }>[]): ScoreBreakdown {
  const total = results.reduce((sum, result) => sum + result.assessment.weight.ratio, 0);
  return ScoreBreakdown.create({
    key: "portfolio-health",
    label: "Portfolio Health",
    components: results.map((result) => ScoreComponent.create({
      key: result.assessment.dimension,
      label: result.assessment.dimension,
      score: result.assessment.score,
      weight: Weight.create(result.assessment.weight.ratio / total),
      description: `Policy weight ${result.assessment.weight.percentage}%; normalized only across evaluated dimensions.`,
    })),
  });
}

function applyCriticalOverrides(score: number, policy: PortfolioHealthPolicy, context: EvaluationContext, confidenceScore: number): { score: number; band?: PortfolioHealthBand } {
  const conditions = new Set<string>();
  if ((context.performance.noi ?? 0) < 0) conditions.add("negative-aggregate-noi");
  if (context.capital.unfundedCommitment.amount > 0) conditions.add("capital-overcommitted");
  if (context.input.snapshot.risks.some((risk) => risk.status === "active" && risk.severity === "critical")) conditions.add("critical-active-risk");
  if (confidenceScore < context.input.policy.coverage.minimumOverallPercentage) conditions.add("confidence-below-minimum");
  let capped = score;
  let band: PortfolioHealthBand | undefined;
  for (const override of policy.criticalOverrides) if (conditions.has(override.condition)) {
    if (override.maximumScore) capped = Math.min(capped, override.maximumScore.value);
    if (!band || bandRank(override.maximumBand) > bandRank(band)) band = override.maximumBand;
  }
  return { score: round(capped), ...(band ? { band } : {}) };
}

function evaluateObjective(objective: NonNullable<PortfolioHealthSnapshot["strategy"]>["objectives"][number], context: EvaluationContext): { objectiveId: string; score: number; aligned: boolean; weight: number } {
  const weight = { low: 1, normal: 2, high: 3 }[objective.priority];
  let aligned = false;
  switch (objective.type) {
    case "maximum-market-concentration": aligned = (context.concentrations.find((item) => item.type === "market")?.topExposure?.share.value ?? 100) <= (objective.targetNumber ?? 0); break;
    case "maximum-property-revenue-share": aligned = (context.concentrations.find((item) => item.type === "revenue")?.topExposure?.share.value ?? 100) <= (objective.targetNumber ?? 0); break;
    case "minimum-liquidity-coverage": aligned = (context.capital.liquidityCoverage?.value ?? 0) >= (objective.targetNumber ?? 100); break;
    case "target-market": aligned = context.input.snapshot.exposures.some((item) => item.type === "market" && item.key === objective.targetKey); break;
    case "target-property-type": aligned = context.properties.some((item) => item.propertyType === objective.targetKey); break;
    case "portfolio-size": aligned = context.properties.length >= (objective.targetNumber ?? 0); break;
    case "custom": aligned = false;
  }
  return { objectiveId: objective.objectiveId, score: aligned ? 100 : 25, aligned, weight };
}

function finding(code: PortfolioHealthFindingCode, dimension: PortfolioHealthDimension, severity: PortfolioHealthFinding["severity"], subject: PortfolioHealthFinding["subject"], value?: number, unit: NonNullable<PortfolioHealthFinding["value"]>["unit"] = "score", subjectId?: string, observationId?: string): PortfolioHealthFinding {
  const evidence = [
    ...(observationId ? [{ kind: "observation" as const, referenceId: observationId }] : []),
    { kind: subject === "property" ? "property" as const : "calculation" as const, referenceId: subjectId ?? code },
  ];
  return freeze({ code, dimension, severity, subject, ...(subjectId ? { subjectId } : {}), evidence: Object.freeze(evidence), ...(value !== undefined ? { value: freeze({ value: round(value, 4), unit }) } : {}), resolvable: severity !== "positive" });
}
function gap(code: PortfolioHealthDataGap["code"], dimension: PortfolioHealthDimension, subjectType: PortfolioHealthDataGap["subjectType"], missingFields: readonly string[], impact: PortfolioHealthDataGap["impact"], penalty: number, subjectId?: string): PortfolioHealthDataGap {
  return freeze({ code, dimension, subjectType, ...(subjectId ? { subjectId } : {}), impact, missingFields: Object.freeze([...missingFields].sort()), confidencePenalty: Percentage.create(penalty) });
}
function insufficient(dimension: PortfolioHealthDimension, gaps: readonly PortfolioHealthDataGap[]): PortfolioHealthDimensionResult {
  return freeze({ status: "insufficient-data", dimension, confidence: confidence(clamp(50 - gaps.reduce((sum, value) => sum + value.confidencePenalty.value, 0)), gaps.map((value) => value.code)), dataGaps: Object.freeze(sortedGaps(gaps)) });
}
function confidence(value: number, rationale: readonly string[]): ConfidenceAssessment {
  return ConfidenceAssessment.create({ score: ConfidenceScore.create(clamp(value)), rationale });
}
function buildPriorities(findings: readonly PortfolioHealthFinding[], limit: number) {
  const ranks = { critical: 0, high: 1, warning: 2 };
  return findings.filter((item): item is PortfolioHealthFinding & { severity: "critical" | "high" | "warning" } => item.severity in ranks)
    .sort((a, b) => ranks[a.severity] - ranks[b.severity] || (b.value?.value ?? 0) - (a.value?.value ?? 0) || a.code.localeCompare(b.code) || (a.subjectId ?? "").localeCompare(b.subjectId ?? ""))
    .slice(0, limit)
    .map((item, index) => freeze({ rank: index + 1, dimension: item.dimension, findingCode: item.code, severity: item.severity, subjectType: item.subject, ...(item.subjectId ? { subjectId: item.subjectId } : {}), evidence: item.evidence }));
}
function activeOpportunities(snapshot: PortfolioHealthSnapshot) {
  return snapshot.opportunities.filter((value) => ["approved", "acquiring"].includes(value.planningStatus));
}
function deduplicateRisks(risks: PortfolioHealthSnapshot["risks"]) {
  const values = new Map<string, PortfolioHealthSnapshot["risks"][number]>();
  for (const risk of [...risks].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.riskId.localeCompare(b.riskId))) values.set(risk.riskId, risk);
  return [...values.values()];
}
function validateInput(input: EvaluatePortfolioHealthInput) {
  if (Number.isNaN(input.evaluatedAt.getTime()) || input.observationWindow.start >= input.observationWindow.end) throw new TypeError("Portfolio health evaluation dates are invalid.");
  if (input.snapshot.portfolio.portfolioVersion < 1) throw new RangeError("Portfolio version must be positive.");
  const money = [input.snapshot.capital.available, input.snapshot.capital.reserved, input.snapshot.capital.committed, input.snapshot.capital.allocated, ...(input.snapshot.capital.futureRequirements ? [input.snapshot.capital.futureRequirements] : [])];
  if (money.some((value) => value.isNegative() || value.currency !== input.snapshot.portfolio.reportingCurrency)) throw new RangeError("Portfolio capital is invalid or uses an incompatible currency.");
}
function windowsEqual(a: PortfolioMetricObservation["window"], b: PortfolioMetricObservation["window"]) {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
function ratio(coveredProperties: number, expectedProperties: number, availableMetrics: number, expectedMetrics: number) {
  const property = expectedProperties === 0 ? 0 : coveredProperties / expectedProperties;
  const metric = expectedMetrics === 0 ? 0 : availableMetrics / expectedMetrics;
  return clamp((property + metric) / 2 * 100);
}
function freshnessScore(date: Date, evaluatedAt: Date, policy: PortfolioHealthPolicy) {
  const days = Math.max(0, evaluatedAt.getTime() - date.getTime()) / 86_400_000;
  return days <= policy.freshness.currentDays ? 100 : days <= policy.freshness.agingDays ? 65 : 20;
}
function metricFingerprint(value?: PortfolioMetricObservation) {
  return value ? { id: value.observationId.value, value: value.value, currency: value.currency, numerator: value.numerator, denominator: value.denominator, window: [value.window.start.toISOString(), value.window.end.toISOString()], confidence: value.confidence.score.value, provenance: value.provenance, observedAt: value.observedAt.toISOString() } : null;
}
function sortedFindings(values: readonly PortfolioHealthFinding[]) {
  const order = { critical: 0, high: 1, warning: 2, informational: 3, positive: 4 };
  return [...values].sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code) || (a.subjectId ?? "").localeCompare(b.subjectId ?? ""));
}
function sortedGaps(values: readonly PortfolioHealthDataGap[]) {
  const order = { blocking: 0, material: 1, minor: 2 };
  return [...values].sort((a, b) => order[a.impact] - order[b.impact] || a.code.localeCompare(b.code) || (a.subjectId ?? "").localeCompare(b.subjectId ?? ""));
}
function summaryCode(band: PortfolioHealthBand) {
  return ({ healthy: "PORTFOLIO_HEALTH_STRONG", stable: "PORTFOLIO_HEALTH_SOUND", attention: "PORTFOLIO_HEALTH_REQUIRES_ATTENTION", "at-risk": "PORTFOLIO_HEALTH_MATERIALLY_AT_RISK", critical: "PORTFOLIO_HEALTH_CRITICAL" } as const)[band];
}
function bandRank(band: PortfolioHealthBand) {
  return ({ healthy: 0, stable: 1, attention: 2, "at-risk": 3, critical: 4 } as const)[band];
}
function sumMoneyValues(values: readonly number[]) {
  return values.reduce((sum, value) => sum + Math.round((value + Number.EPSILON) * 100), 0) / 100;
}
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function round(value: number, places = 2) { const factor = 10 ** places; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function cloneWindow(window: EvaluatePortfolioHealthInput["observationWindow"]) { return freeze({ start: new Date(window.start), end: new Date(window.end), ...(window.comparisonStart ? { comparisonStart: new Date(window.comparisonStart) } : {}), ...(window.comparisonEnd ? { comparisonEnd: new Date(window.comparisonEnd) } : {}) }); }
function by<K extends string>(key: K) { return (a: Record<K, string>, b: Record<K, string>) => a[key].localeCompare(b[key]); }
function freeze<T extends object>(value: T): Readonly<T> { return Object.freeze(value); }

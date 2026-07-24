import { Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore, Score } from "@/platform/scoring";
import type {
  RecommendationConditionPerformance, RecommendationEffectiveness,
  RecommendationEffectivenessAssessment, RecommendationEffectivenessAssessmentId,
  RecommendationEffectivenessConfidence, RecommendationEffectivenessPolicy,
  RecommendationEvidenceSummary, RecommendationHarmSummary, RecommendationInstance,
  RecommendationLearningReadiness, RecommendationOutcomeDistribution,
  RecommendationRepeatabilityAssessment, RecommendationSampleAssessment,
  RecommendationSuccessMetrics, RecommendationTrendAssessment, RecommendationTypeId,
} from "./model";
import { validateRecommendationEffectivenessPolicy } from "./policy";
import type { OutcomeOwnerId } from "../../outcomes";

export type EvaluateRecommendationEffectivenessInput = Readonly<{
  assessmentId: RecommendationEffectivenessAssessmentId;
  ownerId: OutcomeOwnerId;
  recommendationType: RecommendationTypeId;
  instances: readonly RecommendationInstance[];
  policy: RecommendationEffectivenessPolicy;
  evaluatedAt: Date;
  previousAssessment?: RecommendationEffectivenessAssessment;
}>;

export function evaluateRecommendationEffectiveness(input: EvaluateRecommendationEffectivenessInput): RecommendationEffectivenessAssessment {
  validateRecommendationEffectivenessPolicy(input.policy);
  validDate(input.evaluatedAt);
  validateInstances(input);
  const instances = [...input.instances].sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime() || a.recommendationId.localeCompare(b.recommendationId));
  const distribution = distributionOf(instances);
  const sample = sampleOf(distribution, input.policy);
  const metrics = metricsOf(distribution, sample);
  const evidence = evidenceOf(instances);
  const harm = harmOf(instances, metrics);
  const repeatability = repeatabilityOf(instances, metrics, sample, input.policy);
  const confidence = confidenceOf(instances, sample, evidence, repeatability, input.policy);
  const effectiveness = classify(metrics, sample, harm, input.policy);
  const quality = qualityOf(effectiveness, repeatability, sample, harm);
  const applicability = applicabilityOf(instances);
  const learningReadiness = readinessOf(effectiveness, sample, metrics, confidence, repeatability, input.policy);
  const trend = trendOf(input.previousAssessment, effectiveness, metrics, confidence, distribution, input.policy);
  const version = input.previousAssessment ? input.previousAssessment.version + 1 : 1;
  return freeze({
    id: input.assessmentId, ownerId: input.ownerId, recommendationType: input.recommendationType,
    policyVersion: input.policy.version, evaluatedAt: new Date(input.evaluatedAt), version,
    overall: Object.freeze({ effectiveness, quality, metrics, sample }),
    outcomeDistribution: distribution, repeatability, confidence, trends: trend,
    evidence, harm, applicability, learningReadiness,
    lineage: Object.freeze({
      recommendationIds: Object.freeze(instances.map(value => value.recommendationId)),
      decisionIds: Object.freeze(instances.map(value => value.decisionId)),
      outcomeIds: Object.freeze(instances.map(value => value.outcomeId)),
      outcomeAssessmentIds: Object.freeze(instances.map(value => value.outcomeAssessmentId)),
      ...(input.previousAssessment ? { previousAssessmentId: input.previousAssessment.id } : {}),
    }),
  });
}

export function compareRecommendationEffectiveness(previous: RecommendationEffectivenessAssessment, current: RecommendationEffectivenessAssessment) {
  if (!previous.recommendationType.equals(current.recommendationType)) throw new TypeError("Effectiveness comparisons require the same recommendation type.");
  if (previous.policyVersion !== current.policyVersion) return freeze({ classification: "not-comparable" as const, comparable: false, changes: Object.freeze([]) });
  const previousRate = previous.overall.metrics.successRate?.value ?? null;
  const currentRate = current.overall.metrics.successRate?.value ?? null;
  const direction = current.trends.direction;
  return freeze({
    classification: direction === "improving" ? "improved" as const : direction === "declining" ? "declined" as const : direction === "stable" ? "stable" as const : "not-comparable" as const,
    comparable: current.trends.comparableAssessment,
    newEvidenceCount: current.outcomeDistribution.totalEvaluated - previous.outcomeDistribution.totalEvaluated,
    successRateChange: previousRate === null || currentRate === null ? null : currentRate - previousRate,
    harmRateChange: rateChange(previous.overall.metrics.harmRate, current.overall.metrics.harmRate),
    confidenceChange: current.confidence.assessment.score.value - previous.confidence.assessment.score.value,
    changes: current.trends.changes,
  });
}

function validateInstances(input: EvaluateRecommendationEffectivenessInput): void {
  const ids = new Set<string>();
  for (const instance of input.instances) {
    if (!instance.recommendationType.equals(input.recommendationType)) throw new TypeError("Recommendation instance type is incompatible with the evaluation.");
    if (!instance.assessment.ownerId.equals(input.ownerId)) throw new TypeError("Recommendation instance owner is incompatible with the evaluation.");
    if (!["closed", "inconclusive"].includes(instance.outcomeStatus)) throw new TypeError("Only completed Outcome assessments are eligible.");
    if (!instance.assessment.id.equals(instance.outcomeAssessmentId) || !instance.assessment.outcomeId.equals(instance.outcomeId)) throw new TypeError("Recommendation instance assessment lineage is invalid.");
    if (ids.has(instance.recommendationId)) throw new TypeError("Duplicate recommendation instance is not allowed.");
    ids.add(instance.recommendationId);
    validDate(instance.assessedAt);
  }
}
function distributionOf(instances: readonly RecommendationInstance[]): RecommendationOutcomeDistribution {
  const count = (classification: string) => instances.filter(value => value.assessment.classification === classification).length;
  return Object.freeze({
    successful: count("successful"), partiallySuccessful: count("partially-successful"),
    unsuccessful: count("unsuccessful"), harmful: count("harmful"),
    inconclusive: count("inconclusive"), totalEvaluated: instances.length,
  });
}
function sampleOf(distribution: RecommendationOutcomeDistribution, policy: RecommendationEffectivenessPolicy): RecommendationSampleAssessment {
  const conclusive = distribution.totalEvaluated - distribution.inconclusive;
  const ratio = Math.min(1, conclusive / policy.minimumSampleSize);
  return Object.freeze({
    outcomeCount: distribution.totalEvaluated, conclusiveOutcomeCount: conclusive,
    minimumRequired: policy.minimumSampleSize, sufficient: conclusive >= policy.minimumSampleSize,
    confidencePenalty: Percentage.create((1 - ratio) * 100),
  });
}
function metricsOf(distribution: RecommendationOutcomeDistribution, sample: RecommendationSampleAssessment): RecommendationSuccessMetrics {
  if (!sample.sufficient) return Object.freeze({ successRate: null, partialSuccessRate: null, failureRate: null, harmRate: null, inconclusiveRate: null });
  const conclusive = sample.conclusiveOutcomeCount, total = distribution.totalEvaluated;
  return Object.freeze({
    successRate: percentage(distribution.successful, conclusive),
    partialSuccessRate: percentage(distribution.partiallySuccessful, conclusive),
    failureRate: percentage(distribution.unsuccessful, conclusive),
    harmRate: percentage(distribution.harmful, conclusive),
    inconclusiveRate: percentage(distribution.inconclusive, total),
  });
}
function evidenceOf(instances: readonly RecommendationInstance[]): RecommendationEvidenceSummary {
  const assessments = instances.map(value => value.assessment);
  const coverage = average(assessments.map(value => value.confidence.coverage.value), 0);
  const attribution = average(assessments.map(value => value.attribution.confidence.score.value), 0);
  const outcome = average(assessments.map(value => value.confidence.assessment.score.value), 0);
  return Object.freeze({
    evaluatedOutcomeCount: assessments.length, evidenceCoverage: Percentage.create(coverage),
    attributionQuality: assessment(attribution, "aggregated outcome attribution"),
    outcomeConfidence: assessment(outcome, "aggregated outcome confidence"),
    missingEvidenceCount: assessments.filter(value => value.evidence.sufficiency === "insufficient").length,
  });
}
function harmOf(instances: readonly RecommendationInstance[], metrics: RecommendationSuccessMetrics): RecommendationHarmSummary {
  const conclusive = instances.filter(value => value.assessment.classification !== "inconclusive");
  const guardrail = conclusive.filter(value => value.assessment.guardrails.violated > 0).length;
  const unexpected = conclusive.filter(value => value.assessment.unexpectedEffects.some(effect => effect.disposition === "negative")).length;
  return Object.freeze({
    harmfulOutcomeCount: instances.filter(value => value.assessment.classification === "harmful").length,
    guardrailViolationRate: metrics.successRate ? percentage(guardrail, conclusive.length) : null,
    unexpectedNegativeRate: metrics.successRate ? percentage(unexpected, conclusive.length) : null,
    severeHarmObserved: instances.some(value => value.assessment.harm.material),
  });
}
function repeatabilityOf(instances: readonly RecommendationInstance[], metrics: RecommendationSuccessMetrics, sample: RecommendationSampleAssessment, policy: RecommendationEffectivenessPolicy): RecommendationRepeatabilityAssessment {
  const conditions = new Set(instances.flatMap(value => value.applicability.map(conditionKey)));
  const beneficialRate = metrics.successRate && metrics.partialSuccessRate ? metrics.successRate.value + metrics.partialSuccessRate.value * 0.5 : null;
  const limitations = [
    ...(!sample.sufficient ? ["SMALL_SAMPLE" as const] : []),
    ...(metrics.inconclusiveRate && metrics.inconclusiveRate.value > policy.maximumInconclusiveRateForLearning ? ["HIGH_INCONCLUSIVE_RATE" as const] : []),
    ...(beneficialRate !== null && beneficialRate >= 40 && beneficialRate < 80 ? ["MIXED_RESULTS" as const] : []),
    ...(average(instances.map(value => value.assessment.attribution.confidence.score.value), 0) < 50 ? ["LOW_ATTRIBUTION" as const] : []),
    ...(conditions.size > 1 ? ["INCOMPARABLE_CONDITIONS" as const] : []),
  ];
  const classification = beneficialRate === null ? "unknown" : beneficialRate >= policy.highRepeatabilityRate ? "high" : beneficialRate >= policy.moderateRepeatabilityRate ? "moderate" : "low";
  const score = beneficialRate === null ? null : Score.create(beneficialRate);
  const sampleScore = Math.min(100, sample.conclusiveOutcomeCount / policy.minimumSampleSize * 100);
  return freeze({
    classification, comparableOutcomeCount: sample.conclusiveOutcomeCount, consistencyScore: score,
    confidence: assessment((beneficialRate ?? 0) * 0.6 + sampleScore * 0.4, "repeatability consistency and sample"),
    limitingFactors: Object.freeze(limitations),
  });
}
function confidenceOf(instances: readonly RecommendationInstance[], sample: RecommendationSampleAssessment, evidence: RecommendationEvidenceSummary, repeatability: RecommendationRepeatabilityAssessment, policy: RecommendationEffectivenessPolicy): RecommendationEffectivenessConfidence {
  const sampleScore = Math.min(100, sample.conclusiveOutcomeCount / policy.minimumSampleSize * 100);
  const evidenceScore = Math.max(0, evidence.evidenceCoverage.value - evidence.missingEvidenceCount / Math.max(1, instances.length) * 100);
  const outcomeScore = evidence.outcomeConfidence.score.value;
  const attributionScore = evidence.attributionQuality.score.value;
  const consistency = repeatability.consistencyScore?.value ?? 0;
  const penalties = [
    ...(!sample.sufficient ? [{ code: "SMALL_SAMPLE", points: sample.confidencePenalty.value * 0.25 }] : []),
    ...(evidence.missingEvidenceCount ? [{ code: "MISSING_EVIDENCE", points: evidence.missingEvidenceCount / Math.max(1, instances.length) * 20 }] : []),
    ...(repeatability.limitingFactors.includes("INCOMPARABLE_CONDITIONS") ? [{ code: "INCOMPARABLE_CONDITIONS", points: 5 }] : []),
  ];
  const weight = policy.confidenceWeights;
  const raw = sampleScore * weight.sample + evidenceScore * weight.evidence + outcomeScore * weight.outcome + attributionScore * weight.attribution + consistency * weight.consistency;
  const total = Math.max(0, Math.min(100, raw - penalties.reduce((sum, value) => sum + value.points, 0)));
  return freeze({
    assessment: assessment(total, "sample, evidence, outcome, attribution, and consistency"),
    sampleQuality: assessment(sampleScore, "sample sufficiency"),
    evidenceQuality: assessment(evidenceScore, "evidence coverage"),
    outcomeQuality: evidence.outcomeConfidence,
    penalties: Object.freeze(penalties),
  });
}
function classify(metrics: RecommendationSuccessMetrics, sample: RecommendationSampleAssessment, harm: RecommendationHarmSummary, policy: RecommendationEffectivenessPolicy): RecommendationEffectiveness {
  if (!sample.sufficient || !metrics.successRate || !metrics.harmRate) return "insufficient-evidence";
  if ((policy.severeHarmOverrides && harm.severeHarmObserved) || metrics.harmRate.value >= policy.harmfulRateThreshold) return "harmful";
  const beneficial = metrics.successRate.value + (metrics.partialSuccessRate?.value ?? 0) * 0.5;
  return beneficial >= policy.highlyEffectiveSuccessRate ? "highly-effective"
    : beneficial >= policy.effectiveSuccessRate ? "effective"
    : beneficial >= policy.mixedSuccessRate ? "mixed" : "ineffective";
}
function qualityOf(effectiveness: RecommendationEffectiveness, repeatability: RecommendationRepeatabilityAssessment, sample: RecommendationSampleAssessment, harm: RecommendationHarmSummary) {
  if (!sample.sufficient) return "insufficient-evidence" as const;
  if (effectiveness === "harmful" || harm.severeHarmObserved) return "deprecated" as const;
  if (effectiveness === "highly-effective" && repeatability.classification === "high") return "validated" as const;
  if (effectiveness === "effective") return "promising" as const;
  if (effectiveness === "mixed") return "conditional" as const;
  return "experimental" as const;
}
function readinessOf(effectiveness: RecommendationEffectiveness, sample: RecommendationSampleAssessment, metrics: RecommendationSuccessMetrics, confidence: RecommendationEffectivenessConfidence, repeatability: RecommendationRepeatabilityAssessment, policy: RecommendationEffectivenessPolicy): RecommendationLearningReadiness {
  if (!sample.sufficient || effectiveness === "insufficient-evidence") return "insufficient-evidence";
  if ((metrics.inconclusiveRate?.value ?? 100) > policy.maximumInconclusiveRateForLearning || confidence.assessment.score.value < policy.minimumConfidenceForLearning) return "blocked";
  if (repeatability.classification === "unknown" || repeatability.limitingFactors.includes("INCOMPARABLE_CONDITIONS")) return "limited";
  return "ready";
}
function trendOf(previous: RecommendationEffectivenessAssessment | undefined, effectiveness: RecommendationEffectiveness, metrics: RecommendationSuccessMetrics, confidence: RecommendationEffectivenessConfidence, distribution: RecommendationOutcomeDistribution, policy: RecommendationEffectivenessPolicy): RecommendationTrendAssessment {
  if (!previous || previous.policyVersion !== policy.version || !previous.overall.metrics.successRate || !metrics.successRate) return Object.freeze({ direction: "unknown", comparableAssessment: false, changes: Object.freeze([]) });
  const delta = metrics.successRate.value - previous.overall.metrics.successRate.value;
  const direction = Math.abs(delta) <= policy.trendStableTolerancePoints ? "stable" : delta > 0 ? "improving" : "declining";
  return freeze({
    direction, comparableAssessment: true,
    changes: Object.freeze([
      Object.freeze({ metric: "effectiveness" as const, previous: previous.overall.effectiveness, current: effectiveness }),
      Object.freeze({ metric: "success-rate" as const, previous: previous.overall.metrics.successRate.value, current: metrics.successRate.value }),
      Object.freeze({ metric: "harm-rate" as const, previous: previous.overall.metrics.harmRate?.value ?? null, current: metrics.harmRate?.value ?? null }),
      Object.freeze({ metric: "confidence" as const, previous: previous.confidence.assessment.score.value, current: confidence.assessment.score.value }),
      Object.freeze({ metric: "sample-size" as const, previous: previous.outcomeDistribution.totalEvaluated, current: distribution.totalEvaluated }),
    ]),
  });
}
function applicabilityOf(instances: readonly RecommendationInstance[]): readonly RecommendationConditionPerformance[] {
  const conditions = new Map<string, RecommendationConditionPerformance["condition"]>();
  for (const condition of instances.flatMap(value => value.applicability)) conditions.set(conditionKey(condition), Object.freeze({ ...condition, value: condition.value.trim() }));
  return Object.freeze([...conditions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, condition]) => {
    const values = instances.filter(instance => instance.applicability.some(value => conditionKey(value) === key));
    return Object.freeze({
      condition, outcomeCount: values.length,
      beneficialCount: values.filter(value => ["successful", "partially-successful"].includes(value.assessment.classification)).length,
      harmfulCount: values.filter(value => value.assessment.classification === "harmful").length,
    });
  }));
}
function percentage(numerator: number, denominator: number): Percentage { return Percentage.create(denominator ? numerator / denominator * 100 : 0); }
function rateChange(previous: Percentage | null, current: Percentage | null) { return previous && current ? current.value - previous.value : null; }
function conditionKey(value: { category: string; value: string }) { return `${value.category}:${value.value.trim().toLowerCase()}`; }
function assessment(value: number, rationale: string) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(Math.max(0, Math.min(100, value))), rationale: [rationale] }); }
function average(values: readonly number[], fallback: number) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback; }
function validDate(value: Date) { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("Recommendation effectiveness date must be valid."); }
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  }
  return value;
}

import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore, Score } from "@/platform/scoring";
import type {
  OutcomeEvidenceReference, OutcomeExpectation, OutcomeMeasurement, OutcomeState,
  OutcomeValue,
} from "../../outcomes";
import type {
  AssessmentConfidence, DecisionOutcomeAssessment, DecisionOutcomeAssessmentId,
  DecisionOutcomePolicy, EvidenceSufficiency, GuardrailSummary, LearningReadiness,
  ObjectiveAssessment, OutcomeClassification, OutcomeEvidenceSummary,
  OutcomeHarmAssessment, OutcomeVariance, UnexpectedEffect, VarianceSummary,
} from "./assessment-model";
import { DecisionOutcomeError } from "./assessment-errors";
import { validateDecisionOutcomePolicy } from "./decision-outcome-policy";

export type EvaluateDecisionOutcomeInput = Readonly<{
  assessmentId: DecisionOutcomeAssessmentId;
  outcome: OutcomeState;
  policy: DecisionOutcomePolicy;
  evaluatedAt: Date;
  previousAssessment?: DecisionOutcomeAssessment;
  eventId: string;
}>;

export function evaluateDecisionOutcome(input: EvaluateDecisionOutcomeInput): DecisionOutcomeAssessment {
  validateDecisionOutcomePolicy(input.policy);
  validDate(input.evaluatedAt);
  required(input.eventId, "eventId");
  const objectives = Object.freeze(input.outcome.expectations.map(expectation => evaluateObjective(expectation, input.outcome)));
  const guardrails = summarizeGuardrails(objectives);
  const unexpectedEffects = unexpected(input.outcome);
  const harm = assessHarm(unexpectedEffects, input.outcome, input.policy);
  const evidence = summarizeEvidence(input.outcome);
  const confidence = composeConfidence(input.outcome, evidence, input.policy);
  const classification = classify(input.outcome, objectives, guardrails, harm, confidence, input.policy);
  const learningReadiness = readiness(input.outcome, classification, confidence, evidence, input.policy);
  const previous = input.previousAssessment;
  const changed = previous && previous.classification !== classification;
  const eventType = changed ? "DecisionOutcomeReclassified" : learningReadiness === "ready" ? "DecisionOutcomeReadyForLearning" : "DecisionOutcomeEvaluated";
  const version = previous ? previous.version + 1 : 1;
  return deepFreeze({
    id: input.assessmentId,
    ownerId: input.outcome.ownerId,
    outcomeId: input.outcome.id,
    outcomeVersion: input.outcome.version,
    decisionReferences: input.outcome.lineage.decisionReferences,
    classification,
    objectives,
    varianceSummary: summarizeVariance(objectives),
    guardrails,
    unexpectedEffects,
    harm,
    attribution: input.outcome.attribution,
    confidence,
    evidence,
    learningReadiness,
    policyVersion: input.policy.version,
    evaluatedAt: new Date(input.evaluatedAt),
    version,
    ...(previous ? { previousAssessmentId: previous.id } : {}),
    events: Object.freeze([Object.freeze({
      eventId: input.eventId,
      assessmentId: input.assessmentId,
      outcomeId: input.outcome.id,
      ownerId: input.outcome.ownerId,
      assessmentVersion: version,
      occurredAt: new Date(input.evaluatedAt),
      type: eventType,
      references: Object.freeze({
        outcomeVersion: input.outcome.version,
        classification,
        policyVersion: input.policy.version,
        learningReady: learningReadiness === "ready",
        ...(previous ? { previousAssessmentId: previous.id.value } : {}),
      }),
    })]),
  });
}

export function compareDecisionOutcomeAssessments(previous: DecisionOutcomeAssessment, current: DecisionOutcomeAssessment) {
  if (!previous.outcomeId.equals(current.outcomeId)) throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Assessments must evaluate the same Outcome.");
  return deepFreeze({
    previousAssessmentId: previous.id,
    currentAssessmentId: current.id,
    classificationChanged: previous.classification !== current.classification,
    fromClassification: previous.classification,
    toClassification: current.classification,
    confidenceChange: current.confidence.assessment.score.value - previous.confidence.assessment.score.value,
    readinessChanged: previous.learningReadiness !== current.learningReadiness,
    objectiveChanges: current.objectives.map(objective => {
      const prior = previous.objectives.find(value => value.expectationId.equals(objective.expectationId));
      return Object.freeze({ expectationId: objective.expectationId, from: prior?.status ?? null, to: objective.status, changed: prior?.status !== objective.status });
    }),
  });
}

function evaluateObjective(expectation: OutcomeExpectation, outcome: OutcomeState): ObjectiveAssessment {
  const measurement = authoritativeMeasurement(expectation, outcome);
  const evidence = evidenceFor(expectation, outcome);
  if (!measurement) return objective(expectation, null, null, null, "not-measured", evidence, "NO_AUTHORITATIVE_MEASUREMENT");
  if (expectation.target.type === "relative-change" && !expectation.baseline) {
    return objective(expectation, measurement, null, null, "unknown", evidence, "MISSING_BASELINE");
  }
  const expected = expectedValue(expectation);
  if (expected && expected.kind !== measurement.value.kind) {
    return objective(expectation, measurement, null, null, "unknown", evidence, "INCOMPATIBLE_VALUE");
  }
  const variance = expected ? calculateVariance(expected, measurement.value) : null;
  const comparison = compareTarget(expectation, measurement.value);
  return objective(
    expectation, measurement, variance, comparison.withinTolerance, comparison.status, evidence,
    comparison.status === "exceeded" ? "TARGET_EXCEEDED" : comparison.status === "achieved" ? "TARGET_ACHIEVED" : "TARGET_MISSED",
  );
}

function objective(
  expectation: OutcomeExpectation,
  measurement: OutcomeMeasurement | null,
  variance: OutcomeVariance | null,
  withinTolerance: boolean | null,
  status: ObjectiveAssessment["status"],
  evidence: readonly OutcomeEvidenceReference[],
  reasonCode: ObjectiveAssessment["reasonCode"],
): ObjectiveAssessment {
  return deepFreeze({
    expectationId: expectation.id, metric: expectation.metric, importance: expectation.importance,
    baseline: expectation.baseline?.value ?? null, target: expectation.target,
    actual: measurement?.value ?? null, measurementId: measurement?.id ?? null,
    variance, withinTolerance, status,
    confidence: measurement?.confidence ?? expectation.confidence,
    evidence: Object.freeze([...evidence]), reasonCode,
  });
}

function compareTarget(expectation: OutcomeExpectation, actual: OutcomeValue): Readonly<{ status: "achieved" | "exceeded" | "missed"; withinTolerance: boolean }> {
  const target = expectation.target;
  if (target.type === "completion") {
    const achieved = actual.kind === "boolean" ? actual.value : actual.kind === "qualitative" && actual.value === "completed";
    return { status: achieved ? "achieved" : "missed", withinTolerance: achieved };
  }
  if (target.type === "state") {
    const achieved = actual.kind === "qualitative" && actual.value === target.expectedState;
    return { status: achieved ? "achieved" : "missed", withinTolerance: achieved };
  }
  if (target.type === "range") {
    const value = scalar(actual), minimum = scalar(target.minimum), maximum = scalar(target.maximum);
    const achieved = value >= minimum && value <= maximum;
    return { status: achieved ? "achieved" : "missed", withinTolerance: achieved };
  }
  const expected = target.type === "relative-change" ? relativeTarget(expectation, target.value.value) : target.value;
  const value = scalar(actual), threshold = scalar(expected), tolerance = toleranceAmount(expectation, threshold);
  if (target.type === "minimum") return thresholdResult(value, threshold, tolerance, "higher");
  if (target.type === "maximum") return thresholdResult(value, threshold, tolerance, "lower");
  if (expectation.direction === "decrease" || expectation.metric.directionality === "lower-is-better") return thresholdResult(value, threshold, tolerance, "lower");
  if (expectation.direction === "maintain") {
    const achieved = Math.abs(value - threshold) <= tolerance;
    return { status: achieved ? "achieved" : "missed", withinTolerance: achieved };
  }
  return thresholdResult(value, threshold, tolerance, "higher");
}
function thresholdResult(actual: number, target: number, tolerance: number, favorable: "higher" | "lower") {
  const achieved = favorable === "higher" ? actual >= target - tolerance : actual <= target + tolerance;
  const exceeded = favorable === "higher" ? actual > target + tolerance : actual < target - tolerance;
  return { status: exceeded ? "exceeded" as const : achieved ? "achieved" as const : "missed" as const, withinTolerance: achieved };
}
function relativeTarget(expectation: OutcomeExpectation, percentage: number): OutcomeValue {
  if (!expectation.baseline) throw new DecisionOutcomeError("OUTCOME_NOT_EVALUABLE", "Relative target requires a baseline.");
  const baseline = expectation.baseline.value, multiplier = expectation.direction === "decrease" ? 1 - percentage / 100 : 1 + percentage / 100;
  if (baseline.kind === "money") return { kind: "money", value: Money.usd(baseline.value.amount * multiplier) };
  if (baseline.kind === "percentage") return { kind: "percentage", value: Percentage.create(Math.max(0, Math.min(100, baseline.value.value * multiplier))) };
  if (baseline.kind === "score") return { kind: "score", value: Score.create(baseline.value.scale.clamp(baseline.value.value * multiplier), baseline.value.scale) };
  if (baseline.kind === "ratio" || baseline.kind === "count" || baseline.kind === "duration") return { ...baseline, value: baseline.value * multiplier };
  throw new DecisionOutcomeError("OUTCOME_NOT_EVALUABLE", "Relative target requires a numeric baseline.");
}
export function calculateVariance(expected: OutcomeValue, actual: OutcomeValue): OutcomeVariance {
  if (expected.kind !== actual.kind) throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Variance values must have compatible kinds.");
  if (expected.kind === "money" && actual.kind === "money") {
    if (expected.value.currency !== actual.value.currency) throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Money variance requires matching currencies.");
    const absolute = actual.value.subtract(expected.value);
    return Object.freeze({ kind: "money", absolute, relativePercentage: relative(expected.value.amount, absolute.amount), currency: actual.value.currency, direction: direction(absolute.amount) });
  }
  if (expected.kind === "percentage" && actual.kind === "percentage") {
    const absolutePercentagePoints = actual.value.value - expected.value.value;
    return Object.freeze({ kind: "percentage", absolutePercentagePoints, relativePercentage: relative(expected.value.value, absolutePercentagePoints), direction: direction(absolutePercentagePoints) });
  }
  if (expected.kind === "score" && actual.kind === "score") {
    if (expected.value.minimum !== actual.value.minimum || expected.value.maximum !== actual.value.maximum) throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Score variance requires matching scales.");
    const absolute = actual.value.value - expected.value.value;
    return Object.freeze({ kind: "score", absolute, relativePercentage: relative(expected.value.value, absolute), scale: Object.freeze({ minimum: actual.value.minimum, maximum: actual.value.maximum }), direction: direction(absolute) });
  }
  if ((expected.kind === "ratio" || expected.kind === "count" || expected.kind === "duration") && actual.kind === expected.kind) {
    const absolute = actual.value - expected.value;
    return Object.freeze({ kind: expected.kind, absolute, relativePercentage: relative(expected.value, absolute), direction: direction(absolute), ...("unit" in actual ? { unit: actual.unit } : {}) });
  }
  if (expected.kind === "boolean" && actual.kind === "boolean") return Object.freeze({ kind: "boolean", changed: expected.value !== actual.value, direction: "none" });
  if (expected.kind === "qualitative" && actual.kind === "qualitative") return Object.freeze({ kind: "qualitative", changed: expected.value !== actual.value, direction: qualitativeDirection(actual.value) });
  throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Variance is unavailable for these values.");
}

function authoritativeMeasurement(expectation: OutcomeExpectation, outcome: OutcomeState): OutcomeMeasurement | null {
  return [...outcome.measurements].filter(value => value.status === "authoritative" && value.expectationId?.equals(expectation.id))
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || b.id.value.localeCompare(a.id.value))[0] ?? null;
}
function expectedValue(expectation: OutcomeExpectation): OutcomeValue | null {
  if ("value" in expectation.target) return expectation.target.type === "relative-change" ? relativeTarget(expectation, expectation.target.value.value) : expectation.target.value;
  return null;
}
function toleranceAmount(expectation: OutcomeExpectation, target: number): number {
  const tolerance = expectation.tolerance;
  if (!tolerance || tolerance.type === "none") return 0;
  if (tolerance.type === "percentage") return Math.abs(target) * tolerance.value.value / 100;
  return Math.abs(scalar(tolerance.value));
}
function scalar(value: OutcomeValue): number {
  if (value.kind === "money") return value.value.amount;
  if (value.kind === "percentage" || value.kind === "score") return value.value.value;
  if (value.kind === "ratio" || value.kind === "count" || value.kind === "duration") return value.value;
  if (value.kind === "boolean") return value.value ? 1 : 0;
  throw new DecisionOutcomeError("COMPARISON_INCOMPATIBLE", "Qualitative value has no numeric scalar.");
}
function summarizeGuardrails(objectives: readonly ObjectiveAssessment[]): GuardrailSummary {
  const values = objectives.filter(value => value.importance === "guardrail");
  return deepFreeze({
    total: values.length, preserved: values.filter(value => value.status === "achieved" || value.status === "exceeded").length,
    violated: values.filter(value => value.status === "missed").length,
    unknown: values.filter(value => value.status === "unknown" || value.status === "not-measured").length,
    violatedExpectationIds: Object.freeze(values.filter(value => value.status === "missed").map(value => value.expectationId)),
  });
}
function summarizeVariance(objectives: readonly ObjectiveAssessment[]): VarianceSummary {
  const values = objectives.filter(value => value.variance);
  return Object.freeze({
    calculated: values.length, unavailable: objectives.length - values.length,
    favorable: values.filter(value => favorableVariance(value)).length,
    unfavorable: values.filter(value => value.status === "missed").length,
  });
}
function favorableVariance(value: ObjectiveAssessment) { return value.status === "achieved" || value.status === "exceeded"; }
function unexpected(outcome: OutcomeState): readonly UnexpectedEffect[] {
  return Object.freeze(outcome.qualitativeObservations.filter(value => value.category === "unexpected-effect" || value.value.startsWith("unexpected-")).map(value => deepFreeze({
    observationId: value.id,
    disposition: value.value === "unexpected-positive" ? "positive" as const : value.value === "unexpected-negative" ? "negative" as const : "neutral" as const,
    value: value.value, confidence: value.confidence, evidence: value.evidence,
  })));
}
function assessHarm(effects: readonly UnexpectedEffect[], outcome: OutcomeState, policy: DecisionOutcomePolicy): OutcomeHarmAssessment {
  const negative = effects.filter(value => value.disposition === "negative");
  const triggering = outcome.qualitativeObservations.filter(value => negative.some(effect => effect.observationId.equals(value.id)) && policy.materialHarm.categories.includes(value.category));
  const material = triggering.length >= policy.materialHarm.unexpectedNegativeCount;
  return deepFreeze({
    detected: negative.length > 0, material,
    categories: Object.freeze(material ? ["unexpected-negative" as const] : []),
    triggeringObservationIds: Object.freeze(triggering.map(value => value.id)),
    overrideApplied: material && policy.harmOverride,
  });
}
function summarizeEvidence(outcome: OutcomeState): OutcomeEvidenceSummary {
  const required = outcome.measurementPlan.evidenceRequirements.filter(value => value.required);
  const satisfied = required.filter(requirement => requirement.requiredRoles.every(role => outcome.evidence.some(value => value.role === role)));
  const sufficiency: EvidenceSufficiency = required.length === 0 || satisfied.length === required.length
    ? outcome.evidence.length || required.length === 0 ? "sufficient" : "limited"
    : satisfied.length ? "limited" : "insufficient";
  return Object.freeze({
    sufficiency, referenceCount: outcome.evidence.length, requiredCount: required.length,
    satisfiedRequiredCount: satisfied.length,
    authoritativeMeasurementCount: outcome.measurements.filter(value => value.status === "authoritative").length,
    limitationCount: outcome.evidence.filter(value => value.role === "limitation").length,
  });
}
function composeConfidence(outcome: OutcomeState, evidence: OutcomeEvidenceSummary, policy: DecisionOutcomePolicy): AssessmentConfidence {
  const authoritative = outcome.measurements.filter(value => value.status === "authoritative");
  const measurementScore = average(authoritative.map(value => value.confidence.score.value), outcome.confidence.measurementQuality.score.value);
  const evidenceScore = average(outcome.evidence.map(value => value.confidence.score.value), evidence.sufficiency === "sufficient" ? 100 : evidence.sufficiency === "limited" ? 50 : 0);
  const attributionScore = outcome.attribution.confidence.score.value;
  const coverage = outcome.confidence.evidenceCoverage.value;
  const freshness = average(authoritative.map(value => value.dataQuality.freshness === "current" ? 100 : value.dataQuality.freshness === "stale" ? 40 : 20), 0);
  const penalties = [
    ...(authoritative.some(value => value.late) ? [{ code: "LATE_EVIDENCE", points: 5 }] : []),
    ...(outcome.expectations.some(value => value.reconstructed) ? [{ code: "RECONSTRUCTED_EXPECTATION", points: 10 }] : []),
    ...(authoritative.some(value => value.dataQuality.compatibility === "incompatible") ? [{ code: "INCOMPATIBLE_DATA", points: 20 }] : []),
    ...(outcome.attribution.status === "contested" ? [{ code: "CONTESTED_ATTRIBUTION", points: 15 }] : []),
  ];
  const weights = policy.confidenceWeights;
  const raw = measurementScore * weights.measurement + evidenceScore * weights.evidence + attributionScore * weights.attribution + coverage * weights.coverage + freshness * weights.freshness;
  const score = Math.max(0, Math.min(100, raw - penalties.reduce((sum, value) => sum + value.points, 0)));
  return deepFreeze({
    assessment: ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: ["measurement quality", "evidence quality", "attribution quality", "coverage", "freshness"] }),
    measurementQuality: ConfidenceAssessment.create({ score: ConfidenceScore.create(measurementScore), rationale: ["authoritative measurements"] }),
    evidenceQuality: ConfidenceAssessment.create({ score: ConfidenceScore.create(evidenceScore), rationale: [evidence.sufficiency] }),
    attributionQuality: outcome.attribution.confidence,
    coverage: Percentage.create(coverage), freshnessScore: freshness, penalties: Object.freeze(penalties),
  });
}
function classify(outcome: OutcomeState, objectives: readonly ObjectiveAssessment[], guardrails: GuardrailSummary, harm: OutcomeHarmAssessment, confidence: AssessmentConfidence, policy: DecisionOutcomePolicy): OutcomeClassification {
  if (outcome.status === "inconclusive" || outcome.status === "cancelled" || outcome.status === "planned" || outcome.status === "measuring" || outcome.status === "superseded") return "inconclusive";
  if (harm.overrideApplied) return "harmful";
  if (confidence.assessment.score.value < policy.minimumConfidenceForConclusion) return "inconclusive";
  const primary = objectives.filter(value => value.importance === "primary");
  const known = primary.filter(value => value.status !== "unknown" && value.status !== "not-measured");
  if (!primary.length || known.length !== primary.length) return "inconclusive";
  const ratio = primary.filter(value => value.status === "achieved" || value.status === "exceeded").length / primary.length;
  let classification: OutcomeClassification = ratio >= policy.successfulPrimaryRatio ? "successful" : ratio >= policy.partialPrimaryRatio ? "partially-successful" : "unsuccessful";
  if (guardrails.violated && classification === "successful") classification = policy.guardrailPrecedence === "harmful" ? "harmful" : policy.guardrailPrecedence === "unsuccessful" ? "unsuccessful" : "partially-successful";
  return classification;
}
function readiness(outcome: OutcomeState, classification: OutcomeClassification, confidence: AssessmentConfidence, evidence: OutcomeEvidenceSummary, policy: DecisionOutcomePolicy): LearningReadiness {
  if (outcome.status === "superseded") return "superseded";
  if (outcome.status !== "closed" && outcome.status !== "inconclusive") return "incomplete";
  if (classification === "inconclusive" || evidence.sufficiency === "insufficient" || confidence.coverage.value < policy.minimumEvidenceCoverage) return "insufficient-evidence";
  if (confidence.assessment.score.value < policy.minimumConfidenceForLearning) return "blocked";
  if (policy.attributionRequiredForLearning && !policy.acceptedAttributionForLearning.includes(outcome.attribution.status)) return "blocked";
  return "ready";
}
function evidenceFor(expectation: OutcomeExpectation, outcome: OutcomeState) {
  const roles = new Set(outcome.measurementPlan.evidenceRequirements.filter(value => !value.expectationId || value.expectationId.equals(expectation.id)).flatMap(value => value.requiredRoles));
  return Object.freeze(outcome.evidence.filter(value => roles.size === 0 || roles.has(value.role)));
}
function relative(expected: number, delta: number): number | null { return expected === 0 ? null : delta / Math.abs(expected) * 100; }
function direction(value: number): "positive" | "negative" | "none" { return value > 0 ? "positive" : value < 0 ? "negative" : "none"; }
function qualitativeDirection(value: string): "positive" | "negative" | "none" { return value.includes("positive") || value === "improved" || value === "completed" ? "positive" : value.includes("negative") || value === "deteriorated" || value === "not-completed" ? "negative" : "none"; }
function average(values: readonly number[], fallback: number): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback; }
function validDate(value: Date): void { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new DecisionOutcomeError("OUTCOME_NOT_EVALUABLE", "Evaluation time must be valid."); }
function required(value: string, field: string): void { if (!value.trim()) throw new DecisionOutcomeError("OUTCOME_NOT_EVALUABLE", `${field} is required.`); }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

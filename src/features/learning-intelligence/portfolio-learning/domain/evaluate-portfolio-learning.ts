import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore, Score } from "@/platform/scoring";
import type { DecisionOutcomeAssessment, OutcomeClassification, OutcomeVariance } from "../../decision-outcomes";
import type { RecommendationEffectivenessAssessment } from "../../recommendation-effectiveness";
import type { OutcomeMetricKey, OutcomeValue } from "../../outcomes";
import { createPortfolioLearningId } from "./ids";
import type {
  EvaluatePortfolioLearningInput, PortfolioExceptionalLearning, PortfolioLearning,
  PortfolioLearningApplicability, PortfolioLearningAssessment, PortfolioLearningAssessmentContext,
  PortfolioLearningAssessmentReference, PortfolioLearningChange,
  PortfolioLearningCondition, PortfolioLearningConfidence, PortfolioLearningConsistency,
  PortfolioLearningContradictionSummary, PortfolioLearningEvidenceSummary, PortfolioLearningFreshness,
  PortfolioLearningKey, PortfolioLearningLimitation, PortfolioLearningMateriality,
  PortfolioLearningMaturity, PortfolioLearningObservedEffect, PortfolioLearningPatternCandidate,
  PortfolioLearningPolicy, PortfolioLearningRecurrence, PortfolioLearningSampleAssessment,
  PortfolioLearningScope, PortfolioLearningStatementCode,
} from "./model";
import { validatePortfolioLearningPolicy } from "./policy";

type Eligible = Readonly<{ decisions: readonly DecisionOutcomeAssessment[]; effectiveness: readonly RecommendationEffectivenessAssessment[]; contexts: ReadonlyMap<string, PortfolioLearningAssessmentContext>; limitations: readonly PortfolioLearningLimitation[] }>;
type CandidateInput = Readonly<{
  category: PortfolioLearningPatternCandidate["category"]; type: PortfolioLearningPatternCandidate["type"];
  statementCode: PortfolioLearningStatementCode; subject: PortfolioLearningPatternCandidate["key"]["statementCode"] extends never ? never : import("./model").PortfolioLearningPatternSubject;
  support: readonly PortfolioLearningAssessmentReference[]; contradict: readonly PortfolioLearningAssessmentReference[]; inconclusive: readonly PortfolioLearningAssessmentReference[];
  scope: PortfolioLearningScope; effect: PortfolioLearningObservedEffect; conditions?: readonly PortfolioLearningCondition[];
  variances?: readonly Readonly<{ metricKey: OutcomeMetricKey; variance: OutcomeVariance }>[]; materialityHint?: PortfolioLearningPatternCandidate["materialityHint"];
  recurrenceCounts?: Readonly<{ support: number; contradict: number; inconclusive: number; distinctSubjects: number; distinctPeriods: number }>;
}>;

export function evaluatePortfolioLearning(input: EvaluatePortfolioLearningInput): PortfolioLearningAssessment {
  validatePortfolioLearningPolicy(input.policy);
  validWindow(input.observationWindow); validDate(input.evaluatedAt); validatePortfolio(input);
  const eligible = normalizeEligibility(input);
  const detected = [
    ...detectDecisionPatterns(input, eligible),
    ...detectAssumptionBias(input, eligible),
    ...detectGuardrailAndUnexpected(input, eligible),
    ...detectExecutionAndMeasurement(input, eligible),
    ...detectRecommendationPatterns(input, eligible),
  ];
  const candidates = normalizeCandidates(detected, input.policy).slice(0, input.policy.limits.candidates);
  const fingerprint = snapshotFingerprint(input, eligible);
  const previousByKey = new Map((input.previousAssessment?.learnings ?? []).map(value => [keyString(value.key), value]));
  const learnings = candidates
    .filter(value => value.sample.eligibleCount >= input.policy.sample.emerging)
    .map(candidate => establish(candidate, input, fingerprint, previousByKey.get(keyString(candidate.key))))
    .sort(learningOrder)
    .slice(0, input.policy.limits.learnings);
  const exceptions = exceptionalLearnings(eligible.decisions, input.policy);
  const changes = compareAssessmentLearnings(input.previousAssessment, learnings, input.policy).slice(0, input.policy.limits.changes);
  const allLimitations = Object.freeze([...eligible.limitations, ...learnings.flatMap(value => value.limitations)].sort(limitationOrder));
  const confidence = assessment(average(learnings.map(value => value.confidence.assessment.score.value), candidates.length ? average(candidates.map(value => value.confidence.score.value), 0) : 0), "portfolio learning assessment");
  const strongest = [...learnings].sort((a, b) => b.confidence.assessment.score.value - a.confidence.assessment.score.value || a.id.value.localeCompare(b.id.value))[0];
  const highest = [...learnings].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.id.value.localeCompare(b.id.value))[0];
  return deepFreeze({
    id: input.assessmentId, ownerId: input.portfolio.ownerId, portfolioId: input.portfolio.portfolioId,
    portfolioVersion: input.portfolio.portfolioVersion, policyVersion: input.policy.version,
    evaluatedAt: new Date(input.evaluatedAt), observationWindow: cloneWindow(input.observationWindow),
    learnings: Object.freeze(learnings), candidates: Object.freeze(candidates), exceptionalLearnings: Object.freeze(exceptions),
    changes: Object.freeze(changes), confidence, limitations: allLimitations, snapshotFingerprint: fingerprint,
    version: input.previousAssessment ? input.previousAssessment.version + 1 : 1,
    summary: Object.freeze({
      activeLearningCount: learnings.filter(value => value.status === "active").length,
      validatedCount: learnings.filter(value => value.maturity === "validated").length,
      supportedCount: learnings.filter(value => value.maturity === "supported").length,
      emergingCount: learnings.filter(value => value.maturity === "emerging").length,
      contestedCount: learnings.filter(value => value.maturity === "contested").length,
      criticalLearningCount: learnings.filter(value => value.priority === "critical").length,
      ...(strongest ? { strongestLearningId: strongest.id } : {}),
      ...(highest ? { highestPriorityLearningId: highest.id } : {}),
      measurementQualityLearningCount: learnings.filter(value => value.category === "measurement").length,
    }),
  });
}

function normalizeEligibility(input: EvaluatePortfolioLearningInput): Eligible {
  if (input.decisionOutcomes.length > input.policy.limits.decisionAssessments || input.recommendationEffectiveness.length > input.policy.limits.effectivenessAssessments) throw new RangeError("Portfolio Learning input collection limit exceeded.");
  const contexts = new Map(input.portfolio.assessmentContexts.map(value => [value.assessmentId.value, value]));
  const decisionMap = new Map<string, DecisionOutcomeAssessment>();
  const limitations: PortfolioLearningLimitation[] = [];
  for (const value of [...input.decisionOutcomes].sort(assessmentOrder)) {
    if (!value.ownerId.equals(input.portfolio.ownerId)) throw new TypeError("Cross-owner Decision Outcome assessment is not eligible.");
    if (!input.policy.compatibleDecisionPolicyVersions.includes(value.policyVersion)) { limitations.push(limitation("LEARNING_POLICY_INCOMPATIBLE", "material", "comparability", [value.id.value])); continue; }
    if (value.learningReadiness === "incomplete" || value.learningReadiness === "superseded") continue;
    if (value.learningReadiness !== "ready" && !input.policy.allowLimitedDecisionAssessments && value.classification !== "inconclusive") continue;
    if (value.confidence.assessment.score.value < input.policy.confidence.minimumEligible) continue;
    if (!contexts.has(value.id.value)) { limitations.push(limitation("LEARNING_CONTEXT_INCOMPLETE", "material", "context", [value.id.value])); continue; }
    const existing = decisionMap.get(value.id.value);
    if (!existing || value.version > existing.version) decisionMap.set(value.id.value, value);
  }
  const effectivenessMap = new Map<string, RecommendationEffectivenessAssessment>();
  for (const value of [...input.recommendationEffectiveness].sort(effectivenessOrder)) {
    if (!value.ownerId.equals(input.portfolio.ownerId)) throw new TypeError("Cross-owner Recommendation Effectiveness assessment is not eligible.");
    if (!input.policy.compatibleEffectivenessPolicyVersions.includes(value.policyVersion)) { limitations.push(limitation("LEARNING_POLICY_INCOMPATIBLE", "material", "comparability", [value.id.value])); continue; }
    if (value.learningReadiness !== "ready" && !(input.policy.allowLimitedEffectivenessAssessments && value.learningReadiness === "limited")) continue;
    const existing = effectivenessMap.get(value.id.value);
    if (!existing || value.version > existing.version) effectivenessMap.set(value.id.value, value);
  }
  return Object.freeze({ decisions: Object.freeze([...decisionMap.values()].sort(assessmentOrder)), effectiveness: Object.freeze([...effectivenessMap.values()].sort(effectivenessOrder)), contexts, limitations: Object.freeze(limitations) });
}

function detectDecisionPatterns(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  const groups = group(eligible.decisions, value => eligible.contexts.get(value.id.value)!.decisionType);
  return [...groups.entries()].flatMap(([decisionType, values]) => {
    const successful = values.filter(value => value.classification === "successful" || value.classification === "partially-successful");
    const failed = values.filter(value => value.classification === "unsuccessful" || value.classification === "harmful");
    const inconclusive = values.filter(value => value.classification === "inconclusive");
    const positive = successful.length >= failed.length;
    const support = positive ? successful : failed, contradict = positive ? failed : successful;
    return [candidate(input, eligible, {
      category: "strategy", type: positive ? "successful-pattern" : "failure-pattern",
      statementCode: positive ? "DECISION_TYPE_SUCCESS_REPEATABLE" : "DECISION_TYPE_FAILURE_REPEATABLE",
      subject: { type: "decision-type", decisionType },
      support: support.map(value => decisionRef(value, eligible)), contradict: contradict.map(value => decisionRef(value, eligible)),
      inconclusive: inconclusive.map(value => decisionRef(value, eligible)),
      scope: scopeFor(input, eligible, values, { level: "decision-type", decisionTypes: [decisionType] }),
      effect: { kind: "classification", distribution: classificationDistribution(values) },
      conditions: segmentedConditions(input, eligible, values),
      materialityHint: values.some(value => value.classification === "harmful") ? "high" : "moderate",
    })];
  });
}

function detectAssumptionBias(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  const values = eligible.decisions.flatMap(assessmentValue => assessmentValue.objectives.flatMap(objective =>
    objective.variance ? [{ assessment: assessmentValue, metricKey: objective.metric.key, variance: objective.variance }] : []));
  return [...group(values, value => value.metricKey.value).entries()].flatMap(([, groupValues]) => {
    const comparable = groupValues.filter(value => signedVariance(value.variance) !== null);
    if (!comparable.length) return [];
    const median = medianNumber(comparable.map(value => signedVariance(value.variance)!));
    const optimistic = median < 0;
    const supportValues = comparable.filter(value => optimistic ? signedVariance(value.variance)! < 0 : signedVariance(value.variance)! > 0);
    const contradictValues = comparable.filter(value => optimistic ? signedVariance(value.variance)! > 0 : signedVariance(value.variance)! < 0);
    const metricKey = comparable[0]!.metricKey;
    return [candidate(input, eligible, {
      category: "investment", type: "assumption-bias",
      statementCode: optimistic ? "ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC" : "ASSUMPTIONS_SYSTEMATICALLY_CONSERVATIVE",
      subject: { type: "assumption", metricKey },
      support: supportValues.map(value => decisionRef(value.assessment, eligible)),
      contradict: contradictValues.map(value => decisionRef(value.assessment, eligible)), inconclusive: [],
      scope: scopeFor(input, eligible, comparable.map(value => value.assessment), { level: "portfolio" }),
      effect: quantitativeEffect(metricKey, comparable.map(value => value.variance), median),
      variances: comparable.map(value => ({ metricKey, variance: value.variance })), materialityHint: "moderate",
    })];
  });
}

function detectGuardrailAndUnexpected(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  const result: PortfolioLearningPatternCandidate[] = [];
  const guard = eligible.decisions.filter(value => value.guardrails.violated > 0);
  if (guard.length) result.push(candidate(input, eligible, {
    category: "risk", type: "risk-pattern", statementCode: "GUARDRAIL_VIOLATION_RECURRING",
    subject: { type: "portfolio-condition", conditionCode: "guardrail-violation" },
    support: guard.map(value => decisionRef(value, eligible)), contradict: eligible.decisions.filter(value => value.guardrails.total > 0 && value.guardrails.violated === 0).map(value => decisionRef(value, eligible)), inconclusive: [],
    scope: scopeFor(input, eligible, guard, { level: "portfolio" }),
    effect: { kind: "qualitative", effectCodes: ["guardrail-violation"], direction: "negative" }, materialityHint: "high",
  }));
  for (const disposition of ["negative", "positive"] as const) {
    const matching = eligible.decisions.filter(value => value.unexpectedEffects.some(effect => effect.disposition === disposition));
    if (matching.length) result.push(candidate(input, eligible, {
      category: disposition === "negative" ? "risk" : "operations", type: "unexpected-effect-pattern",
      statementCode: disposition === "negative" ? "UNEXPECTED_NEGATIVE_EFFECT_RECURRING" : "UNEXPECTED_POSITIVE_EFFECT_RECURRING",
      subject: { type: "portfolio-condition", conditionCode: `unexpected-${disposition}` },
      support: matching.map(value => decisionRef(value, eligible)), contradict: [], inconclusive: [],
      scope: scopeFor(input, eligible, matching, { level: "portfolio" }),
      effect: { kind: "qualitative", effectCodes: [`unexpected-${disposition}`], direction: disposition },
      materialityHint: disposition === "negative" ? "high" : "moderate",
    }));
  }
  return result;
}

function detectExecutionAndMeasurement(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  const result: PortfolioLearningPatternCandidate[] = [];
  const partial = eligible.decisions.filter(value => eligible.contexts.get(value.id.value)?.partialExecution);
  if (partial.length) result.push(candidate(input, eligible, {
    category: "execution", type: "execution-pattern", statementCode: "PARTIAL_EXECUTION_LIMITS_OUTCOMES",
    subject: { type: "execution-behavior", behaviorCode: "partial-execution" },
    support: partial.filter(value => value.classification === "inconclusive" || value.classification === "unsuccessful").map(value => decisionRef(value, eligible)),
    contradict: partial.filter(value => value.classification === "successful").map(value => decisionRef(value, eligible)), inconclusive: [],
    scope: scopeFor(input, eligible, partial, { level: "portfolio" }),
    effect: { kind: "classification", distribution: classificationDistribution(partial) }, materialityHint: "moderate",
  }));
  const delayed = eligible.decisions.filter(value => eligible.contexts.get(value.id.value)?.executionSpeed === "delayed");
  if (delayed.length) result.push(candidate(input, eligible, {
    category: "execution", type: "execution-pattern", statementCode: "EXECUTION_DELAY_REDUCES_OUTCOME_QUALITY",
    subject: { type: "execution-behavior", behaviorCode: "delayed-execution" },
    support: delayed.filter(value => ["unsuccessful", "harmful", "inconclusive"].includes(value.classification)).map(value => decisionRef(value, eligible)),
    contradict: delayed.filter(value => value.classification === "successful").map(value => decisionRef(value, eligible)), inconclusive: [],
    scope: scopeFor(input, eligible, delayed, { level: "portfolio" }),
    effect: { kind: "classification", distribution: classificationDistribution(delayed) },
    conditions: [{ dimension: "execution-speed", operator: "equals", value: "delayed" }], materialityHint: "moderate",
  }));
  const missing = eligible.decisions.filter(value => value.objectives.some(objective => objective.reasonCode === "MISSING_BASELINE"));
  if (missing.length) result.push(measurementCandidate(input, eligible, missing, "MISSING_BASELINES_LIMIT_LEARNING", "missing-baseline"));
  const inconclusive = eligible.decisions.filter(value => value.classification === "inconclusive");
  if (inconclusive.length) result.push(measurementCandidate(input, eligible, inconclusive, "INCONCLUSIVE_OUTCOMES_LIMIT_LEARNING", "inconclusive-outcome"));
  const lowAttribution = eligible.decisions.filter(value => value.attribution.confidence.score.value < 50);
  if (lowAttribution.length) result.push(measurementCandidate(input, eligible, lowAttribution, "LOW_ATTRIBUTION_LIMITS_LEARNING", "low-attribution"));
  return result;
}

function detectRecommendationPatterns(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  return eligible.effectiveness.map(value => {
    const effective = value.overall.effectiveness === "highly-effective" || value.overall.effectiveness === "effective";
    const conditional = value.overall.quality === "conditional" || value.applicability.length > 1;
    const code: PortfolioLearningStatementCode = value.overall.effectiveness === "harmful" ? "RECOMMENDATION_TYPE_HARMFUL"
      : conditional ? "RECOMMENDATION_TYPE_EFFECTIVE_CONDITIONALLY"
      : effective ? "RECOMMENDATION_TYPE_EFFECTIVE" : "RECOMMENDATION_TYPE_INEFFECTIVE";
    const classifications = recommendationDistribution(value);
    const supportCount = effective || conditional ? value.outcomeDistribution.successful + value.outcomeDistribution.partiallySuccessful : value.outcomeDistribution.unsuccessful + value.outcomeDistribution.harmful;
    const contradictCount = effective || conditional ? value.outcomeDistribution.unsuccessful + value.outcomeDistribution.harmful : value.outcomeDistribution.successful + value.outcomeDistribution.partiallySuccessful;
    const ref = effectivenessRef(value);
    return candidate(input, eligible, {
      category: "recommendation", type: conditional ? "conditional-pattern" : effective ? "successful-pattern" : "failure-pattern",
      statementCode: code, subject: { type: "recommendation-type", recommendationType: value.recommendationType },
      support: supportCount ? [ref] : [], contradict: contradictCount ? [ref] : [],
      inconclusive: value.outcomeDistribution.inconclusive ? [ref] : [],
      scope: scopeFor(input, eligible, [], { level: "recommendation-type", recommendationTypes: [value.recommendationType] }),
      effect: { kind: "classification", distribution: classifications },
      conditions: value.applicability.slice(0, input.policy.limits.conditions).map(item => ({ dimension: item.condition.category === "market" ? "market" : item.condition.category, operator: "equals", value: item.condition.value })),
      materialityHint: value.overall.effectiveness === "harmful" ? "critical" : "moderate",
      recurrenceCounts: { support: supportCount, contradict: contradictCount, inconclusive: value.outcomeDistribution.inconclusive, distinctSubjects: value.outcomeDistribution.totalEvaluated, distinctPeriods: 1 },
    });
  });
}

function candidate(input: EvaluatePortfolioLearningInput, eligible: Eligible, value: CandidateInput): PortfolioLearningPatternCandidate {
  const keyScope = {
    level: value.scope.level,
    recommendationTypes: value.scope.recommendationTypes.map(item => item.value).sort(),
    decisionTypes: [...value.scope.decisionTypes].sort(),
  };
  const key: PortfolioLearningKey = Object.freeze({ portfolioId: input.portfolio.portfolioId, category: value.category, type: value.type, statementCode: value.statementCode, scopeFingerprint: stableHash(canonical(keyScope)) });
  const recurrence = value.recurrenceCounts
    ? Object.freeze({
        eligibleAssessmentCount: value.recurrenceCounts.support + value.recurrenceCounts.contradict + value.recurrenceCounts.inconclusive,
        supportingCount: value.recurrenceCounts.support, contradictingCount: value.recurrenceCounts.contradict, inconclusiveCount: value.recurrenceCounts.inconclusive,
        supportRate: value.recurrenceCounts.support + value.recurrenceCounts.contradict ? Percentage.create(value.recurrenceCounts.support / (value.recurrenceCounts.support + value.recurrenceCounts.contradict) * 100) : null,
        contradictionRate: value.recurrenceCounts.support + value.recurrenceCounts.contradict ? Percentage.create(value.recurrenceCounts.contradict / (value.recurrenceCounts.support + value.recurrenceCounts.contradict) * 100) : null,
        observedAcrossDistinctSubjects: value.recurrenceCounts.distinctSubjects, observedAcrossDistinctPeriods: value.recurrenceCounts.distinctPeriods,
      })
    : recurrenceOf(value.support, value.contradict, value.inconclusive);
  const sample = sampleOf(recurrence, input.policy);
  const consistency = consistencyOf(recurrence, sample, Boolean(value.variances?.length), input.policy);
  const meanConfidence = average([...value.support, ...value.contradict].map(reference => reference.confidence), 0);
  return deepFreeze({
    key, category: value.category, type: value.type, statementCode: value.statementCode, scope: value.scope,
    supportingAssessments: Object.freeze(value.support.slice(0, input.policy.limits.supportingReferences)),
    contradictingAssessments: Object.freeze(value.contradict.slice(0, input.policy.limits.contradictingReferences)),
    inconclusiveAssessments: Object.freeze(value.inconclusive.slice(0, input.policy.limits.contradictingReferences)),
    observedEffect: value.effect, recurrence, consistency, sample,
    confidence: assessment(meanConfidence * (consistency.score?.value ?? 0) / 100, "candidate evidence and consistency"),
    applicabilityConditions: Object.freeze((value.conditions ?? []).slice(0, input.policy.limits.conditions)),
    materialityHint: value.materialityHint ?? "unknown", metricVariances: Object.freeze(value.variances ?? []),
  });
}

function establish(candidateValue: PortfolioLearningPatternCandidate, input: EvaluatePortfolioLearningInput, fingerprint: string, predecessor?: PortfolioLearning): PortfolioLearning {
  const contradiction = contradictionOf(candidateValue, input.policy);
  const evidence = evidenceOf(candidateValue, input);
  const applicability = applicabilityOf(candidateValue);
  const freshness = freshnessOf([...candidateValue.supportingAssessments, ...candidateValue.contradictingAssessments], input.evaluatedAt, input.policy);
  const confidence = confidenceOf(candidateValue, evidence, applicability, freshness, input.policy);
  const maturity = maturityOf(candidateValue, contradiction, confidence, freshness, input.policy);
  const materiality = materialityOf(candidateValue);
  const priority = priorityOf(materiality, candidateValue, contradiction);
  const readiness = maturity === "validated" || maturity === "supported" ? "ready" : maturity === "emerging" ? "emerging" : maturity === "contested" ? "limited" : "blocked";
  const limitations = limitationsOf(candidateValue, contradiction, confidence, freshness);
  const snapshot = stableHash(`${fingerprint}|${keyString(candidateValue.key)}|${candidateValue.recurrence.supportingCount}|${candidateValue.recurrence.contradictingCount}`);
  const id = createPortfolioLearningId(`portfolio-learning-${snapshot}`);
  return deepFreeze({
    id, ownerId: input.portfolio.ownerId, portfolioId: input.portfolio.portfolioId, key: candidateValue.key,
    category: candidateValue.category, type: candidateValue.type, statementCode: candidateValue.statementCode,
    status: maturity === "invalidated" ? "retired" : maturity === "contested" ? "under-review" : "active",
    maturity, priority, readiness, scope: candidateValue.scope,
    pattern: Object.freeze({
      direction: candidateValue.observedEffect.kind === "qualitative" ? candidateValue.observedEffect.direction
        : candidateValue.type === "failure-pattern" || candidateValue.type === "assumption-bias" ? "negative" : candidateValue.observedEffect.kind === "quantitative" ? candidateValue.observedEffect.direction === "mixed" ? "mixed" : candidateValue.observedEffect.direction === "increase" ? "positive" : "negative" : "mixed",
      relationship: candidateValue.type === "assumption-bias" ? "systematic-bias" : candidateValue.type === "measurement-pattern" ? "measurement-limitation" : candidateValue.type === "conditional-pattern" ? "conditioned-by" : "associated-with",
      subject: subjectFromCandidate(candidateValue), outcome: Object.freeze({
        metricKeys: candidateValue.metricVariances.map(value => value.metricKey),
        outcomeClassifications: classificationsFromEffect(candidateValue.observedEffect),
        affectedHealthDimensions: Object.freeze([]),
        ...(candidateValue.scope.recommendationTypes[0] && candidateValue.observedEffect.kind === "classification" ? { recommendationEffectiveness: recommendationEffectivenessFromCode(candidateValue.statementCode) } : {}),
        qualitativeEffectCodes: candidateValue.observedEffect.kind === "qualitative" ? candidateValue.observedEffect.effectCodes : Object.freeze([]),
      }), effect: candidateValue.observedEffect, recurrence: candidateValue.recurrence, consistency: candidateValue.consistency,
    }),
    evidence, contradictions: contradiction, applicability, materiality, confidence, freshness,
    persistence: persistenceOf(candidateValue.recurrence), limitations,
    lineage: Object.freeze({
      portfolioVersion: input.portfolio.portfolioVersion,
      decisionOutcomeAssessmentIds: input.decisionOutcomes.filter(item => evidence.decisionOutcomeAssessments.some(ref => ref.assessmentId === item.id.value)).map(item => item.id),
      recommendationEffectivenessAssessmentIds: input.recommendationEffectiveness.filter(item => evidence.recommendationEffectivenessAssessments.some(ref => ref.assessmentId === item.id.value)).map(item => item.id),
      ...(predecessor ? { predecessorLearningId: predecessor.id } : {}), snapshotFingerprint: snapshot,
    }),
    policyVersion: input.policy.version, evaluatedAt: new Date(input.evaluatedAt),
    effectiveFrom: new Date(input.observationWindow.start), effectiveThrough: new Date(input.observationWindow.end),
    version: predecessor ? predecessor.version + 1 : 1,
  });
}

function compareAssessmentLearnings(previous: PortfolioLearningAssessment | undefined, current: readonly PortfolioLearning[], policy: PortfolioLearningPolicy): PortfolioLearningChange[] {
  if (!previous || previous.policyVersion !== policy.version) return [];
  const old = new Map(previous.learnings.map(value => [keyString(value.key), value]));
  return current.flatMap(value => {
    const prior = old.get(keyString(value.key)); if (!prior) return [];
    const supportIds = new Set(prior.evidence.decisionOutcomeAssessments.concat(prior.evidence.recommendationEffectivenessAssessments).map(ref => ref.assessmentId));
    const contradictionIds = new Set(prior.contradictions.references.map(ref => ref.assessmentId));
    const support = value.evidence.decisionOutcomeAssessments.concat(value.evidence.recommendationEffectivenessAssessments).filter(ref => !supportIds.has(ref.assessmentId));
    const contradict = value.contradictions.references.filter(ref => !contradictionIds.has(ref.assessmentId));
    const confidenceChange = value.confidence.assessment.score.value - prior.confidence.assessment.score.value;
    const priorConditions = new Set(prior.applicability.supportedConditions.map(conditionString)), currentConditions = new Set(value.applicability.supportedConditions.map(conditionString));
    const added = value.applicability.supportedConditions.filter(condition => !priorConditions.has(conditionString(condition)));
    const removed = prior.applicability.supportedConditions.filter(condition => !currentConditions.has(conditionString(condition)));
    const direction: PortfolioLearningChange["direction"] = value.maturity === "invalidated" ? "invalidated" : contradict.length ? "contradicted" : removed.length ? "narrowed" : added.length ? "broadened" : confidenceChange > 5 ? "strengthened" : confidenceChange < -5 ? "weakened" : "unchanged";
    return [deepFreeze({
      learningKey: value.key, comparable: true, direction,
      ...(prior.maturity !== value.maturity ? { maturityChange: { from: prior.maturity, to: value.maturity } } : {}),
      confidenceChange, newSupportingEvidence: support, newContradictingEvidence: contradict,
      applicabilityChanges: Object.freeze([...added.map(condition => ({ type: "added" as const, condition })), ...removed.map(condition => ({ type: "removed" as const, condition }))]),
    })];
  }).sort((a, b) => keyString(a.learningKey).localeCompare(keyString(b.learningKey)));
}

function normalizeCandidates(values: readonly PortfolioLearningPatternCandidate[], policy: PortfolioLearningPolicy) {
  const merged = new Map<string, PortfolioLearningPatternCandidate>();
  for (const value of [...values].sort((a, b) => keyString(a.key).localeCompare(keyString(b.key)))) {
    const key = keyString(value.key), existing = merged.get(key);
    if (!existing) { merged.set(key, value); continue; }
    const support = uniqueRefs([...existing.supportingAssessments, ...value.supportingAssessments]);
    const contradict = uniqueRefs([...existing.contradictingAssessments, ...value.contradictingAssessments]);
    const inconclusive = uniqueRefs([...existing.inconclusiveAssessments, ...value.inconclusiveAssessments]);
    const recurrence = recurrenceOf(support, contradict, inconclusive), sample = sampleOf(recurrence, policy), consistency = consistencyOf(recurrence, sample, existing.consistency.varianceAvailable || value.consistency.varianceAvailable, policy);
    merged.set(key, deepFreeze({ ...existing, supportingAssessments: support, contradictingAssessments: contradict, inconclusiveAssessments: inconclusive, recurrence, sample, consistency }));
  }
  return [...merged.values()];
}

function recurrenceOf(support: readonly PortfolioLearningAssessmentReference[], contradict: readonly PortfolioLearningAssessmentReference[], inconclusive: readonly PortfolioLearningAssessmentReference[]): PortfolioLearningRecurrence {
  const conclusive = support.length + contradict.length;
  const all = [...support, ...contradict, ...inconclusive];
  return Object.freeze({
    eligibleAssessmentCount: all.length, supportingCount: support.length, contradictingCount: contradict.length, inconclusiveCount: inconclusive.length,
    supportRate: conclusive ? Percentage.create(support.length / conclusive * 100) : null,
    contradictionRate: conclusive ? Percentage.create(contradict.length / conclusive * 100) : null,
    observedAcrossDistinctSubjects: new Set(all.map(value => value.subjectId).filter(Boolean)).size,
    observedAcrossDistinctPeriods: new Set(all.map(value => value.periodKey).filter(Boolean)).size,
  });
}
function sampleOf(value: PortfolioLearningRecurrence, policy: PortfolioLearningPolicy): PortfolioLearningSampleAssessment {
  const limitations = [
    ...(value.eligibleAssessmentCount < policy.sample.supported ? ["SAMPLE_TOO_SMALL" as const] : []),
    ...(value.observedAcrossDistinctSubjects < policy.sample.minimumDistinctSubjects ? ["SUBJECT_DIVERSITY_LOW" as const] : []),
    ...(value.observedAcrossDistinctPeriods < 1 ? ["PERIOD_DIVERSITY_LOW" as const] : []),
  ];
  return Object.freeze({ eligibleCount: value.eligibleAssessmentCount, minimumRequired: policy.sample.supported, distinctSubjectCount: value.observedAcrossDistinctSubjects, minimumDistinctSubjects: policy.sample.minimumDistinctSubjects, distinctPeriodCount: value.observedAcrossDistinctPeriods, sufficient: limitations.length === 0, limitations: Object.freeze(limitations) });
}
function consistencyOf(value: PortfolioLearningRecurrence, sample: PortfolioLearningSampleAssessment, variance: boolean, policy: PortfolioLearningPolicy): PortfolioLearningConsistency {
  const rate = value.supportRate?.value;
  const classification = rate === undefined ? "unknown" : (value.contradictionRate?.value ?? 0) >= policy.contradiction.dominantRate ? "contradictory" : rate >= policy.consistency.highSupportRate ? "high" : rate >= policy.consistency.moderateSupportRate ? "moderate" : "low";
  return Object.freeze({
    classification, score: rate === undefined ? null : Score.create(rate), varianceAvailable: variance,
    limitingFactors: Object.freeze([
      ...(!sample.sufficient ? ["SMALL_SAMPLE" as const] : []),
      ...(sample.distinctSubjectCount < sample.minimumDistinctSubjects ? ["LOW_SUBJECT_DIVERSITY" as const] : []),
      ...(sample.distinctPeriodCount < 2 ? ["LOW_PERIOD_DIVERSITY" as const] : []),
      ...(classification === "contradictory" ? ["CONTRADICTORY_EVIDENCE" as const] : []),
    ]),
  });
}
function contradictionOf(value: PortfolioLearningPatternCandidate, policy: PortfolioLearningPolicy): PortfolioLearningContradictionSummary {
  const rate = value.recurrence.contradictionRate;
  const status = !rate ? "unknown" : value.recurrence.contradictingCount === 0 ? "none" : rate.value >= policy.contradiction.dominantRate ? "dominant" : rate.value >= policy.contradiction.materialRate ? "material" : "minor";
  return Object.freeze({ status, count: value.recurrence.contradictingCount, proportion: rate, references: value.contradictingAssessments, contextualExplanations: Object.freeze([]) });
}
function evidenceOf(value: PortfolioLearningPatternCandidate, input: EvaluatePortfolioLearningInput): PortfolioLearningEvidenceSummary {
  const refs = [...value.supportingAssessments, ...value.contradictingAssessments, ...value.inconclusiveAssessments];
  const decisions = uniqueRefs(refs.filter(ref => ref.type === "decision-outcome"));
  const recommendations = uniqueRefs(refs.filter(ref => ref.type === "recommendation-effectiveness"));
  const assessmentValues = input.decisionOutcomes.filter(item => decisions.some(ref => ref.assessmentId === item.id.value));
  const effectivenessValues = input.recommendationEffectiveness.filter(item => recommendations.some(ref => ref.assessmentId === item.id.value));
  const coverageValues = [...assessmentValues.map(item => item.confidence.coverage.value), ...effectivenessValues.map(item => item.evidence.evidenceCoverage.value)];
  const attributionValues = [...assessmentValues.map(item => item.attribution.confidence.score.value), ...effectivenessValues.map(item => item.evidence.attributionQuality.score.value)];
  return Object.freeze({
    decisionOutcomeAssessments: decisions, recommendationEffectivenessAssessments: recommendations,
    totalEligible: value.recurrence.eligibleAssessmentCount, totalSupporting: value.recurrence.supportingCount,
    totalContradicting: value.recurrence.contradictingCount, totalInconclusive: value.recurrence.inconclusiveCount,
    evidenceCoverage: Percentage.create(average(coverageValues, 0)),
    averageOutcomeConfidence: assessment(average(refs.map(ref => ref.confidence), 0), "supporting assessment confidence"),
    averageAttributionConfidence: assessment(average(attributionValues, 0), "supporting attribution confidence"),
    dataFreshness: freshnessOf(refs, input.evaluatedAt, input.policy),
  });
}
function applicabilityOf(value: PortfolioLearningPatternCandidate): PortfolioLearningApplicability {
  const conditions = value.applicabilityConditions;
  const status = !conditions.length ? (value.recurrence.observedAcrossDistinctSubjects >= 3 ? "broad" : "unknown") : conditions.length === 1 ? "narrow" : "conditional";
  return Object.freeze({ status, supportedConditions: conditions, unsupportedConditions: Object.freeze([]), contradictedConditions: Object.freeze([]), boundaryConfidence: assessment(conditions.length ? 70 : status === "broad" ? 80 : 30, "observed applicability boundary") });
}
function confidenceOf(value: PortfolioLearningPatternCandidate, evidence: PortfolioLearningEvidenceSummary, applicability: PortfolioLearningApplicability, freshness: PortfolioLearningFreshness, policy: PortfolioLearningPolicy): PortfolioLearningConfidence {
  const sampleScore = Math.min(100, value.sample.eligibleCount / policy.sample.validated * 100);
  const consistency = value.consistency.score?.value ?? 0, evidenceScore = evidence.evidenceCoverage.value;
  const contextScore = applicability.status === "broad" ? 90 : applicability.status === "conditional" ? 75 : applicability.status === "narrow" ? 60 : 30;
  const recency = freshness === "current" ? 100 : freshness === "aging" ? 70 : freshness === "stale" ? 35 : 15;
  const penalties = [
    ...(value.recurrence.contradictingCount ? [{ code: "CONTRADICTORY_EVIDENCE", points: (value.recurrence.contradictionRate?.value ?? 0) * 0.2 }] : []),
    ...(value.sample.distinctSubjectCount < policy.sample.minimumDistinctSubjects ? [{ code: "LOW_SUBJECT_DIVERSITY", points: 10 }] : []),
    ...(applicability.status === "unknown" ? [{ code: "CONTEXT_INCOMPLETE", points: 10 }] : []),
  ];
  const total = Math.max(0, Math.min(100, sampleScore * 0.2 + consistency * 0.2 + evidenceScore * 0.2 + evidence.averageAttributionConfidence.score.value * 0.15 + contextScore * 0.1 + recency * 0.15 - penalties.reduce((sum, item) => sum + item.points, 0)));
  return Object.freeze({
    assessment: assessment(total, "sample, consistency, evidence, attribution, context, and recency"),
    sampleQuality: assessment(sampleScore, "sample diversity"), consistencyQuality: assessment(consistency, "pattern consistency"),
    evidenceQuality: assessment(evidenceScore, "evidence coverage"), attributionQuality: evidence.averageAttributionConfidence,
    contextQuality: assessment(contextScore, "applicability context"), recencyQuality: assessment(recency, "evidence recency"),
    penalties: Object.freeze(penalties),
  });
}
function maturityOf(value: PortfolioLearningPatternCandidate, contradiction: PortfolioLearningContradictionSummary, confidence: PortfolioLearningConfidence, freshness: PortfolioLearningFreshness, policy: PortfolioLearningPolicy): PortfolioLearningMaturity {
  const contradictionRate = contradiction.proportion?.value ?? 0;
  if (contradictionRate >= policy.contradiction.invalidationRate) return "invalidated";
  if (contradiction.status === "material" || contradiction.status === "dominant") return "contested";
  if (value.sample.eligibleCount >= policy.sample.validated && value.sample.distinctSubjectCount >= policy.sample.validatedDistinctSubjects && value.sample.distinctPeriodCount >= policy.sample.validatedDistinctPeriods && confidence.assessment.score.value >= policy.confidence.validated && freshness !== "stale" && freshness !== "historical") return "validated";
  if (value.sample.sufficient && confidence.assessment.score.value >= policy.confidence.supported) return "supported";
  if (value.sample.eligibleCount >= policy.sample.emerging) return "emerging";
  return "candidate";
}
function materialityOf(value: PortfolioLearningPatternCandidate): PortfolioLearningMateriality {
  const financial = financialMedian(value.metricVariances);
  const classification = value.materialityHint === "critical" ? "transformational" : value.materialityHint === "high" ? "material" : value.materialityHint === "moderate" ? "moderate" : financial ? "moderate" : "unknown";
  return Object.freeze({
    classification,
    ...(financial ? { financialImpact: Object.freeze({ currency: financial.currency, amount: financial.amount, methodology: "median-authoritative-li-002-variance" }) } : {}),
    strategicImpact: value.materialityHint === "critical" || value.materialityHint === "high" ? "high" : value.materialityHint === "moderate" ? "moderate" : "unknown",
    evidence: value.supportingAssessments,
  });
}
function exceptionalLearnings(values: readonly DecisionOutcomeAssessment[], policy: PortfolioLearningPolicy): PortfolioExceptionalLearning[] {
  return values.filter(value => value.classification === "harmful" && value.harm.material && value.confidence.assessment.score.value >= policy.confidence.minimumEligible).map(value => Object.freeze({ severity: "critical" as const, eventReference: decisionRefWithoutContext(value), recurrenceRequired: false as const, confidence: value.confidence.assessment, limitationCode: "SINGLE_EVENT" as const }));
}

function measurementCandidate(input: EvaluatePortfolioLearningInput, eligible: Eligible, values: readonly DecisionOutcomeAssessment[], code: "MISSING_BASELINES_LIMIT_LEARNING" | "INCONCLUSIVE_OUTCOMES_LIMIT_LEARNING" | "LOW_ATTRIBUTION_LIMITS_LEARNING", practice: string) {
  return candidate(input, eligible, {
    category: "measurement", type: "measurement-pattern", statementCode: code,
    subject: { type: "measurement-practice", practiceCode: practice },
    support: values.map(value => decisionRef(value, eligible)), contradict: [], inconclusive: [],
    scope: scopeFor(input, eligible, values, { level: "portfolio" }),
    effect: { kind: "qualitative", effectCodes: [practice], direction: "negative" }, materialityHint: "moderate",
  });
}
function scopeFor(input: EvaluatePortfolioLearningInput, eligible: Eligible, values: readonly DecisionOutcomeAssessment[], patch: Partial<PortfolioLearningScope>): PortfolioLearningScope {
  const contexts = values.map(value => eligible.contexts.get(value.id.value)).filter((value): value is PortfolioLearningAssessmentContext => Boolean(value));
  return deepFreeze({
    level: "portfolio", subjectIds: unique(contexts.map(value => value.subjectId)), marketKeys: unique(contexts.map(value => value.market).filter(Boolean) as string[]),
    propertyTypes: unique(contexts.map(value => value.propertyType).filter(Boolean) as string[]),
    operatingModels: unique(contexts.map(value => value.operatingModel).filter(Boolean) as string[]),
    recommendationTypes: Object.freeze([]), decisionTypes: unique(contexts.map(value => value.decisionType)),
    observationWindow: cloneWindow(input.observationWindow), ...patch,
  });
}
function segmentedConditions(input: EvaluatePortfolioLearningInput, eligible: Eligible, values: readonly DecisionOutcomeAssessment[]): PortfolioLearningCondition[] {
  const contexts = values.map(value => eligible.contexts.get(value.id.value)!).filter(Boolean);
  const mappings: readonly [PortfolioLearningCondition["dimension"], (context: PortfolioLearningAssessmentContext) => string | undefined][] = [
    ["market", value => value.market], ["property-type", value => value.propertyType], ["operating-model", value => value.operatingModel],
    ["seasonality", value => value.seasonality], ["portfolio-stage", () => input.portfolio.lifecycleStage],
    ["capital-posture", value => value.capitalPosture], ["health-band", value => value.healthBand], ["execution-speed", value => value.executionSpeed],
  ];
  return mappings.filter(([dimension]) => input.policy.segmentation.approvedDimensions.includes(dimension)).flatMap(([dimension, read]) => {
    const groups = group(contexts.filter(value => read(value)), value => read(value)!);
    return [...groups.entries()].filter(([, groupValues]) => groupValues.length >= input.policy.segmentation.minimumSegmentSample).map(([value]) => Object.freeze({ dimension, operator: "equals" as const, value }));
  }).sort((a, b) => conditionString(a).localeCompare(conditionString(b))).slice(0, input.policy.segmentation.maximumSegments);
}
function decisionRef(value: DecisionOutcomeAssessment, eligible: Eligible): PortfolioLearningAssessmentReference {
  const context = eligible.contexts.get(value.id.value)!;
  return Object.freeze({ type: "decision-outcome", assessmentId: value.id.value, version: value.version, subjectId: context.subjectId, periodKey: context.periodKey, confidence: value.confidence.assessment.score.value });
}
function decisionRefWithoutContext(value: DecisionOutcomeAssessment): PortfolioLearningAssessmentReference {
  return Object.freeze({ type: "decision-outcome", assessmentId: value.id.value, version: value.version, confidence: value.confidence.assessment.score.value });
}
function effectivenessRef(value: RecommendationEffectivenessAssessment): PortfolioLearningAssessmentReference {
  return Object.freeze({ type: "recommendation-effectiveness", assessmentId: value.id.value, version: value.version, subjectId: value.recommendationType.value, periodKey: periodKey(value.evaluatedAt), confidence: value.confidence.assessment.score.value });
}
function classificationDistribution(values: readonly DecisionOutcomeAssessment[]): Record<OutcomeClassification, number> {
  return { successful: count(values, "successful"), "partially-successful": count(values, "partially-successful"), unsuccessful: count(values, "unsuccessful"), harmful: count(values, "harmful"), inconclusive: count(values, "inconclusive") };
}
function recommendationDistribution(value: RecommendationEffectivenessAssessment): Record<OutcomeClassification, number> {
  return { successful: value.outcomeDistribution.successful, "partially-successful": value.outcomeDistribution.partiallySuccessful, unsuccessful: value.outcomeDistribution.unsuccessful, harmful: value.outcomeDistribution.harmful, inconclusive: value.outcomeDistribution.inconclusive };
}
function quantitativeEffect(metricKey: OutcomeMetricKey, variances: readonly OutcomeVariance[], median: number): PortfolioLearningObservedEffect {
  const values = variances.map(varianceValue).filter((value): value is OutcomeValue => Boolean(value));
  const compatible = values.every(value => value.kind === values[0]?.kind && (value.kind !== "money" || values[0]?.kind !== "money" || value.value.currency === values[0].value.currency));
  return Object.freeze({ kind: "quantitative", metricKey, direction: median > 0 ? "increase" : median < 0 ? "decrease" : "mixed", centralEstimate: compatible ? medianOutcomeValue(values) : null, methodology: compatible ? "median" : "not-comparable" });
}
function signedVariance(value: OutcomeVariance): number | null {
  if (value.kind === "money") return value.absolute.amount;
  if (value.kind === "percentage") return value.absolutePercentagePoints;
  if (value.kind === "score" || value.kind === "ratio" || value.kind === "count" || value.kind === "duration") return value.absolute;
  return null;
}
function varianceValue(value: OutcomeVariance): OutcomeValue | null {
  if (value.kind === "money") return { kind: "money", value: value.absolute };
  if (value.kind === "ratio" || value.kind === "count") return { kind: value.kind, value: value.absolute };
  if (value.kind === "duration") return value.unit && ["minutes", "hours", "days", "months"].includes(value.unit) ? { kind: "duration", value: value.absolute, unit: value.unit as "minutes" | "hours" | "days" | "months" } : null;
  return null;
}
function medianOutcomeValue(values: readonly OutcomeValue[]): OutcomeValue | null {
  if (!values.length) return null;
  const middle = medianNumber(values.map(value => value.kind === "money" ? value.value.amount : value.kind === "ratio" || value.kind === "count" || value.kind === "duration" ? value.value : 0));
  const first = values[0]!;
  if (first.kind === "money") return { kind: "money", value: Money.usd(middle) };
  if (first.kind === "ratio") return { kind: "ratio", value: middle };
  if (first.kind === "count") return { kind: "count", value: middle };
  if (first.kind === "duration") return { kind: "duration", value: middle, unit: first.unit };
  return null;
}
function financialMedian(values: readonly Readonly<{ metricKey: OutcomeMetricKey; variance: OutcomeVariance }>[]) {
  const money = values.map(value => value.variance).filter((value): value is Extract<OutcomeVariance, { kind: "money" }> => value.kind === "money");
  if (!money.length || new Set(money.map(value => value.currency)).size > 1) return null;
  return { currency: money[0]!.currency, amount: Money.usd(medianNumber(money.map(value => value.absolute.amount))) };
}
function freshnessOf(references: readonly PortfolioLearningAssessmentReference[], evaluatedAt: Date, policy: PortfolioLearningPolicy): PortfolioLearningFreshness {
  const dates = references.map(value => value.periodKey).filter(Boolean).map(value => new Date(`${value}-01T00:00:00Z`).getTime()).filter(Number.isFinite);
  if (!dates.length) return "unknown";
  const days = (evaluatedAt.getTime() - Math.max(...dates)) / 86_400_000;
  return days <= policy.recency.currentDays ? "current" : days <= policy.recency.agingDays ? "aging" : days <= policy.recency.staleDays ? "stale" : "historical";
}
function limitationsOf(value: PortfolioLearningPatternCandidate, contradiction: PortfolioLearningContradictionSummary, confidence: PortfolioLearningConfidence, freshness: PortfolioLearningFreshness): PortfolioLearningLimitation[] {
  return [
    ...(value.sample.limitations.includes("SAMPLE_TOO_SMALL") ? [limitation("LEARNING_SAMPLE_TOO_SMALL", "material", "sample", ids(value))] : []),
    ...(value.sample.limitations.includes("SUBJECT_DIVERSITY_LOW") ? [limitation("LEARNING_SUBJECT_DIVERSITY_LOW", "material", "sample", ids(value))] : []),
    ...(value.sample.limitations.includes("PERIOD_DIVERSITY_LOW") ? [limitation("LEARNING_PERIOD_DIVERSITY_LOW", "minor", "sample", ids(value))] : []),
    ...(contradiction.status === "material" || contradiction.status === "dominant" ? [limitation("LEARNING_EVIDENCE_CONTRADICTORY", "material", "evidence", contradiction.references.map(ref => ref.assessmentId))] : []),
    ...(confidence.attributionQuality.score.value < 50 ? [limitation("LEARNING_ATTRIBUTION_WEAK", "material", "attribution", ids(value))] : []),
    ...(freshness === "stale" || freshness === "historical" ? [limitation("LEARNING_EVIDENCE_STALE", "material", "recency", ids(value))] : []),
  ];
}
function materialityRank(value: PortfolioLearningMateriality["classification"]) { return ({ transformational: 0, material: 1, moderate: 2, minor: 3, unknown: 4 })[value]; }
function priorityOf(materiality: PortfolioLearningMateriality, value: PortfolioLearningPatternCandidate, contradiction: PortfolioLearningContradictionSummary) {
  if (value.materialityHint === "critical" || contradiction.status === "dominant") return "critical" as const;
  return materialityRank(materiality.classification) <= 1 ? "high" as const : materiality.classification === "moderate" ? "medium" as const : "informational" as const;
}
function persistenceOf(value: PortfolioLearningRecurrence) { return value.observedAcrossDistinctPeriods >= 2 ? "persistent" as const : value.supportingCount > 1 ? "recurring" as const : "one-time" as const; }
function subjectFromCandidate(value: PortfolioLearningPatternCandidate): import("./model").PortfolioLearningPatternSubject {
  if (value.scope.recommendationTypes[0]) return { type: "recommendation-type", recommendationType: value.scope.recommendationTypes[0] };
  if (value.scope.decisionTypes[0]) return { type: "decision-type", decisionType: value.scope.decisionTypes[0] };
  if (value.metricVariances[0]) return { type: "assumption", metricKey: value.metricVariances[0].metricKey };
  return { type: value.category === "measurement" ? "measurement-practice" : value.category === "execution" ? "execution-behavior" : "portfolio-condition", ...(value.category === "measurement" ? { practiceCode: value.statementCode } : value.category === "execution" ? { behaviorCode: value.statementCode } : { conditionCode: value.statementCode }) } as import("./model").PortfolioLearningPatternSubject;
}
function classificationsFromEffect(value: PortfolioLearningObservedEffect): readonly OutcomeClassification[] { return value.kind === "classification" ? Object.entries(value.distribution).filter(([, countValue]) => countValue > 0).map(([key]) => key as OutcomeClassification).sort() : Object.freeze([]); }
function recommendationEffectivenessFromCode(code: PortfolioLearningStatementCode) { return code === "RECOMMENDATION_TYPE_HARMFUL" ? "harmful" as const : code === "RECOMMENDATION_TYPE_INEFFECTIVE" ? "ineffective" as const : code === "RECOMMENDATION_TYPE_EFFECTIVE_CONDITIONALLY" ? "mixed" as const : "effective" as const; }
function snapshotFingerprint(input: EvaluatePortfolioLearningInput, eligible: Eligible) {
  return stableHash(canonical({
    portfolioId: input.portfolio.portfolioId, portfolioVersion: input.portfolio.portfolioVersion,
    decisionAssessments: eligible.decisions.map(value => `${value.id.value}:${value.version}`).sort(),
    effectivenessAssessments: eligible.effectiveness.map(value => `${value.id.value}:${value.version}`).sort(),
    policy: input.policy.version, window: [input.observationWindow.start.toISOString(), input.observationWindow.end.toISOString()],
    contexts: [...eligible.contexts.values()].map(value => canonical(value)).sort(),
  }));
}
function validatePortfolio(input: EvaluatePortfolioLearningInput) {
  if (!input.portfolio.portfolioId.trim() || input.portfolio.portfolioVersion < 1) throw new TypeError("Portfolio Learning requires valid portfolio context.");
  if (!input.portfolio.ownerId) throw new TypeError("Portfolio Learning requires owner context.");
}
function validWindow(value: { start: Date; end: Date }) { validDate(value.start); validDate(value.end); if (value.start >= value.end) throw new RangeError("Learning observation window start must precede end."); }
function validDate(value: Date) { if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("Portfolio Learning date must be valid."); }
function assessment(value: number, rationale: string) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(Math.max(0, Math.min(100, value))), rationale: [rationale] }); }
function limitation(code: PortfolioLearningLimitation["code"], impact: PortfolioLearningLimitation["impact"], source: PortfolioLearningLimitation["source"], affectedAssessmentIds: readonly string[]): PortfolioLearningLimitation { return Object.freeze({ code, impact, source, affectedAssessmentIds: Object.freeze(unique(affectedAssessmentIds)) }); }
function uniqueRefs(values: readonly PortfolioLearningAssessmentReference[]) { return Object.freeze([...new Map(values.map(value => [`${value.type}:${value.assessmentId}`, value])).values()].sort((a, b) => `${a.type}:${a.assessmentId}`.localeCompare(`${b.type}:${b.assessmentId}`))); }
function ids(value: PortfolioLearningPatternCandidate) { return [...value.supportingAssessments, ...value.contradictingAssessments].map(ref => ref.assessmentId); }
function count(values: readonly DecisionOutcomeAssessment[], classification: OutcomeClassification) { return values.filter(value => value.classification === classification).length; }
function periodKey(value: Date) { return value.toISOString().slice(0, 7); }
function medianNumber(values: readonly number[]) { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2; }
function average(values: readonly number[], fallback: number) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback; }
function unique(values: readonly string[]) { return Object.freeze([...new Set(values)].sort()); }
function group<T>(values: readonly T[], key: (value: T) => string) { const result = new Map<string, T[]>(); for (const value of values) result.set(key(value), [...(result.get(key(value)) ?? []), value]); return result; }
function keyString(value: PortfolioLearningKey) { return `${value.portfolioId}|${value.category}|${value.type}|${value.statementCode}|${value.scopeFingerprint}`; }
function conditionString(value: PortfolioLearningCondition) { return `${value.dimension}|${value.operator}|${Array.isArray(value.value) ? [...value.value].sort().join(",") : String(value.value)}`; }
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, "0"); }
function cloneWindow(value: { start: Date; end: Date }) { return Object.freeze({ start: new Date(value.start), end: new Date(value.end) }); }
function assessmentOrder(a: DecisionOutcomeAssessment, b: DecisionOutcomeAssessment) { return a.id.value.localeCompare(b.id.value) || b.version - a.version; }
function effectivenessOrder(a: RecommendationEffectivenessAssessment, b: RecommendationEffectivenessAssessment) { return a.id.value.localeCompare(b.id.value) || b.version - a.version; }
function learningOrder(a: PortfolioLearning, b: PortfolioLearning) { return priorityRank(a.priority) - priorityRank(b.priority) || b.confidence.assessment.score.value - a.confidence.assessment.score.value || keyString(a.key).localeCompare(keyString(b.key)); }
function priorityRank(value: PortfolioLearning["priority"]) { return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 })[value]; }
function limitationOrder(a: PortfolioLearningLimitation, b: PortfolioLearningLimitation) { return `${a.code}:${a.affectedAssessmentIds.join(",")}`.localeCompare(`${b.code}:${b.affectedAssessmentIds.join(",")}`); }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested); } return value; }

import type { DecisionOutcomeAssessment, ObjectiveAssessment } from "@/features/learning-intelligence/decision-outcomes";
import type {
  PortfolioDecisionCandidate, PortfolioStrategicDecision,
} from "../decisions";
import type {
  BuildOutcomeReviewInput, OutcomeReviewReadiness, PortfolioDecisionOutcomeReview,
  PortfolioLearningRecord, PortfolioOutcomeSuccess, PortfolioOutcomesWorkspace,
  RecommendationPerformance, StrategyEffectiveness,
} from "./contracts";
import {
  PORTFOLIO_OUTCOME_POLICY, calibration, confidenceAdjustment,
  confidenceForReviews, knowledgeMaturity,
} from "./policies";

export function buildPortfolioDecisionOutcomeReview(input: BuildOutcomeReviewInput): PortfolioDecisionOutcomeReview {
  if (input.decision.status !== "approved" && input.decision.status !== "completed") throw new TypeError("Only approved or completed decisions can be reviewed.");
  if (!input.assessment.decisionReferences.some(({ decisionId }) =>
    decisionId === input.decision.canonicalDecisionId || decisionId === input.decision.decisionId,
  )) throw new TypeError("Canonical outcome assessment is not linked to this Portfolio Decision.");
  const success = successFromAssessment(input.assessment);
  const metrics = input.assessment.objectives.map((objective) => metricReview(objective, input.evidence));
  return Object.freeze({
    id: `portfolio-review:${input.assessment.id.value}:v${input.assessment.version}`,
    workspaceId: input.workspaceId, decisionId: input.decision.decisionId,
    outcomeId: input.assessment.outcomeId.value, assessmentId: input.assessment.id.value,
    assessmentVersion: input.assessment.version,
    decisionEvidenceVersion: input.decision.evidenceVersion,
    reviewDate: input.reviewedAt,
    baseline: metrics.map(({ metric, baseline }) => `${metric}: ${baseline}`),
    expected: metrics.map(({ metric, expected }) => `${metric}: ${expected}`),
    actual: metrics.map(({ metric, actual }) => `${metric}: ${actual}`),
    metrics, success, lessons: input.lessons, assumptions: input.assumptionReviews,
    confidence: input.assessment.confidence.assessment.level,
    confidenceAdjustment: confidenceAdjustment(success), evidence: input.evidence,
    reviewedByProfileId: input.reviewedByProfileId, immutable: true,
    createdAt: input.reviewedAt,
  });
}

export function evaluateOutcomeReviewReadiness(input: Readonly<{
  decision: PortfolioStrategicDecision; executionComplete: boolean;
  evidenceCount: number; freshness: "current" | "stale" | "degraded" | "unknown"; now: string;
}>): OutcomeReviewReadiness {
  const reasons: string[] = [];
  if (!["approved", "completed"].includes(input.decision.status)) reasons.push("Decision is not approved.");
  if (!input.executionComplete) reasons.push("Execution is not complete.");
  if (!input.decision.reviewAt || new Date(input.decision.reviewAt) > new Date(input.now)) reasons.push("The measurement window has not elapsed.");
  if (input.evidenceCount < PORTFOLIO_OUTCOME_POLICY.minimumEvidenceReferences) reasons.push("Outcome evidence is insufficient.");
  const state = input.freshness === "degraded" || input.freshness === "stale" ? "degraded"
    : reasons.some((reason) => reason.includes("evidence")) ? "insufficient-evidence"
      : reasons.length ? "not-ready" : "ready";
  return { decisionId: input.decision.decisionId, state, reasons, ...(input.decision.reviewAt ? { reviewAt: input.decision.reviewAt } : {}) };
}

export function generatePortfolioLearning(
  reviews: readonly PortfolioDecisionOutcomeReview[],
  now: string,
): readonly PortfolioLearningRecord[] {
  const groups = new Map<string, PortfolioDecisionOutcomeReview[]>();
  for (const review of reviews) {
    const key = review.metrics[0]?.dimension ?? "strategic";
    groups.set(key, [...(groups.get(key) ?? []), review]);
  }
  return [...groups].map(([category, values]) => {
    const successful = values.filter(({ success }) => success === "exceeded-expectations" || success === "met-expectations");
    const contradictory = successful.length > 0 && successful.length < values.length;
    return Object.freeze({
      id: `portfolio-learning:${category}:v${values.length}`, workspaceId: values[0].workspaceId,
      category: learningCategory(category),
      lesson: successful.length >= values.length / 2
        ? `${title(category)} decisions have generally met or exceeded their measured expectations.`
        : `${title(category)} decisions have frequently fallen short or remained inconclusive.`,
      futureGuidance: latest(values).lessons.futureGuidance,
      evidence: values.flatMap(({ evidence }) => evidence),
      confidence: confidenceForReviews(values.length),
      maturity: knowledgeMaturity(values.length, contradictory),
      derivedFromReviewIds: values.map(({ id }) => id), createdAt: now, version: values.length,
    });
  });
}

export function buildPortfolioOutcomesWorkspace(input: Readonly<{
  decisions: readonly PortfolioStrategicDecision[];
  candidates: readonly PortfolioDecisionCandidate[];
  reviews: readonly PortfolioDecisionOutcomeReview[];
  learnings?: readonly PortfolioLearningRecord[]; readiness: readonly OutcomeReviewReadiness[];
  role: PortfolioOutcomesWorkspace["role"]; evaluatedAt: string;
}>): PortfolioOutcomesWorkspace {
  const learnings = input.learnings?.length ? input.learnings : generatePortfolioLearning(input.reviews, input.evaluatedAt);
  const eligible = input.decisions.filter(({ status }) => ["approved", "completed"].includes(status)).length;
  const summary = {
    reviewed: input.reviews.length,
    exceeded: input.reviews.filter(({ success }) => success === "exceeded-expectations").length,
    met: input.reviews.filter(({ success }) => success === "met-expectations").length,
    partiallyMet: input.reviews.filter(({ success }) => success === "partially-met").length,
    didNotMeet: input.reviews.filter(({ success }) => success === "did-not-meet").length,
    unable: input.reviews.filter(({ success }) => success === "unable-to-evaluate").length,
    reviewCompletion: eligible ? input.reviews.length / eligible : 0,
  };
  const canReview = input.role === "owner" || input.role === "administrator";
  const state = input.readiness.some(({ state }) => state === "degraded") ? "degraded"
    : input.readiness.some(({ state }) => state === "insufficient-evidence") ? "insufficient-evidence"
      : !canReview && input.role !== "operator" ? "permission-limited"
        : input.reviews.length || input.readiness.some(({ state }) => state === "ready") ? "ready" : "empty";
  return {
    reviews: input.reviews, readiness: input.readiness, learnings,
    recommendationPerformance: recommendationPerformance(input.candidates, input.decisions, input.reviews),
    strategyEffectiveness: strategyEffectiveness(input.decisions, input.reviews),
    summary, state, role: input.role, canReview, evaluatedAt: input.evaluatedAt,
  };
}

function successFromAssessment(assessment: DecisionOutcomeAssessment): PortfolioOutcomeSuccess {
  if (assessment.classification === "inconclusive") return "unable-to-evaluate";
  if (assessment.classification === "partially-successful") return "partially-met";
  if (assessment.classification === "unsuccessful" || assessment.classification === "harmful") return "did-not-meet";
  return assessment.objectives.some(({ status }) => status === "exceeded") ? "exceeded-expectations" : "met-expectations";
}
function metricReview(objective: ObjectiveAssessment, evidence: BuildOutcomeReviewInput["evidence"]) {
  return {
    metric: objective.metric.name, dimension: dimension(objective.metric.key.value),
    baseline: outcomeValue(objective.baseline), expected: targetValue(objective.target),
    actual: outcomeValue(objective.actual), variance: objective.variance,
    direction: objective.variance?.direction === "none" ? "neutral" : objective.variance?.direction ?? "unknown",
    status: objective.status, confidence: objective.confidence.level, evidence,
  } as const;
}
function recommendationPerformance(
  candidates: readonly PortfolioDecisionCandidate[], decisions: readonly PortfolioStrategicDecision[],
  reviews: readonly PortfolioDecisionOutcomeReview[],
): RecommendationPerformance {
  const strengths = [...new Set(candidates.map(({ recommendationStrength }) => recommendationStrength))];
  return {
    generated: candidates.length, approved: decisions.filter(({ status }) => status === "approved" || status === "completed").length,
    completed: reviews.length, successful: reviews.filter(({ success }) => success === "exceeded-expectations" || success === "met-expectations").length,
    rejected: decisions.filter(({ status }) => status === "rejected").length,
    deferred: decisions.filter(({ status }) => status === "deferred").length,
    expired: decisions.filter(({ status }) => status === "expired").length,
    byStrength: strengths.map((strength) => {
      const ids = new Set(candidates.filter((item) => item.recommendationStrength === strength).map(({ id }) => id));
      const reviewed = reviews.filter((review) => decisions.some((decision) => decision.decisionId === review.decisionId && decision.recommendationId && ids.has(decision.recommendationId)));
      const successful = reviewed.filter(({ success }) => success === "exceeded-expectations" || success === "met-expectations").length;
      return { strength, reviewed: reviewed.length, successful, successRate: reviewed.length ? successful / reviewed.length : null, calibration: calibration(successful, reviewed.length) };
    }),
  };
}
function strategyEffectiveness(decisions: readonly PortfolioStrategicDecision[], reviews: readonly PortfolioDecisionOutcomeReview[]): readonly StrategyEffectiveness[] {
  const types = [...new Set(decisions.map(({ decisionType }) => decisionType))];
  return types.map((decisionType) => {
    const decisionIds = new Set(decisions.filter((item) => item.decisionType === decisionType).map(({ decisionId }) => decisionId));
    const values = reviews.filter(({ decisionId }) => decisionIds.has(decisionId));
    return {
      decisionType, reviewed: values.length,
      exceeded: values.filter(({ success }) => success === "exceeded-expectations").length,
      met: values.filter(({ success }) => success === "met-expectations").length,
      partial: values.filter(({ success }) => success === "partially-met").length,
      didNotMeet: values.filter(({ success }) => success === "did-not-meet").length,
      unable: values.filter(({ success }) => success === "unable-to-evaluate").length,
      confidence: confidenceForReviews(values.length),
    };
  });
}
function dimension(key: string): "financial" | "operational" | "guest" | "resilience" | "strategic" {
  return /revenue|noi|cash|margin|adr|revpar/i.test(key) ? "financial"
    : /guest|review/i.test(key) ? "guest" : /risk|divers/i.test(key) ? "resilience"
      : /operation|issue|action/i.test(key) ? "operational" : "strategic";
}
function learningCategory(category: string): PortfolioLearningRecord["category"] {
  return category === "financial" ? "revenue" : category === "operational" ? "operations"
    : category === "guest" ? "guests" : category === "resilience" ? "capital" : "execution";
}
function outcomeValue(value: ObjectiveAssessment["baseline"] | ObjectiveAssessment["actual"]): string {
  if (!value) return "Unavailable";
  if (value.kind === "money") return `${value.value.currency} ${value.value.amount}`;
  if (value.kind === "percentage") return `${value.value.value}%`;
  if (value.kind === "score") return String(value.value.value);
  if (value.kind === "boolean") return value.value ? "Yes" : "No";
  return String(value.value);
}
function targetValue(target: ObjectiveAssessment["target"]): string {
  if (target.type === "completion") return "Complete";
  if (target.type === "state") return target.expectedState;
  if (target.type === "range") return `${outcomeValue(target.minimum)}–${outcomeValue(target.maximum)}`;
  if (target.type === "relative-change") return `${target.value.value}% relative change`;
  return outcomeValue(target.value);
}
function latest(values: readonly PortfolioDecisionOutcomeReview[]) { return [...values].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))[0]; }
function title(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

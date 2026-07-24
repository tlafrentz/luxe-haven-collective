import type { OutcomeValue } from "../../outcomes";
import { confidenceScore, type ContinuousImprovementWorkspace, type ContinuousImprovementWorkspaceState, type GetContinuousImprovementWorkspaceQuery, type LearningWorkspaceAttentionItem, type LearningWorkspaceDistribution, type LearningWorkspaceLearningItem, type LearningWorkspaceLimitation, type LearningWorkspaceMeasurementReadiness, type LearningWorkspaceOutcomeItem, type LearningWorkspaceRecommendationItem, type LearningWorkspaceSources } from "./continuous-improvement-workspace";

const DEFAULTS = Object.freeze({ outcomes: 10, recommendations: 8, learnings: 12, changes: 8, attention: 6 });
const MAXIMUMS = Object.freeze({ outcomes: 25, recommendations: 20, learnings: 25, changes: 25, attention: 15 });
const classifications = ["successful", "partially-successful", "unsuccessful", "harmful", "inconclusive"] as const;
const statementLabels: Readonly<Record<string, string>> = Object.freeze({
  DECISION_TYPE_SUCCESS_REPEATABLE: "A decision type has produced repeatable beneficial outcomes.",
  DECISION_TYPE_FAILURE_REPEATABLE: "A decision type has repeatedly missed its intended outcomes.",
  ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC: "Expectations have been consistently optimistic within the measured scope.",
  ASSUMPTIONS_SYSTEMATICALLY_CONSERVATIVE: "Expectations have been consistently conservative within the measured scope.",
  GUARDRAIL_VIOLATION_RECURRING: "Guardrail violations are recurring within the measured scope.",
  UNEXPECTED_NEGATIVE_EFFECT_RECURRING: "Unexpected negative effects are recurring.",
  UNEXPECTED_POSITIVE_EFFECT_RECURRING: "Unexpected positive effects are recurring.",
  RECOMMENDATION_TYPE_EFFECTIVE: "A recommendation type has been repeatedly effective.",
  RECOMMENDATION_TYPE_INEFFECTIVE: "A recommendation type has been repeatedly ineffective.",
  RECOMMENDATION_TYPE_HARMFUL: "A recommendation type has produced repeated harmful outcomes.",
  RECOMMENDATION_TYPE_EFFECTIVE_CONDITIONALLY: "A recommendation type is effective under specific conditions.",
  PARTIAL_EXECUTION_LIMITS_OUTCOMES: "Partial execution repeatedly limits outcome quality.",
  EXECUTION_DELAY_REDUCES_OUTCOME_QUALITY: "Delayed execution is associated with weaker outcome quality.",
  MISSING_BASELINES_LIMIT_LEARNING: "Missing baselines repeatedly limit learning.",
  LOW_ATTRIBUTION_LIMITS_LEARNING: "Weak attribution repeatedly limits learning.",
  INCONCLUSIVE_OUTCOMES_LIMIT_LEARNING: "Inconclusive outcomes repeatedly limit learning.",
});

export function buildContinuousImprovementWorkspace(query: GetContinuousImprovementWorkspaceQuery, sources: LearningWorkspaceSources): ContinuousImprovementWorkspaceState {
  const limits = {
    outcomes: bounded(query.outcomeLimit, DEFAULTS.outcomes, MAXIMUMS.outcomes),
    recommendations: bounded(query.recommendationLimit, DEFAULTS.recommendations, MAXIMUMS.recommendations),
    learnings: bounded(query.learningLimit, DEFAULTS.learnings, MAXIMUMS.learnings),
    changes: bounded(query.changeLimit, DEFAULTS.changes, MAXIMUMS.changes),
    attention: bounded(query.attentionLimit, DEFAULTS.attention, MAXIMUMS.attention),
  };
  const portfolio = Object.freeze({ id: sources.portfolio.id, name: sources.portfolio.name, version: sources.portfolio.version, lifecycleStage: sources.portfolio.lifecycleStage });
  const sortedOutcomes = [...sources.outcomes].sort((a, b) => b.assessment.evaluatedAt.getTime() - a.assessment.evaluatedAt.getTime() || String(a.assessment.id).localeCompare(String(b.assessment.id)));
  if (!sortedOutcomes.length) {
    const empty = Object.freeze({ portfolio, plannedCount: sources.plannedOutcomeCount, measuringCount: sources.measuringOutcomeCount, limitations: unavailableLimitations(sources.unavailableSections) });
    return Object.freeze({ status: sources.measuringOutcomeCount > 0 ? "measurement-in-progress" : "no-outcomes", workspace: empty });
  }
  const outcomeItems = Object.freeze(sortedOutcomes.slice(0, limits.outcomes).map(mapOutcome));
  const distribution = buildDistribution(sortedOutcomes.map(({ assessment }) => assessment.classification));
  const recommendationItems = Object.freeze([...sources.recommendations].sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || String(a.id).localeCompare(String(b.id))).slice(0, limits.recommendations).map(mapRecommendation));
  const learningItems = Object.freeze((sources.learning?.learnings ?? []).slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || String(a.id).localeCompare(String(b.id))).slice(0, limits.learnings).map(mapLearning));
  const measurementItems = Object.freeze(learningItems.filter((item) => item.category === "measurement"));
  const measurementReadiness = readiness(sortedOutcomes, measurementItems, sources.unavailableSections);
  const limitations = Object.freeze([
    ...unavailableLimitations(sources.unavailableSections),
    ...(sources.learning?.limitations ?? []).map((item): LearningWorkspaceLimitation => Object.freeze({ code: item.code, section: item.source === "measurement" ? "measurement-quality" : "learnings", impact: item.impact, label: limitationLabel(item.code) })),
  ]);
  const freshestOutcome = sortedOutcomes[0]?.assessment.evaluatedAt;
  const learningAt = sources.learning?.evaluatedAt;
  const staleReasons: string[] = [];
  if (freshestOutcome && learningAt && freshestOutcome > learningAt) staleReasons.push("New Outcome assessments exist beyond the latest portfolio-learning evaluation.");
  if (sources.learning && sources.learning.portfolioVersion !== sources.portfolio.version) staleReasons.push("Portfolio context changed after the latest learning evaluation.");
  const freshness = Object.freeze({
    status: (sources.unavailableSections.includes("learnings") ? "unavailable" : staleReasons.length ? "stale" : "current") as "current" | "stale" | "unavailable",
    reasons: Object.freeze(staleReasons), ...(freshestOutcome ? { latestOutcomeEvaluation: freshestOutcome } : {}), ...(learningAt ? { latestLearningEvaluation: learningAt } : {}),
  });
  const changes = Object.freeze((sources.learning?.changes ?? []).filter((item) => item.direction !== "unchanged").slice(0, limits.changes).map((item, index) => Object.freeze({
    id: `${item.learningKey.scopeFingerprint}:${index}`, type: "portfolio-learning" as const,
    direction: changeDirection(item.direction), changeCode: item.direction, label: changeLabel(item.direction),
  })));
  const attention = Object.freeze(buildAttention(outcomeItems, recommendationItems, learningItems, freshness.status === "stale").slice(0, limits.attention).map((item, index) => Object.freeze({ ...item, rank: index + 1 })));
  const averageConfidence = average(sortedOutcomes.map(({ assessment }) => confidenceScore(assessment.confidence.assessment)));
  const strongest = learningItems.find((item) => item.maturity === "validated") ?? learningItems.find((item) => item.maturity === "supported") ?? null;
  const miss = learningItems.find((item) => item.type === "failure-pattern" || item.type === "assumption-bias" || item.priority === "critical") ?? null;
  const workspace: ContinuousImprovementWorkspace = Object.freeze({
    portfolio, observationWindow: query.observationWindow, evaluatedAt: learningAt ?? freshestOutcome ?? query.observationWindow.end,
    executiveSummary: Object.freeze({
      decisionOutcomeStatus: beneficialLabel(distribution), recommendationStatus: recommendationItems[0]?.effectiveness ?? "Unavailable",
      strongestLearning: strongest, largestRecurringMiss: miss, measurementReadiness, confidence: sources.learning ? confidenceScore(sources.learning.confidence) : averageConfidence,
    }),
    outcomes: Object.freeze({ completedCount: sortedOutcomes.length, measuringCount: sources.measuringOutcomeCount, plannedCount: sources.plannedOutcomeCount, recent: outcomeItems }),
    decisions: Object.freeze({ distribution, averageConfidence, observationWindow: query.observationWindow }),
    recommendations: Object.freeze({ items: recommendationItems }),
    learnings: Object.freeze({ items: learningItems, candidateCount: sources.learning?.candidates.length ?? 0, activeCount: sources.learning?.summary.activeLearningCount ?? 0 }),
    assumptionAccuracy: Object.freeze(learningItems.filter((item) => item.type === "assumption-bias").slice(0, 6)),
    executionPatterns: Object.freeze(learningItems.filter((item) => item.category === "execution").slice(0, 6)),
    measurementQuality: Object.freeze({ readiness: measurementReadiness, items: measurementItems.slice(0, 8) }),
    changes: Object.freeze({ comparable: Boolean(sources.learning && sources.learning.changes.length), items: changes }),
    attention: Object.freeze({ items: attention }),
    freshness,
    lineage: Object.freeze({
      decisionPolicyVersions: Object.freeze([...new Set(sortedOutcomes.map(({ assessment }) => assessment.policyVersion))].sort()),
      recommendationPolicyVersions: Object.freeze([...new Set(sources.recommendations.map((item) => item.policyVersion))].sort()),
      ...(sources.learning ? { learningPolicyVersion: sources.learning.policyVersion } : {}), portfolioVersion: sources.portfolio.version,
    }),
    capabilities: Object.freeze({
      viewOutcomes: sources.unavailableSections.includes("outcomes") ? "unavailable" : "available",
      viewDecisionAssessments: sources.unavailableSections.includes("decisions") ? "unavailable" : "available",
      viewRecommendationEffectiveness: sources.unavailableSections.includes("recommendations") ? "unavailable" : "available",
      viewPortfolioLearnings: sources.unavailableSections.includes("learnings") ? "unavailable" : "available",
      refreshLearning: "deferred", createOutcome: "deferred", recordMeasurement: "deferred", reviewLearning: "deferred", applyLearning: "unavailable", createAction: "unavailable",
    }), limitations,
  });
  if (sources.unavailableSections.length) return Object.freeze({ status: "degraded", workspace, unavailableSections: Object.freeze([...sources.unavailableSections]) });
  if (!sources.learning || (!sources.learning.learnings.length && sources.learning.candidates.length > 0)) return Object.freeze({ status: "insufficient-evidence", workspace, gaps: Object.freeze(["More diverse measured Outcomes are required to establish a supported portfolio learning."]) });
  return Object.freeze({ status: "ready", workspace });
}

function mapOutcome(source: LearningWorkspaceSources["outcomes"][number]): LearningWorkspaceOutcomeItem {
  const primary = source.assessment.objectives.find((item) => item.importance === "primary") ?? null;
  return Object.freeze({
    id: String(source.assessment.id), subject: source.subject, subjectType: source.subjectType, decision: source.decision,
    classification: source.assessment.classification,
    primaryObjective: primary ? Object.freeze({ id: String(primary.expectationId), name: primary.metric.name, importance: primary.importance, status: primary.status, actual: valueText(primary.actual), target: targetText(primary.target), confidence: confidenceScore(primary.confidence) }) : null,
    guardrails: Object.freeze({ preserved: source.assessment.guardrails.preserved, violated: source.assessment.guardrails.violated, unknown: source.assessment.guardrails.unknown }),
    unexpectedNegativeEffects: source.assessment.unexpectedEffects.filter((item) => item.disposition === "negative").length,
    attribution: source.assessment.attribution.status, evidence: source.assessment.evidence.sufficiency,
    confidence: confidenceScore(source.assessment.confidence.assessment), evaluatedAt: source.assessment.evaluatedAt,
  });
}
function mapRecommendation(item: LearningWorkspaceSources["recommendations"][number]): LearningWorkspaceRecommendationItem {
  return Object.freeze({
    id: String(item.id), recommendationType: String(item.recommendationType), effectiveness: item.overall.effectiveness, quality: item.overall.quality,
    sampleSize: item.overall.sample.outcomeCount, successRate: percentValue(item.overall.metrics.successRate), harmRate: percentValue(item.overall.metrics.harmRate),
    repeatability: item.repeatability.classification, confidence: confidenceScore(item.confidence.assessment),
    trend: item.trends.comparableAssessment ? item.trends.direction : null,
    applicability: Object.freeze(item.applicability.map(({ condition }) => `${condition.category}: ${condition.value}`).slice(0, 8)),
    learningReadiness: item.learningReadiness, severeHarm: item.harm.severeHarmObserved,
  });
}
function mapLearning(item: NonNullable<LearningWorkspaceSources["learning"]>["learnings"][number]): LearningWorkspaceLearningItem {
  return Object.freeze({
    id: String(item.id), statementCode: item.statementCode, statement: statementLabels[item.statementCode] ?? "A measured portfolio pattern is available for review.",
    category: item.category, type: item.type, maturity: item.maturity, status: item.status, priority: item.priority,
    materiality: item.materiality.classification, confidence: confidenceScore(item.confidence.assessment),
    supportingCount: item.evidence.totalSupporting, contradictingCount: item.evidence.totalContradicting,
    contradiction: item.contradictions.status, applicability: item.applicability.status,
    conditions: Object.freeze(item.applicability.supportedConditions.slice(0, 8).map((condition) => `${condition.dimension} ${condition.operator} ${Array.isArray(condition.value) ? condition.value.join(", ") : condition.value}`)),
    consistency: item.pattern.consistency.classification, freshness: item.freshness, scope: item.scope.level,
    typicalEffect: observedEffect(item.pattern.effect),
  });
}
function buildDistribution(values: readonly (typeof classifications)[number][]): LearningWorkspaceDistribution {
  const denominator = values.length;
  return Object.freeze(Object.fromEntries(classifications.map((classification) => {
    const count = values.filter((value) => value === classification).length;
    return [classification, Object.freeze({ count, percentage: denominator ? count / denominator * 100 : null })];
  })) as unknown as LearningWorkspaceDistribution);
}
function readiness(outcomes: LearningWorkspaceSources["outcomes"], measurement: readonly LearningWorkspaceLearningItem[], unavailable: readonly string[]): LearningWorkspaceMeasurementReadiness {
  if (unavailable.includes("measurement-quality")) return Object.freeze({ status: "unavailable" });
  const blocking = measurement.filter((item) => item.priority === "critical").map((item) => item.statement);
  if (blocking.length) return Object.freeze({ status: "weak", blockingLimitations: Object.freeze(blocking) });
  if (measurement.length) return Object.freeze({ status: "limited", primaryLimitations: Object.freeze(measurement.map((item) => item.statement)) });
  const inconclusive = outcomes.filter(({ assessment }) => assessment.classification === "inconclusive").length;
  return Object.freeze({ status: "strong", completedOutcomeCoverage: 100, inconclusiveRate: outcomes.length ? inconclusive / outcomes.length * 100 : 0 });
}
function buildAttention(outcomes: readonly LearningWorkspaceOutcomeItem[], recommendations: readonly LearningWorkspaceRecommendationItem[], learnings: readonly LearningWorkspaceLearningItem[], stale: boolean): LearningWorkspaceAttentionItem[] {
  const items: LearningWorkspaceAttentionItem[] = [];
  outcomes.filter((item) => item.classification === "harmful").forEach((item) => items.push({ rank: 0, type: "outcome", severity: "critical", sourceId: item.id, label: `Harmful Outcome: ${item.subject}` }));
  recommendations.filter((item) => item.severeHarm || item.effectiveness === "harmful" || item.trend === "declining").forEach((item) => items.push({ rank: 0, type: "recommendation", severity: item.severeHarm ? "critical" : "high", sourceId: item.id, label: `${item.recommendationType} requires review.` }));
  learnings.filter((item) => item.maturity === "contested" || item.priority === "critical").forEach((item) => items.push({ rank: 0, type: "learning", severity: item.priority === "critical" ? "critical" : "high", sourceId: item.id, label: item.statement }));
  if (stale) items.push({ rank: 0, type: "measurement", severity: "medium", sourceId: "freshness", label: "Learning Intelligence needs reevaluation." });
  return items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.sourceId.localeCompare(b.sourceId));
}
function unavailableLimitations(sections: readonly LearningWorkspaceSources["unavailableSections"][number][]): LearningWorkspaceLimitation[] {
  return sections.map((section) => Object.freeze({ code: `LEARNING_WORKSPACE_${section.toUpperCase().replace("-", "_")}_UNAVAILABLE`, section, impact: "material" as const, label: `${section.replace("-", " ")} data is currently unavailable.` }));
}
function valueText(value: OutcomeValue | null): string | null {
  if (!value) return null;
  if (value.kind === "money") return `${value.value.currency} ${value.value.amount}`;
  if (value.kind === "percentage") return `${percentValue(value.value) ?? value.value.value}%`;
  if (value.kind === "duration") return `${value.value} ${value.unit}`;
  if (value.kind === "boolean") return value.value ? "Yes" : "No";
  if (value.kind === "qualitative") return value.value;
  if (value.kind === "score") return String(value.value.value);
  return String(value.value);
}
function targetText(target: import("../../outcomes").OutcomeTarget): string {
  if (target.type === "completion") return "Complete";
  if (target.type === "state") return target.expectedState;
  if (target.type === "relative-change") return `${percentValue(target.value) ?? target.value.value}% change`;
  if (target.type === "range") return `${valueText(target.minimum)} – ${valueText(target.maximum)}`;
  return valueText(target.value) ?? "Unavailable";
}
function observedEffect(effect: import("../../portfolio-learning").PortfolioLearningObservedEffect): string | null {
  if (effect.kind === "quantitative") return effect.centralEstimate ? valueText(effect.centralEstimate) : null;
  if (effect.kind === "qualitative") return effect.effectCodes.join(", ") || null;
  return null;
}
function percentValue(value: { value: number } | null): number | null { return value ? value.value : null; }
function average(values: readonly number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function bounded(value: number | undefined, fallback: number, maximum: number): number { return Math.min(maximum, Math.max(1, Math.floor(value ?? fallback))); }
function beneficialLabel(distribution: LearningWorkspaceDistribution): string {
  const total = classifications.reduce((sum, key) => sum + distribution[key].count, 0);
  const beneficial = distribution.successful.count + distribution["partially-successful"].count;
  return total ? `${Math.round(beneficial / total * 100)}% beneficial` : "Unavailable";
}
function limitationLabel(code: string): string { return code.toLowerCase().replaceAll("_", " "); }
function priorityRank(value: string): number { return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as Record<string, number>)[value] ?? 5; }
function severityRank(value: string): number { return ({ critical: 0, high: 1, medium: 2, informational: 3 } as Record<string, number>)[value] ?? 4; }
function changeDirection(value: string): "positive" | "negative" | "neutral" { return ["strengthened", "broadened"].includes(value) ? "positive" : ["weakened", "contradicted", "invalidated", "narrowed"].includes(value) ? "negative" : "neutral"; }
function changeLabel(value: string): string { return `Portfolio learning ${value.replace("-", " ")}.`; }

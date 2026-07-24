import type { ContinuousImprovementWorkspace, ContinuousImprovementWorkspaceState, LearningWorkspaceLearningItem } from "../workspace";
import type { LearningDashboardAssumption, LearningDashboardMaturityDistribution, LearningHealth, LearningIntelligenceDashboard, LearningIntelligenceDashboardState } from "./learning-intelligence-dashboard";

const strongestLimit = 3;
const missesLimit = 3;
const emergingLimit = 4;
const assumptionLimit = 5;
const changeLimit = 5;
const attentionLimit = 5;

export function buildLearningIntelligenceDashboard(state: ContinuousImprovementWorkspaceState): LearningIntelligenceDashboardState {
  if (state.status === "no-outcomes" || state.status === "measurement-in-progress") return Object.freeze({
    status: state.status, portfolio: state.workspace.portfolio, plannedCount: state.workspace.plannedCount,
    measuringCount: state.workspace.measuringCount, workspaceDestination: workspacePath(state.workspace.portfolio.id),
    limitations: state.workspace.limitations,
  });
  const source = state.workspace;
  const learnings = source.learnings.items;
  const strongest = Object.freeze(learnings.filter((item) => item.maturity === "validated" || item.maturity === "supported").sort(learningOrder).slice(0, strongestLimit));
  const recurringMisses = Object.freeze(learnings.filter(isRecurringMiss).sort(learningOrder).slice(0, missesLimit));
  const emerging = Object.freeze(learnings.filter((item) => item.maturity === "candidate" || item.maturity === "emerging" || item.maturity === "contested").sort(learningOrder).slice(0, emergingLimit));
  const maturity = maturityDistribution(learnings);
  const recommendation = recommendationReliability(source);
  const dashboard: LearningIntelligenceDashboard = Object.freeze({
    portfolio: source.portfolio, observationWindow: source.observationWindow, evaluatedAt: source.evaluatedAt,
    executiveSummary: Object.freeze({
      learningHealth: learningHealth(source, maturity),
      decisionQuality: source.executiveSummary.decisionOutcomeStatus,
      recommendationReliability: recommendationLabel(recommendation),
      strongestLearning: strongest[0] ?? null, largestRecurringMiss: recurringMisses[0] ?? null,
      measurementReadiness: source.measurementQuality.readiness, confidence: source.executiveSummary.confidence,
    }),
    decisionQuality: Object.freeze({
      distribution: source.decisions.distribution,
      trend: decisionTrend(source),
      confidence: source.decisions.averageConfidence,
    }),
    recommendationReliability: recommendation,
    learningSummary: Object.freeze({ strongest, recurringMisses, emerging, maturity }),
    assumptions: Object.freeze(source.assumptionAccuracy.slice(0, assumptionLimit).map(mapAssumption)),
    measurement: Object.freeze({
      readiness: source.measurementQuality.readiness, completedOutcomes: source.outcomes.completedCount,
      incompleteOutcomes: source.outcomes.measuringCount + source.outcomes.plannedCount,
      inconclusiveOutcomes: source.decisions.distribution.inconclusive.count,
      missingBaselinePatterns: source.measurementQuality.items.filter((item) => item.statementCode === "MISSING_BASELINES_LIMIT_LEARNING").length,
    }),
    changes: Object.freeze(source.changes.items.slice(0, changeLimit)),
    attention: Object.freeze(source.attention.items.slice(0, attentionLimit)),
    freshness: Object.freeze({ status: source.freshness.status, reasons: source.freshness.reasons }),
    lineage: source.lineage,
    capabilities: Object.freeze({ viewWorkspace: "available", refreshLearning: source.capabilities.refreshLearning }),
    limitations: source.limitations,
    workspaceDestination: workspacePath(source.portfolio.id),
  });
  if (state.status === "degraded") return Object.freeze({ status: "degraded", dashboard, unavailableSections: state.unavailableSections });
  if (state.status === "insufficient-evidence") return Object.freeze({ status: "insufficient-evidence", dashboard });
  return Object.freeze({ status: "ready", dashboard });
}

function learningHealth(source: ContinuousImprovementWorkspace, maturity: LearningDashboardMaturityDistribution): LearningHealth {
  if (!source.outcomes.completedCount || !source.learnings.items.length) return "insufficient-evidence";
  if (source.measurementQuality.readiness.status === "weak" || source.freshness.status === "incompatible") return "limited";
  if (maturity.validated >= 2 && source.executiveSummary.confidence !== null && source.executiveSummary.confidence >= 0.8 && source.measurementQuality.readiness.status === "strong") return "strong";
  if (maturity.validated + maturity.supported >= 2 && source.executiveSummary.confidence !== null && source.executiveSummary.confidence >= 0.6) return "healthy";
  if (maturity.candidate + maturity.emerging > 0) return "developing";
  return "limited";
}
function recommendationReliability(source: ContinuousImprovementWorkspace) {
  const items = source.recommendations.items;
  const comparable = items.filter((item) => item.trend !== null);
  const declining = comparable.filter((item) => item.trend === "declining").length;
  const improving = comparable.filter((item) => item.trend === "improving").length;
  return Object.freeze({
    validated: items.filter((item) => item.quality === "validated").length,
    conditional: items.filter((item) => item.quality === "conditional").length,
    experimental: items.filter((item) => item.quality === "experimental" || item.quality === "promising").length,
    deprecated: items.filter((item) => item.quality === "deprecated").length,
    insufficientEvidence: items.filter((item) => item.quality === "insufficient-evidence").length,
    trend: (!comparable.length ? "not-comparable" : declining > improving ? "declining" : improving > declining ? "improving" : "stable") as "improving" | "stable" | "declining" | "not-comparable",
    confidence: average(items.map((item) => item.confidence)),
  });
}
function recommendationLabel(value: ReturnType<typeof recommendationReliability>): string {
  if (!value.validated && !value.conditional && !value.experimental && !value.deprecated) return "Insufficient evidence";
  if (value.deprecated > value.validated + value.conditional) return "Needs review";
  if (value.validated) return "Reliable";
  if (value.conditional) return "Conditional";
  return "Developing";
}
function decisionTrend(source: ContinuousImprovementWorkspace): "improving" | "stable" | "declining" | "not-comparable" {
  const changes = source.changes.items.filter((item) => item.type === "outcome");
  if (!source.changes.comparable || !changes.length) return "not-comparable";
  const score = changes.reduce((sum, item) => sum + (item.direction === "positive" ? 1 : item.direction === "negative" ? -1 : 0), 0);
  return score > 0 ? "improving" : score < 0 ? "declining" : "stable";
}
function maturityDistribution(items: readonly LearningWorkspaceLearningItem[]): LearningDashboardMaturityDistribution {
  return Object.freeze({
    candidate: count(items, "candidate"), emerging: count(items, "emerging"), supported: count(items, "supported"),
    validated: count(items, "validated"), contested: count(items, "contested"), invalidated: count(items, "invalidated"),
  });
}
function mapAssumption(item: LearningWorkspaceLearningItem): LearningDashboardAssumption {
  const bias = item.statementCode === "ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC" ? "optimistic" : item.statementCode === "ASSUMPTIONS_SYSTEMATICALLY_CONSERVATIVE" ? "conservative" : "unknown";
  return Object.freeze({ id: item.id, label: item.statement, bias, effect: item.typicalEffect, confidence: item.confidence, materiality: item.materiality, trend: "not-comparable", destination: "#assumptions" });
}
function isRecurringMiss(item: LearningWorkspaceLearningItem): boolean {
  return item.type === "failure-pattern" || item.type === "assumption-bias" || item.type === "measurement-pattern" || item.statementCode.includes("HARMFUL") || item.statementCode.includes("VIOLATION");
}
function learningOrder(a: LearningWorkspaceLearningItem, b: LearningWorkspaceLearningItem): number {
  return priority(a.priority) - priority(b.priority) || b.confidence - a.confidence || a.id.localeCompare(b.id);
}
function count(items: readonly LearningWorkspaceLearningItem[], maturity: string): number { return items.filter((item) => item.maturity === maturity).length; }
function priority(value: string): number { return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as Record<string, number>)[value] ?? 5; }
function average(values: readonly number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function workspacePath(portfolioId: string): string { return `/dashboard/learning/workspace?portfolio=${encodeURIComponent(portfolioId)}`; }

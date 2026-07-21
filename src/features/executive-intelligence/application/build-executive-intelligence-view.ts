import { ACTION_PRIORITY_RANK } from "@/platform/actions";
import { RECOMMENDATION_PRIORITY_RANK } from "@/platform/recommendations";
import { HPM_PILLARS, type HpmLifecycleProjection } from "@/features/hpm";

import type {
  ExecutiveActionItem,
  ExecutiveDataGap,
  ExecutiveDecisionItem,
  ExecutiveIntelligenceView,
  ExecutiveOutcomeItem,
  ExecutivePerformanceSummary,
  ExecutiveScopeSummary,
} from "../domain";
import { buildExecutiveAttentionItems } from "./build-executive-attention-items";

/** Pure presentation projection over the single canonical HPM lifecycle. */
export function buildExecutiveIntelligenceView(
  lifecycle: HpmLifecycleProjection,
  options: Readonly<{
    now?: Date;
    scope?: ExecutiveScopeSummary;
    performance?: ExecutivePerformanceSummary;
  }> = {},
): ExecutiveIntelligenceView {
  const now = options.now ?? lifecycle.generatedAt;
  const priorities = buildExecutiveAttentionItems(lifecycle, { now });
  const availablePillars = lifecycle.health.breakdown?.components.map((value) => value.key) ?? [];
  const unavailablePillars = HPM_PILLARS.filter((pillar) => !availablePillars.includes(pillar));
  const score = lifecycle.health.score?.value ?? null;
  const healthSummary = score === null
    ? "Business health is unavailable because no canonical pillar scores are currently provided."
    : `${availablePillars.length} of ${HPM_PILLARS.length} HPM pillars currently support a business health score of ${score}.`;

  const recommendations = lifecycle.decide.recommendations.toArray();
  const riskRecommendationIds = new Set(recommendations
    .filter((value) => value.metadata.impactType === "revenue-at-risk" || value.metadata.impactType === "operational-risk")
    .map((value) => value.id.value));
  const risks = priorities.filter((value) =>
    value.source === "outcome" || value.source === "intelligence" && value.urgency === "high" ||
    value.source === "recommendation" && riskRecommendationIds.has(value.sourceId));
  const opportunities = priorities.filter((value) =>
    value.source === "recommendation" && !riskRecommendationIds.has(value.sourceId) ||
    value.source === "intelligence" && value.urgency !== "high");

  const actions = lifecycle.execute.actions.toArray();
  const actionDecisionIds = new Set(actions.flatMap((value) => value.decisionIds.map((id) => id.value)));
  const activeActionDecisionIds = new Set(actions
    .filter((value) => ["accepted", "scheduled", "in-progress", "blocked"].includes(value.status))
    .flatMap((value) => value.decisionIds.map((id) => id.value)));
  const completedActionDecisionIds = new Set(actions
    .filter((value) => ["completed", "measured", "archived"].includes(value.status))
    .flatMap((value) => value.decisionIds.map((id) => id.value)));
  const decisions = lifecycle.decide.decisions.toArray();
  const decisionItems = decisions.map((value): ExecutiveDecisionItem => Object.freeze({
    id: value.id.value, title: value.title, summary: value.summary, priority: value.priority,
    confidence: value.confidence.score.value, decidedAt: value.decidedAt,
  })).sort((left, right) => RECOMMENDATION_PRIORITY_RANK[right.priority] - RECOMMENDATION_PRIORITY_RANK[left.priority] || right.decidedAt.getTime() - left.decidedAt.getTime());

  const actionItems = actions.map((value): ExecutiveActionItem => Object.freeze({
    id: value.id.value, title: value.title, summary: value.summary, priority: value.priority,
    status: value.status, owner: value.owner.displayName, decisionIds: Object.freeze(value.decisionIds.map((id) => id.value)),
  })).sort((left, right) => ACTION_PRIORITY_RANK[right.priority] - ACTION_PRIORITY_RANK[left.priority] || left.id.localeCompare(right.id));
  const openStatuses = new Set(["proposed", "accepted", "scheduled", "in-progress", "blocked"]);
  const overdue = actions.filter((value) => value.scheduledFor && value.scheduledFor < now && openStatuses.has(value.status)).length;

  const measured = lifecycle.learn.measuredOutcomes.toArray()
    .filter((value) => value.completedAt !== undefined)
    .sort((left, right) => (right.completedAt?.getTime() ?? 0) - (left.completedAt?.getTime() ?? 0));
  const outcomeItems = measured.map((value): ExecutiveOutcomeItem => Object.freeze({
    id: value.id.value, title: value.title, summary: value.summary, successful: value.successful,
    completedAt: value.completedAt!, metrics: value.metrics,
    actionIds: Object.freeze(value.lineage.actionIds.map((id) => id.value)),
    decisionIds: Object.freeze(value.lineage.decisionIds.map((id) => id.value)),
  }));
  const learningCount = lifecycle.learn.learning.toArray().reduce((sum, value) => sum + value.artifacts.length, 0);

  const gaps: ExecutiveDataGap[] = lifecycle.dataGaps.map((message) => ({ type: "unavailable-data", message }));
  if (lifecycle.decide.decisions.isEmpty) gaps.push({ type: "absent-provider", message: "No production Platform Decision provider is configured for this query." });
  if (lifecycle.execute.actions.isEmpty) gaps.push({ type: "absent-provider", message: "No production Platform Action provider is configured for this query." });
  if (lifecycle.see.outcomes.isEmpty) gaps.push({ type: "absent-provider", message: "No production Platform Outcome provider is configured for this query." });
  gaps.push({ type: "incomplete-scope", message: "Canonical property and portfolio scope metadata is not yet attached to the lifecycle projection." });

  return Object.freeze({
    generatedAt: new Date(lifecycle.generatedAt),
    scope: options.scope ?? Object.freeze({ properties: Object.freeze([]), selectedProperty: null, propertyCount: null,
      startDate: "", endDate: "", scopeKnown: false }),
    performance: options.performance ?? unavailablePerformance(),
    health: Object.freeze({ score, confidence: null, status: lifecycle.health.status, summary: healthSummary,
      availablePillars: availablePillars.length, totalPillars: HPM_PILLARS.length, supportingScoreKeys: Object.freeze([...availablePillars]) }),
    attention: Object.freeze({ risks: Object.freeze(risks), opportunities: Object.freeze(opportunities), priorities }),
    decisions: Object.freeze({
      active: decisions.filter((value) => activeActionDecisionIds.has(value.id.value)).length,
      awaitingEvidence: decisions.filter((value) => value.metadata.awaitingEvidence === true).length,
      readyForReview: decisions.filter((value) => !actionDecisionIds.has(value.id.value)).length,
      recentlyCompleted: decisions.filter((value) => completedActionDecisionIds.has(value.id.value)).length,
      highestPriorityDecision: decisionItems[0] ?? null,
    }),
    execution: Object.freeze({
      openActions: actions.filter((value) => openStatuses.has(value.status)).length,
      inProgressActions: actions.filter((value) => value.status === "in-progress").length,
      overdueActions: overdue,
      completedActions: actions.filter((value) => ["completed", "measured", "archived"].includes(value.status)).length,
      blockedActions: actions.filter((value) => value.status === "blocked").length,
      highestPriorityAction: actionItems[0] ?? null,
    }),
    outcomes: Object.freeze({
      measuredOutcomes: outcomeItems.length,
      positiveOutcomes: outcomeItems.filter((value) => value.successful).length,
      neutralOutcomes: 0,
      negativeOutcomes: outcomeItems.filter((value) => !value.successful).length,
      latestOutcome: outcomeItems[0] ?? null,
      learningSummary: learningCount === 0 ? null : `${learningCount} validated learning artifact${learningCount === 1 ? "" : "s"} available.`,
    }),
    dataQuality: Object.freeze({
      availablePillars: Object.freeze([...availablePillars]), unavailablePillars: Object.freeze(unavailablePillars), confidence: null,
      gaps: Object.freeze(gaps), summary: gaps.length === 0 ? "Canonical lifecycle data is available for all configured providers." : `${gaps.length} data quality gap${gaps.length === 1 ? "" : "s"} limit this Executive view.`,
    }),
    briefing: Object.freeze({
      headline: priorities[0] ? `${priorities[0].title} is the leading priority` : "No immediate priorities require attention",
      summary: `${priorities.length} item${priorities.length === 1 ? "" : "s"} prioritized from canonical Platform records.`,
      recommendedFocus: priorities[0]?.summary ?? "Continue monitoring Platform Outcomes and Intelligence.",
      highlights: Object.freeze(lifecycle.see.outcomes.toArray().filter((value) => value.successful).slice(0, 3).map((value) => value.summary)),
      concerns: Object.freeze(lifecycle.see.outcomes.toArray().filter((value) => !value.successful).slice(0, 3).map((value) => value.summary)),
    }),
  });
}

function unavailablePerformance(): ExecutivePerformanceSummary {
  const metric = Object.freeze({ value: null, trend: null });
  return Object.freeze({ available: false, grossRevenue: metric, occupancyRate: metric, averageDailyRate: metric,
    revPar: metric, totalBookings: null, upcomingBookings: null });
}

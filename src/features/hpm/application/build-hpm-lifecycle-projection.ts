import { OutcomeCollection } from "@/platform/outcomes";

import type { HpmCanonicalInputs, HpmHealthStatus, HpmImprovementCycle, HpmLifecycleProjection } from "../domain";
import { HpmScorePolicy } from "./hpm-score-policy";

export type BuildHpmLifecycleProjectionOptions = Readonly<{ now?: Date; scorePolicy?: HpmScorePolicy }>;

/** Primary HPM read boundary. It organizes canonical artifacts and never transitions them. */
export function buildHpmLifecycleProjection(
  input: HpmCanonicalInputs,
  options: BuildHpmLifecycleProjectionOptions = {},
): HpmLifecycleProjection {
  const generatedAt = copyDate(options.now ?? new Date());
  const scoreResult = (options.scorePolicy ?? new HpmScorePolicy()).calculate(input.pillarScores ?? new Map());
  const actions = input.actions.toArray();
  const outcomes = input.outcomes.toArray();
  const activeActions = actions.filter((value) => value.status === "accepted" || value.status === "scheduled" || value.status === "in-progress" || value.status === "blocked").length;
  const completedActions = actions.filter((value) => value.status === "completed" || value.status === "measured" || value.status === "archived").length;
  const terminalActions = activeActions + completedActions;
  const successfulOutcomes = outcomes.filter((value) => value.successful).length;
  const failedOutcomes = outcomes.length - successfulOutcomes;
  const cycles = buildCycles(input);
  const measuredCycles = cycles.filter((value) => value.status === "measured" || value.status === "learned").length;
  const successfulCycles = cycles.filter((value) => value.outcome.successful).length;
  const realizedImpact = Object.freeze(outcomes.reduce<Record<string, number>>((totals, outcome) => {
    for (const [metric, value] of Object.entries(outcome.metrics)) totals[metric] = (totals[metric] ?? 0) + value;
    return totals;
  }, {}));
  const dataGaps = [
    ...(input.observations.isEmpty ? ["No current Observations are available."] : []),
    ...(input.outcomes.isEmpty ? ["No measured Outcomes are available."] : []),
    ...(input.learning.isEmpty ? ["No validated Learning artifacts are available; measured Outcomes are not labeled as Learning."] : []),
    ...(!input.pillarScores?.size ? ["No canonical capability Scores are available for HPM aggregation."] : []),
  ];
  return Object.freeze({
    generatedAt,
    see: Object.freeze({ observations: input.observations, outcomes: input.outcomes }),
    understand: Object.freeze({ evidence: input.evidence, claims: input.claims, evaluations: input.evaluations, intelligence: input.intelligence }),
    decide: Object.freeze({ recommendations: input.recommendations, decisions: input.decisions }),
    execute: Object.freeze({ actions: input.actions }),
    learn: Object.freeze({ measuredOutcomes: OutcomeCollection.create(outcomes.filter((value) => value.completedAt !== undefined)), intelligence: input.intelligence, learning: input.learning }),
    health: Object.freeze({
      score: scoreResult.score,
      breakdown: scoreResult.breakdown,
      status: healthStatus(scoreResult.score?.value ?? null),
      dataCoverage: scoreResult.dataCoverage,
      unresolvedDecisions: Math.max(0, input.decisions.size - new Set(actions.flatMap((value) => value.decisionIds.map((id) => id.value))).size),
      activeActions,
      executionCompletion: terminalActions === 0 ? null : Math.round(completedActions / terminalActions * 100),
      successfulOutcomes,
      failedOutcomes,
      realizedImpact,
      improvementMomentum: measuredCycles === 0 ? null : Math.round(successfulCycles / measuredCycles * 100),
      learningVelocity: input.learning.toArray().reduce((total, report) => total + report.artifacts.length, 0),
    }),
    cycles,
    ...(input.executive?.leadingPriorityId ? { currentPriorityId: input.executive.leadingPriorityId } : {}),
    dataGaps: Object.freeze(dataGaps),
  });
}

function buildCycles(input: HpmCanonicalInputs): readonly HpmImprovementCycle[] {
  const actions = input.actions.toArray();
  return Object.freeze(input.outcomes.toArray().map((outcome) => {
    const cycleActions = actions.filter((action) => outcome.lineage.actionIds.some((id) => id.equals(action.id)));
    const learning = input.learning.tracing(outcome.id).toArray();
    const status = learning.length > 0 ? "learned" : outcome.completedAt ? "measured" : cycleActions.some((action) => action.status === "in-progress") ? "executing" : "decided";
    return Object.freeze({
      outcome,
      actions: Object.freeze(cycleActions),
      learning: Object.freeze(learning),
      recommendationIds: Object.freeze(outcome.lineage.recommendationIds.map((value) => value.value)),
      decisionIds: Object.freeze(outcome.lineage.decisionIds.map((value) => value.value)),
      status,
      hasCompleteExecutionLineage: outcome.lineage.recommendationIds.length > 0 && outcome.lineage.decisionIds.length > 0 && outcome.lineage.actionIds.length > 0,
    });
  }));
}

function healthStatus(score: number | null): HpmHealthStatus { if (score === null) return "unavailable"; if (score >= 90) return "excellent"; if (score >= 75) return "healthy"; if (score >= 60) return "watch"; if (score >= 40) return "needs-attention"; return "critical"; }
function copyDate(value: Date): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError("HPM projection date must be valid."); return result; }

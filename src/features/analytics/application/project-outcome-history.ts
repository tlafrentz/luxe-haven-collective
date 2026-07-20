import type { OutcomeCollection } from "@/platform/outcomes";

import type { AnalyticsOutcomeProjection } from "../types";

/** Read-only historical projection. Analytics never transitions or creates Outcomes. */
export function projectOutcomeHistory(outcomes: OutcomeCollection): readonly AnalyticsOutcomeProjection[] {
  return Object.freeze(outcomes.toArray().map((outcome) => Object.freeze({
    outcomeId: outcome.id.value,
    title: outcome.title,
    type: outcome.type,
    status: outcome.status,
    successful: outcome.successful,
    startedAt: outcome.startedAt.toISOString(),
    ...(outcome.completedAt ? { completedAt: outcome.completedAt.toISOString() } : {}),
    ...(outcome.durationMs === undefined ? {} : { durationMs: outcome.durationMs }),
    metrics: outcome.metrics,
    actionIds: Object.freeze(outcome.lineage.actionIds.map((value) => value.value)),
    decisionIds: Object.freeze(outcome.lineage.decisionIds.map((value) => value.value)),
  })));
}

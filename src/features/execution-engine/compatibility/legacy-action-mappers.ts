import { Action, createActionId } from "@/platform/actions";
import type { ExecutiveAction, ExecutiveActionSource } from "./executive-action";

/** @deprecated Boundary mapper for the ExecutiveAction compatibility DTO. */
export function toPlatformAction(value: ExecutiveAction): Action {
  return Action.create({
    id: createActionId(value.id), title: value.title, summary: value.summary, type: value.type,
    priority: value.priority, status: value.status, owner: value.owner, decisionIds: [],
    createdAt: new Date(value.createdAt),
    ...(value.acceptedAt ? { acceptedAt: new Date(value.acceptedAt) } : {}),
    ...(value.startedAt ? { startedAt: new Date(value.startedAt) } : {}),
    ...(value.completedAt ? { completedAt: new Date(value.completedAt) } : {}),
    ...(value.measuredAt ? { measuredAt: new Date(value.measuredAt) } : {}),
    ...(value.archivedAt ? { archivedAt: new Date(value.archivedAt) } : {}),
    ...(value.outcome ? { outcome: value.outcome } : {}),
    metadata: {
      legacySource: value.source, legacyPropertyId: value.propertyId, legacyCreatedAt: value.createdAt,
      ...(value.recommendationId ? { legacyRecommendationId: value.recommendationId } : {}),
      ...(value.priorityId ? { legacyPriorityId: value.priorityId } : {}),
      ...(value.acceptedAt ? { legacyAcceptedAt: value.acceptedAt } : {}),
      ...(value.startedAt ? { legacyStartedAt: value.startedAt } : {}),
      ...(value.completedAt ? { legacyCompletedAt: value.completedAt } : {}),
      ...(value.measuredAt ? { legacyMeasuredAt: value.measuredAt } : {}),
      ...(value.archivedAt ? { legacyArchivedAt: value.archivedAt } : {}),
    },
  });
}

/** @deprecated Boundary mapper for existing consumers only. */
export function toExecutiveAction(value: Action): ExecutiveAction {
  const legacy = value.metadata;
  const source = legacy.legacySource as ExecutiveActionSource | undefined;
  const createdAt = stringValue(legacy.legacyCreatedAt);
  if (!source || !createdAt) throw new TypeError("Platform Action is missing execution-engine compatibility metadata.");
  return {
    id: value.id.value,
    ...(stringValue(legacy.legacyRecommendationId) ? { recommendationId: String(legacy.legacyRecommendationId) } : {}),
    ...(stringValue(legacy.legacyPriorityId) ? { priorityId: String(legacy.legacyPriorityId) } : {}),
    propertyId: stringValue(legacy.legacyPropertyId) ?? null, source, type: value.type, title: value.title,
    summary: value.summary, priority: value.priority, status: value.status, owner: value.owner, createdAt,
    ...(value.acceptedAt ? { acceptedAt: stringValue(legacy.legacyAcceptedAt) ?? value.acceptedAt.toISOString() } : {}),
    ...(value.startedAt ? { startedAt: stringValue(legacy.legacyStartedAt) ?? value.startedAt.toISOString() } : {}),
    ...(value.completedAt ? { completedAt: stringValue(legacy.legacyCompletedAt) ?? value.completedAt.toISOString() } : {}),
    ...(value.measuredAt ? { measuredAt: stringValue(legacy.legacyMeasuredAt) ?? value.measuredAt.toISOString() } : {}),
    ...(value.archivedAt ? { archivedAt: stringValue(legacy.legacyArchivedAt) ?? value.archivedAt.toISOString() } : {}),
    ...(value.outcome ? { outcome: value.outcome } : {}),
  };
}

function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }

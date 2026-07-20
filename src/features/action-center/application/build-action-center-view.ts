import { Action } from "@/platform/actions";
import type { Outcome } from "@/platform/outcomes";
import type { ActionCenterItem, ActionCenterRecord, ActionCenterStatus, ActionCenterView, ActionDecisionContext, PlatformActionCenterRecord } from "../domain";

type NormalizedRecord = Readonly<{ item: ActionCenterItem; canonicalOutcome?: Outcome }>;

/** The single canonical Platform-to-Action-Center read-model adapter. */
export function buildActionCenterView(records: readonly (PlatformActionCenterRecord | ActionCenterRecord)[]): ActionCenterView {
  const normalized = records.map(normalize).filter(({ item }) => item.status !== "archived");
  const activeActions = normalized.filter(({ item }) => ["accepted", "scheduled", "in-progress", "blocked"].includes(item.status))
    .sort((left, right) => activeTimestamp(right.item) - activeTimestamp(left.item)).map(({ item }) => item);
  const recentlyMeasured = normalized.filter(({ item, canonicalOutcome }) => Boolean(canonicalOutcome) || item.status === "measured")
    .sort((left, right) => measuredTimestamp(right) - measuredTimestamp(left)).slice(0, 5).map(({ item }) => item);
  const recentlyCompleted = normalized.filter(({ item, canonicalOutcome }) => item.status === "completed" && !canonicalOutcome)
    .sort((left, right) => date(right.item.completedAt ?? right.item.createdAt) - date(left.item.completedAt ?? left.item.createdAt))
    .slice(0, 5).map(({ item }) => item);
  const items = normalized.map(({ item }) => item);
  return {
    summary: {
      total: items.length,
      accepted: count(items, "accepted"), inProgress: count(items, "in-progress"), blocked: count(items, "blocked"),
      completed: count(items, "completed"), measured: normalized.filter(({ item, canonicalOutcome }) => Boolean(canonicalOutcome) || item.status === "measured").length,
    },
    activeActions, recentlyCompleted, recentlyMeasured,
  };
}

function normalize(record: PlatformActionCenterRecord | ActionCenterRecord): NormalizedRecord {
  if (!isPlatformRecord(record)) return { item: legacyItem(record), canonicalOutcome: undefined };
  const action = record.action;
  const context = copyContext(record.decisionContext);
  return {
    item: {
      id: action.id.value, title: action.title, summary: action.summary,
      propertyId: typeof action.metadata.legacyPropertyId === "string" ? action.metadata.legacyPropertyId : null,
      type: action.type, priority: action.priority, status: action.status, ownerName: action.owner.displayName,
      createdAt: action.createdAt.toISOString(),
      ...(action.acceptedAt ? { acceptedAt: action.acceptedAt.toISOString() } : {}),
      ...(action.startedAt ? { startedAt: action.startedAt.toISOString() } : {}),
      ...(action.completedAt ? { completedAt: action.completedAt.toISOString() } : {}),
      ...(record.outcome ? { measuredAt: record.outcome.completedAt?.toISOString() } : action.measuredAt ? { measuredAt: action.measuredAt.toISOString() } : {}),
      ...(context ? { decisionContext: context } : {}),
    },
    ...(record.outcome ? { canonicalOutcome: record.outcome } : {}),
  };
}

function isPlatformRecord(record: PlatformActionCenterRecord | ActionCenterRecord): record is PlatformActionCenterRecord {
  return record.action instanceof Action;
}

function legacyItem(record: ActionCenterRecord): ActionCenterItem {
  const action = record.action, context = copyContext(record.decisionContext);
  return { id: action.id, title: action.title, summary: action.summary, propertyId: action.propertyId, type: action.type,
    priority: action.priority, status: action.status, ownerName: action.owner.displayName, createdAt: action.createdAt,
    ...(action.acceptedAt ? { acceptedAt: action.acceptedAt } : {}), ...(action.startedAt ? { startedAt: action.startedAt } : {}),
    ...(action.completedAt ? { completedAt: action.completedAt } : {}), ...(action.measuredAt ? { measuredAt: action.measuredAt } : {}),
    ...(context ? { decisionContext: context } : {}) };
}
function copyContext(value?: ActionDecisionContext): ActionDecisionContext | undefined { return value ? { ...value, evidence: value.evidence.map((item) => ({ ...item })) } : undefined; }
function count(items: readonly ActionCenterItem[], status: ActionCenterStatus): number { return items.filter((item) => item.status === status).length; }
function date(value: string): number { return new Date(value).getTime(); }
function activeTimestamp(item: ActionCenterItem): number { return date(item.startedAt ?? item.acceptedAt ?? item.createdAt); }
function measuredTimestamp(record: NormalizedRecord): number { return record.canonicalOutcome?.completedAt?.getTime() ?? date(record.item.measuredAt ?? record.item.createdAt); }

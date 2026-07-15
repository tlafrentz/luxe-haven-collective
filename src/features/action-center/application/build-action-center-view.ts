import type {
  ExecutiveAction,
} from "@/features/execution-engine";

import type {
  ActionCenterItem,
  ActionCenterRecord,
  ActionCenterView,
  ActionDecisionContext,
} from "../domain";

function copyDecisionContext(
  context?: ActionDecisionContext,
): ActionDecisionContext | undefined {
  if (!context) {
    return undefined;
  }

  return {
    ...context,
    evidence: context.evidence.map(
      (item) => ({
        ...item,
      }),
    ),
  };
}

function toActionCenterItem({
  action,
  decisionContext,
}: ActionCenterRecord): ActionCenterItem {
  return {
    id: action.id,
    title: action.title,
    summary: action.summary,
    propertyId: action.propertyId,
    type: action.type,
    priority: action.priority,
    status: action.status,
    ownerName: action.owner.displayName,
    createdAt: action.createdAt,
    acceptedAt: action.acceptedAt,
    startedAt: action.startedAt,
    completedAt: action.completedAt,
    measuredAt: action.measuredAt,
    decisionContext:
      copyDecisionContext(decisionContext),
  };
}

function getActionTimestamp(
  action: ExecutiveAction,
): number {
  const timestamp =
    action.startedAt ??
    action.acceptedAt ??
    action.createdAt;

  return new Date(timestamp).getTime();
}

export function buildActionCenterView(
  records: ActionCenterRecord[],
): ActionCenterView {
  const visibleRecords = records.filter(
    ({ action }) =>
      action.status !== "archived",
  );

  const activeActions = visibleRecords
    .filter(({ action }) =>
      [
        "accepted",
        "scheduled",
        "in-progress",
        "blocked",
      ].includes(action.status),
    )
    .sort(
      (left, right) =>
        getActionTimestamp(right.action) -
        getActionTimestamp(left.action),
    )
    .map(toActionCenterItem);

  const recentlyCompleted =
    visibleRecords
      .filter(
        ({ action }) =>
          action.status === "completed",
      )
      .sort(
        (left, right) =>
          new Date(
            right.action.completedAt ??
              right.action.createdAt,
          ).getTime() -
          new Date(
            left.action.completedAt ??
              left.action.createdAt,
          ).getTime(),
      )
      .slice(0, 5)
      .map(toActionCenterItem);

  const recentlyLearned =
    visibleRecords
      .filter(
        ({ action }) =>
          action.status === "measured",
      )
      .sort(
        (left, right) =>
          new Date(
            right.action.measuredAt ??
              right.action.createdAt,
          ).getTime() -
          new Date(
            left.action.measuredAt ??
              left.action.createdAt,
          ).getTime(),
      )
      .slice(0, 5)
      .map(toActionCenterItem);

  const visibleActions = visibleRecords.map(
    ({ action }) => action,
  );

  return {
    summary: {
      total: visibleActions.length,
      accepted: visibleActions.filter(
        (action) =>
          action.status === "accepted",
      ).length,
      inProgress: visibleActions.filter(
        (action) =>
          action.status === "in-progress",
      ).length,
      blocked: visibleActions.filter(
        (action) =>
          action.status === "blocked",
      ).length,
      completed: visibleActions.filter(
        (action) =>
          action.status === "completed",
      ).length,
      measured: visibleActions.filter(
        (action) =>
          action.status === "measured",
      ).length,
    },
    activeActions,
    recentlyCompleted,
    recentlyLearned,
  };
}

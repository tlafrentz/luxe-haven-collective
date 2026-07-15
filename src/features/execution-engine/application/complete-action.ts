import type {
  ActionOutcome,
  ActionStatus,
  ExecutiveAction,
} from "../domain";

export const COMPLETABLE_ACTION_STATUSES = [
  "accepted",
  "scheduled",
  "in-progress",
  "blocked",
] as const satisfies readonly ActionStatus[];

export type CompletableActionStatus =
  (typeof COMPLETABLE_ACTION_STATUSES)[number];

export type CompleteActionInput = {
  action: ExecutiveAction;
  completedAt: string;
  outcome: ActionOutcome;
};

function isCompletableActionStatus(
  status: ActionStatus,
): status is CompletableActionStatus {
  return COMPLETABLE_ACTION_STATUSES.some(
    (completableStatus) =>
      completableStatus === status,
  );
}

export function completeAction({
  action,
  completedAt,
  outcome,
}: CompleteActionInput): ExecutiveAction {
  if (!isCompletableActionStatus(action.status)) {
    throw new Error(
      `Cannot complete action with status "${action.status}".`,
    );
  }

  return {
    ...action,
    status: "completed",
    completedAt,
    outcome: {
      ...outcome,
      measuredImpact: outcome.measuredImpact
        ? {
            ...outcome.measuredImpact,
          }
        : undefined,
      lessonsLearned: outcome.lessonsLearned
        ? [...outcome.lessonsLearned]
        : undefined,
    },
  };
}

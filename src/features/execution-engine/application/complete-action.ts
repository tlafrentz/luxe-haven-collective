import type { ActionOutcome, ExecutiveAction } from "../domain";
import { toExecutiveAction, toPlatformAction } from "./action-adapter";

export type CompleteActionInput = {
  action: ExecutiveAction;
  completedAt: string;
  outcome: ActionOutcome;
};

export function completeAction({
  action,
  completedAt,
  outcome,
}: CompleteActionInput): ExecutiveAction {
  let completed: ExecutiveAction;
  try {
    completed = toExecutiveAction(toPlatformAction(action).complete(new Date(completedAt), outcome));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Cannot transition action")) {
      throw new Error(`Cannot complete action with status "${action.status}".`);
    }
    throw error;
  }
  // Preserve the legacy DTO's explicit optional keys during migration.
  return {
    ...completed,
    completedAt,
    outcome: {
      ...completed.outcome!,
      measuredImpact: completed.outcome?.measuredImpact,
      lessonsLearned: completed.outcome?.lessonsLearned,
    },
  };
}

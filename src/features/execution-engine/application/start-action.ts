import type {
  ExecutiveAction,
} from "../domain";
import { toExecutiveAction, toPlatformAction } from "./action-adapter";

export type StartActionInput = {
  action: ExecutiveAction;
  startedAt: string;
};

export function startAction({
  action,
  startedAt,
}: StartActionInput): ExecutiveAction {
  try {
    return { ...toExecutiveAction(toPlatformAction(action).start(new Date(startedAt))), owner: action.owner, startedAt };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Cannot transition action")) {
      throw new Error(`Cannot start action with status "${action.status}".`);
    }
    throw error;
  }
}

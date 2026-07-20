import type { ExecutiveAction } from "../domain";
import { toExecutiveAction, toPlatformAction } from "./action-adapter";

export type ArchiveActionInput = {
  action: ExecutiveAction;
  archivedAt: string;
};

export function archiveAction({
  action,
  archivedAt,
}: ArchiveActionInput): ExecutiveAction {
  try {
    return { ...toExecutiveAction(toPlatformAction(action).archive(new Date(archivedAt))), archivedAt };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Cannot transition action")) {
      throw new Error(`Cannot archive action with status "${action.status}".`);
    }
    throw error;
  }
}

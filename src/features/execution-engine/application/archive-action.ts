import type {
  ActionStatus,
  ExecutiveAction,
} from "../domain";

export const ARCHIVABLE_ACTION_STATUSES = [
  "proposed",
  "accepted",
  "blocked",
  "completed",
  "measured",
] as const satisfies readonly ActionStatus[];

export type ArchivableActionStatus =
  (typeof ARCHIVABLE_ACTION_STATUSES)[number];

export type ArchiveActionInput = {
  action: ExecutiveAction;
  archivedAt: string;
};

function isArchivableStatus(
  status: ActionStatus,
): status is ArchivableActionStatus {
  return ARCHIVABLE_ACTION_STATUSES.includes(
    status as ArchivableActionStatus,
  );
}

export function archiveAction({
  action,
  archivedAt,
}: ArchiveActionInput): ExecutiveAction {
  if (!isArchivableStatus(action.status)) {
    throw new Error(
      `Cannot archive action with status "${action.status}".`,
    );
  }

  return {
    ...action,
    status: "archived",
    archivedAt,
  };
}

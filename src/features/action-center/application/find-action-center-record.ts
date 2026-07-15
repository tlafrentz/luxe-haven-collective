import type {
  ActionCenterRecord,
} from "../domain";

export function findActionCenterRecord(
  records: ActionCenterRecord[],
  actionId: string,
): ActionCenterRecord | null {
  return (
    records.find(
      ({ action }) =>
        action.id === actionId,
    ) ?? null
  );
}

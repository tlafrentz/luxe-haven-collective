import type {
  PlatformActionCenterRecord,
} from "../domain";

export function findActionCenterRecord(
  records: readonly PlatformActionCenterRecord[],
  actionId: string,
): PlatformActionCenterRecord | undefined {
  return records.find(
    ({ action }) =>
      action.id.value === actionId,
  );
}

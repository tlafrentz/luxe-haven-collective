import { describe, expect, it } from "vitest";
import { mapPersistenceRowsToPlatformAction, mapPlatformActionToPersistenceRows } from "./action-persistence-mapper";
import { persistedAction } from "./action-persistence-test-support";

describe("Platform Action persistence mapper", () => {
  it("round-trips the complete aggregate without generating history or changing version", () => {
    const original = persistedAction(), rows = mapPlatformActionToPersistenceRows(original), restored = mapPersistenceRowsToPlatformAction(rows);
    expect(mapPlatformActionToPersistenceRows(restored)).toEqual(rows);
    expect(restored.version.value).toBe(original.version.value); expect(restored.history).toHaveLength(original.history.length); expect(restored.assignments).toHaveLength(1); expect(restored.sources).toHaveLength(2); expect(restored.outcomeReferences).toHaveLength(1);
  });
  it("does not mutate persistence rows during hydration", () => {
    const rows = mapPlatformActionToPersistenceRows(persistedAction()), snapshot = structuredClone(rows);
    mapPersistenceRowsToPlatformAction(rows);
    expect(rows).toEqual(snapshot);
  });
  it("rejects child records from another workspace or aggregate", () => {
    const rows = mapPlatformActionToPersistenceRows(persistedAction());
    expect(() => mapPersistenceRowsToPlatformAction({ ...rows, history: [{ ...rows.history[0], workspace_id: "workspace-2" }] })).toThrow("cross aggregate or workspace scope");
  });
});

import { describe, expect, it } from "vitest";

import {
  createPlatformAction,
  createPlatformActionCenterRecord,
} from "../test-support/factories";

import { findActionCenterRecord } from "./find-action-center-record";

describe("findActionCenterRecord", () => {
  it("returns the matching record by Platform action ID value", () => {
    const expected = createPlatformActionCenterRecord({
      action: createPlatformAction({ id: "action-2" }),
    });

    expect(
      findActionCenterRecord(
        [createPlatformActionCenterRecord(), expected],
        "action-2",
      ),
    ).toBe(expected);
  });

  it("returns undefined when the action does not exist", () => {
    expect(
      findActionCenterRecord(
        [createPlatformActionCenterRecord()],
        "missing-action",
      ),
    ).toBeUndefined();
  });

  it("does not mutate the source collection", () => {
    const records = [
      createPlatformActionCenterRecord(),
      createPlatformActionCenterRecord({
        action: createPlatformAction({ id: "action-2" }),
      }),
    ] as const;
    const snapshot = [...records];

    findActionCenterRecord(records, "action-2");

    expect(records).toEqual(snapshot);
  });
});

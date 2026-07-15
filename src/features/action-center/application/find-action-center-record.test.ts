import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createActionCenterRecord,
  createExecutiveAction,
} from "../test-support/factories";

import {
  findActionCenterRecord,
} from "./find-action-center-record";

describe("findActionCenterRecord", () => {
  it("returns the matching action record", () => {
    const expected =
      createActionCenterRecord({
        action: createExecutiveAction({
          id: "action-2",
        }),
      });

    const result =
      findActionCenterRecord(
        [
          createActionCenterRecord(),
          expected,
        ],
        "action-2",
      );

    expect(result).toBe(expected);
  });

  it("returns null when the action does not exist", () => {
    const result =
      findActionCenterRecord(
        [createActionCenterRecord()],
        "missing-action",
      );

    expect(result).toBeNull();
  });
});

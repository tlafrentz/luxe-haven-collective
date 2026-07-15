import { describe, expect, it } from "vitest";

import {
  ACTION_STATUSES,
} from "./action-status";

describe("ACTION_STATUSES", () => {
  it("exports the execution lifecycle in order", () => {
    expect(ACTION_STATUSES).toEqual([
      "proposed",
      "accepted",
      "scheduled",
      "in-progress",
      "blocked",
      "completed",
      "measured",
      "archived",
    ]);
  });
});

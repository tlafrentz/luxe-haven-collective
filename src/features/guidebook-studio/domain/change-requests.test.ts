import { describe, expect, it } from "vitest";
import { summarizeChangeRequests, type ChangeRequestInput } from "./change-requests";

function request(overrides: Partial<ChangeRequestInput> = {}): ChangeRequestInput {
  return {
    id: "cr-1",
    guidebookId: "guidebook-1",
    description: "Update the Wi-Fi password.",
    imageUrls: [],
    urgency: "normal",
    status: "open",
    requestedBy: "profile-1",
    createdAt: "2026-08-08T00:00:00Z",
    ...overrides,
  };
}

describe("summarizeChangeRequests", () => {
  it("counts requests by status and flags high-urgency open requests", () => {
    const summary = summarizeChangeRequests([
      request({ id: "cr-1", status: "open", urgency: "high" }),
      request({ id: "cr-2", status: "open", urgency: "low" }),
      request({ id: "cr-3", status: "in_progress" }),
      request({ id: "cr-4", status: "resolved" }),
      request({ id: "cr-5", status: "declined" }),
    ]);
    expect(summary).toEqual({
      open: 2,
      inProgress: 1,
      resolved: 1,
      declined: 1,
      highUrgencyOpen: 1,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(summarizeChangeRequests([])).toEqual({
      open: 0,
      inProgress: 0,
      resolved: 0,
      declined: 0,
      highUrgencyOpen: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  isApprovalRequestStale,
  latestApprovalRequest,
  type ApprovalRequestInput,
} from "./approval-review";

function request(
  overrides: Partial<ApprovalRequestInput> = {},
): ApprovalRequestInput {
  return {
    id: "req-1",
    guidebookId: "guidebook-1",
    draftRevision: 3,
    requestedBy: "profile-1",
    status: "pending",
    createdAt: "2026-08-08T00:00:00Z",
    ...overrides,
  };
}

describe("isApprovalRequestStale", () => {
  it("is not stale when the draft hasn't moved since the request", () => {
    expect(isApprovalRequestStale(request({ draftRevision: 3 }), 3)).toBe(false);
  });

  it("is stale once the draft has a later revision than what was reviewed", () => {
    expect(isApprovalRequestStale(request({ draftRevision: 3 }), 4)).toBe(true);
  });

  it("is never stale once a decision has already been made", () => {
    expect(
      isApprovalRequestStale(
        request({ draftRevision: 3, status: "approved" }),
        9,
      ),
    ).toBe(false);
  });
});

describe("latestApprovalRequest", () => {
  it("returns null for an empty list", () => {
    expect(latestApprovalRequest([])).toBeNull();
  });

  it("returns the most recently created request", () => {
    const older = request({ id: "req-old", createdAt: "2026-08-01T00:00:00Z" });
    const newer = request({ id: "req-new", createdAt: "2026-08-08T00:00:00Z" });
    expect(latestApprovalRequest([older, newer])?.id).toBe("req-new");
  });
});

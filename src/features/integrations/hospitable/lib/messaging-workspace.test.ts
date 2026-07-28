import { describe, expect, it } from "vitest";
import { assertCanonicalMessagingWorkspace } from "./messaging-workspace";

describe("COM-002C canonical messaging workspace", () => {
  it("accepts the canonical workspace and rejects legacy profile identifiers", () => {
    expect(assertCanonicalMessagingWorkspace("workspace-1", "workspace-1")).toBe("workspace-1");
    expect(() => assertCanonicalMessagingWorkspace("workspace-1", "owner-profile-1"))
      .toThrow("messaging_workspace_scope_mismatch");
  });
});

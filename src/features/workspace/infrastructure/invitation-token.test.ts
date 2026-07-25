import { describe, expect, it } from "vitest";
import { createWorkspaceInvitationToken, hashWorkspaceInvitationToken } from "./invitation-token";

describe("workspace invitation tokens", () => {
  it("creates high-entropy tokens and stores only deterministic SHA-256 hashes", () => {
    const first = createWorkspaceInvitationToken();
    const second = createWorkspaceInvitationToken();
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toHaveLength(64);
    expect(first.hash).toBe(hashWorkspaceInvitationToken(first.token));
    expect(first.hash).not.toContain(first.token);
  });
});

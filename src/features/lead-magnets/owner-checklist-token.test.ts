import { afterEach, describe, expect, it } from "vitest";
import {
  createOwnerChecklistToken,
  verifyOwnerChecklistToken,
} from "./owner-checklist-token";

describe("owner checklist download tokens", () => {
  afterEach(() => delete process.env.OWNER_CHECKLIST_SIGNING_SECRET);

  it("accepts an untampered token before expiration", () => {
    process.env.OWNER_CHECKLIST_SIGNING_SECRET = "test-secret";
    const token = createOwnerChecklistToken("lead-123", 1_000_000);
    expect(verifyOwnerChecklistToken(token, 1_001_000)?.leadId).toBe(
      "lead-123",
    );
  });

  it("rejects tampering and expiration", () => {
    process.env.OWNER_CHECKLIST_SIGNING_SECRET = "test-secret";
    const token = createOwnerChecklistToken("lead-123", 1_000_000);
    expect(verifyOwnerChecklistToken(`${token}x`, 1_001_000)).toBeNull();
    expect(verifyOwnerChecklistToken(token, 1_000_000 + 86_401_000)).toBeNull();
  });
});

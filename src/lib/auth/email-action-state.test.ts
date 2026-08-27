import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("AUTH-EMAIL-001 durable email-action state", () => {
  beforeEach(() => {
    vi.stubEnv(
      "AUTH_EMAIL_ACTION_ENCRYPTION_KEY",
      "test-only-cross-instance-key-material-32-bytes-minimum",
    );
  });

  afterEach(() => vi.unstubAllEnvs());

  it("survives separate module instances without exposing the token", async () => {
    const first = await import("./email-action-state");
    const token = "a".repeat(64);
    const nonce = first.createEmailActionBrowserNonce();
    const encrypted = first.encryptEmailActionToken(token);
    const cookie = first.encodeEmailActionStateCookie({
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: nonce,
    });

    expect(JSON.stringify(encrypted)).not.toContain(token);
    expect(cookie).not.toContain(token);
    vi.resetModules();
    const second = await import("./email-action-state");

    expect(second.decryptEmailActionToken(encrypted)).toBe(token);
    expect(second.decodeEmailActionStateCookie(cookie)).toEqual({
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: nonce,
    });
  });

  it("rejects tampering and a different instance key", async () => {
    const first = await import("./email-action-state");
    const cookie = first.encodeEmailActionStateCookie({
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: first.createEmailActionBrowserNonce(),
    });
    expect(first.decodeEmailActionStateCookie(`${cookie}x`)).toBeNull();

    vi.stubEnv(
      "AUTH_EMAIL_ACTION_ENCRYPTION_KEY",
      "different-test-only-instance-key-material-32-bytes",
    );
    vi.resetModules();
    const second = await import("./email-action-state");
    expect(second.decodeEmailActionStateCookie(cookie)).toBeNull();
  });
});

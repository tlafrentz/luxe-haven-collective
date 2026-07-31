import { describe, expect, it } from "vitest";
import { deriveShareStatus, digestShareSecret, generateShareCredential, validateShareDuration, verifyShareCredential } from "./investment-report-share";

describe("investment report share credentials and lifecycle", () => {
  it("generates 256-bit opaque credentials and persists only a SHA-256 digest", () => {
    const first = generateShareCredential(), second = generateShareCredential();
    expect(first.entropyBits).toBe(256); expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/); expect(first.digest).not.toContain(first.secret);
    expect(second.secret).not.toBe(first.secret); expect(verifyShareCredential(first.secret, first.digest)).toBe(true);
  });
  it("rejects modified secrets and cross-paired credentials", () => {
    const first = generateShareCredential(), second = generateShareCredential();
    expect(verifyShareCredential(`${first.secret.slice(0, -1)}A`, first.digest)).toBe(false);
    expect(verifyShareCredential(first.secret, second.digest)).toBe(false);
    expect(digestShareSecret(first.secret)).toBe(first.digest);
  });
  it.each([24, 168, 720])("accepts the bounded %s-hour duration", value => expect(validateShareDuration(value)).toBe(value));
  it.each([0, 23, 169, 721, -1])("rejects invalid duration %s", value => expect(() => validateShareDuration(value)).toThrow());
  it("derives active, expired, and revoked using server time", () => {
    const now = new Date("2026-07-30T12:00:00Z");
    expect(deriveShareStatus({ expiresAt: "2026-07-30T12:00:01Z", revokedAt: null }, now)).toBe("active");
    expect(deriveShareStatus({ expiresAt: now.toISOString(), revokedAt: null }, now)).toBe("expired");
    expect(deriveShareStatus({ expiresAt: "2026-08-01T00:00:00Z", revokedAt: now.toISOString() }, now)).toBe("revoked");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

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
      version: 1,
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: nonce,
      expiresAt: Date.now() + 60_000,
    });

    expect(JSON.stringify(encrypted)).not.toContain(token);
    expect(cookie).not.toContain(token);
    vi.resetModules();
    const second = await import("./email-action-state");

    expect(second.decryptEmailActionToken(encrypted)).toBe(token);
    expect(second.decodeEmailActionStateCookie(cookie)).toEqual({
      version: 1,
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: nonce,
      expiresAt: expect.any(Number),
    });
  });

  it("verifies the signed browser state in a separate process", () => {
    const moduleUrl = new URL(
      `file://${resolve(process.cwd(), "src/lib/auth/email-action-state.ts")}`,
    ).href;
    const key = "test-only-cross-process-key-material-32-bytes-minimum";
    const create = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `const m=await import(${JSON.stringify(moduleUrl)});process.stdout.write(m.encodeEmailActionStateCookie({version:1,stateId:"00000000-0000-4000-8000-000000000001",browserNonce:"${"n".repeat(43)}",expiresAt:Date.now()+60000}))`,
      ],
      { env: { ...process.env, AUTH_EMAIL_ACTION_ENCRYPTION_KEY: key }, encoding: "utf8" },
    );
    expect(create.status, create.stderr).toBe(0);
    const verify = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `const m=await import(${JSON.stringify(moduleUrl)});const result=m.inspectEmailActionStateCookie(process.argv[1]);process.stdout.write(result.ok?result.value.stateId:"invalid")`,
        create.stdout,
      ],
      { env: { ...process.env, AUTH_EMAIL_ACTION_ENCRYPTION_KEY: key }, encoding: "utf8" },
    );
    expect(verify.status, verify.stderr).toBe(0);
    expect(verify.stdout).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("rejects tampering and a different instance key", async () => {
    const first = await import("./email-action-state");
    const cookie = first.encodeEmailActionStateCookie({
      version: 1,
      stateId: "00000000-0000-4000-8000-000000000001",
      browserNonce: first.createEmailActionBrowserNonce(),
      expiresAt: Date.now() + 60_000,
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

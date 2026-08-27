import { describe, expect, it } from "vitest";
import { digestEmailActionValue } from "./email-action-state";
import { evaluateRecoveryPreclaim } from "./recovery-continuation";

const now = new Date("2026-08-27T12:00:00.000Z");
const nonce = "n".repeat(43);
const actor = "00000000-0000-4000-8000-000000000001";
const state = {
  flow: "recovery",
  status: "pending",
  expiresAt: "2026-08-27T12:10:00.000Z",
  browserNonceDigest: digestEmailActionValue(nonce),
  authUserId: actor,
};

describe("AUTH-EMAIL-002 recovery preclaim", () => {
  it("allows no session and the same validated identity", () => {
    expect(
      evaluateRecoveryPreclaim({ state, browserNonce: nonce, existingUserId: null, now }),
    ).toEqual({ ok: true, nonceDigest: digestEmailActionValue(nonce) });
    expect(
      evaluateRecoveryPreclaim({ state, browserNonce: nonce, existingUserId: actor, now }),
    ).toEqual({ ok: true, nonceDigest: digestEmailActionValue(nonce) });
  });

  it("proves the Production generic-session rejection is removed", () => {
    const decision = evaluateRecoveryPreclaim({
      state,
      browserNonce: nonce,
      existingUserId: actor,
      now,
    });
    expect(decision.ok).toBe(true);
  });

  it("rejects a different validated identity without claiming", () => {
    expect(
      evaluateRecoveryPreclaim({
        state,
        browserNonce: nonce,
        existingUserId: "00000000-0000-4000-8000-000000000002",
        now,
      }),
    ).toEqual({ ok: false, code: "EXISTING_SESSION_DIFFERENT_IDENTITY" });
  });

  it.each([
    [{ ...state, status: "claimed" }, nonce, "ACTION_STATE_ALREADY_CLAIMED"],
    [{ ...state, flow: "invite" }, nonce, "ACTION_STATE_FLOW_MISMATCH"],
    [{ ...state, authUserId: null }, nonce, "ACTION_STATE_FLOW_MISMATCH"],
    [state, "x".repeat(43), "ACTION_STATE_BINDING_MISMATCH"],
    [{ ...state, expiresAt: now.toISOString() }, nonce, "ACTION_STATE_EXPIRED"],
  ] as const)("rejects invalid state without a claim", (candidate, candidateNonce, code) => {
    expect(
      evaluateRecoveryPreclaim({
        state: candidate,
        browserNonce: candidateNonce,
        existingUserId: null,
        now,
      }),
    ).toEqual({ ok: false, code });
  });
});

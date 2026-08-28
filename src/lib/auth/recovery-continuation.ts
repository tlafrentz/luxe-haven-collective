import {
  constantTimeEmailActionDigestEqual,
  digestEmailActionValue,
} from "@/lib/auth/email-action-state";

export type RecoveryPreclaimCode =
  | "ACTION_STATE_EXPIRED"
  | "ACTION_STATE_FLOW_MISMATCH"
  | "ACTION_STATE_BINDING_MISMATCH"
  | "ACTION_STATE_ALREADY_CLAIMED"
  | "EXISTING_SESSION_DIFFERENT_IDENTITY";

export type RecoveryPreclaimState = Readonly<{
  flow: string;
  status: string;
  expiresAt: string;
  browserNonceDigest: string;
  authUserId: string | null;
}>;

export function evaluateRecoveryPreclaim(input: {
  state: RecoveryPreclaimState;
  browserNonce: string;
  existingUserId: string | null;
  now: Date;
}): { ok: true; nonceDigest: string } | { ok: false; code: RecoveryPreclaimCode } {
  if (input.state.expiresAt <= input.now.toISOString())
    return { ok: false, code: "ACTION_STATE_EXPIRED" };
  if (input.state.status !== "pending")
    return { ok: false, code: "ACTION_STATE_ALREADY_CLAIMED" };
  if (input.state.flow !== "recovery" || !input.state.authUserId)
    return { ok: false, code: "ACTION_STATE_FLOW_MISMATCH" };
  const nonceDigest = digestEmailActionValue(input.browserNonce);
  if (
    !constantTimeEmailActionDigestEqual(
      input.state.browserNonceDigest,
      nonceDigest,
    )
  )
    return { ok: false, code: "ACTION_STATE_BINDING_MISMATCH" };
  if (
    input.existingUserId &&
    input.existingUserId !== input.state.authUserId
  )
    return { ok: false, code: "EXISTING_SESSION_DIFFERENT_IDENTITY" };
  return { ok: true, nonceDigest };
}

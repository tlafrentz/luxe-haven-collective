import { randomBytes, createHash } from "node:crypto";

export type PasswordSetupFlow = "invitation" | "recovery";

export const PASSWORD_SETUP_GRANT_COOKIE = "lhc-password-setup-grant";
export const PASSWORD_SETUP_FLOW_COOKIE = "lhc-password-setup-flow";
export const EMAIL_ACTION_COOKIE = "lhc-auth-email-action";

export function createPasswordSetupGrant() {
  const token = randomBytes(32).toString("base64url");
  return Object.freeze({
    token,
    hash: createHash("sha256").update(token, "utf8").digest("hex"),
  });
}

export const passwordSetupCookieOptions = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 15 * 60,
});

export const expiredPasswordSetupCookieOptions = Object.freeze({
  ...passwordSetupCookieOptions,
  maxAge: 0,
});

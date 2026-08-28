import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type StateCookie = Readonly<{
  version: 1;
  stateId: string;
  browserNonce: string;
  expiresAt: number;
}>;

function secret() {
  const value = process.env.AUTH_EMAIL_ACTION_ENCRYPTION_KEY;
  if (!value || value.length < 32)
    throw new Error("AUTH_EMAIL_ACTION_ENCRYPTION_KEY_REQUIRED");
  return createHash("sha256").update(value, "utf8").digest();
}

export const digestEmailActionValue = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function createEmailActionBrowserNonce() {
  return randomBytes(32).toString("base64url");
}

export function encryptEmailActionToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return Object.freeze({
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  });
}

export function decryptEmailActionToken(input: {
  ciphertext: string;
  iv: string;
  tag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret(),
    Buffer.from(input.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encodeEmailActionStateCookie(value: StateCookie) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret())
    .update(payload, "utf8")
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeEmailActionStateCookie(value: string): StateCookie | null {
  const result = inspectEmailActionStateCookie(value);
  return result.ok ? result.value : null;
}

export type EmailActionCookieFailure =
  | "ACTION_COOKIE_MALFORMED"
  | "ACTION_COOKIE_SIGNATURE_INVALID"
  | "ACTION_COOKIE_EXPIRED";

export function inspectEmailActionStateCookie(
  value: string,
): { ok: true; value: StateCookie } | { ok: false; code: EmailActionCookieFailure } {
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra)
      return { ok: false, code: "ACTION_COOKIE_MALFORMED" };
    const expected = createHmac("sha256", secret())
      .update(payload, "utf8")
      .digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      return { ok: false, code: "ACTION_COOKIE_SIGNATURE_INVALID" };
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as StateCookie;
    if (
      parsed.version !== 1 ||
      !/^[0-9a-f-]{36}$/i.test(parsed.stateId) ||
      !/^[a-zA-Z0-9_-]{40,100}$/.test(parsed.browserNonce) ||
      !Number.isSafeInteger(parsed.expiresAt)
    )
      return { ok: false, code: "ACTION_COOKIE_MALFORMED" };
    if (parsed.expiresAt <= Date.now())
      return { ok: false, code: "ACTION_COOKIE_EXPIRED" };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, code: "ACTION_COOKIE_MALFORMED" };
  }
}

export function constantTimeEmailActionDigestEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

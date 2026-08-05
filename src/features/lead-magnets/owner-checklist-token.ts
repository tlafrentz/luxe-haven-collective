import { createHmac, timingSafeEqual } from "node:crypto";

const lifetimeSeconds = 60 * 60 * 24;

function secret() {
  const value =
    process.env.OWNER_CHECKLIST_SIGNING_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("owner_checklist_signing_secret_missing");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createOwnerChecklistToken(leadId: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      leadId,
      expiresAt: Math.floor(now / 1000) + lifetimeSeconds,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyOwnerChecklistToken(token: string, now = Date.now()) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      leadId?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof decoded.leadId !== "string" ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt < Math.floor(now / 1000)
    )
      return null;
    return { leadId: decoded.leadId, expiresAt: decoded.expiresAt };
  } catch {
    return null;
  }
}

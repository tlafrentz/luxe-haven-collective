import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicAuthFlow = "login" | "signup" | "recovery";
export type PublicAuthMode = "closed" | "invite_only" | "broad_beta";

export type PublicAuthDecision = Readonly<{
  allowed: boolean;
  captchaToken?: string;
  correlationId: string;
  code?:
    | "PUBLIC_AUTH_CLOSED"
    | "PUBLIC_SIGNUP_CLOSED"
    | "CAPTCHA_UNAVAILABLE"
    | "CAPTCHA_REQUIRED"
    | "RECIPIENT_SUPPRESSED";
  mode: PublicAuthMode;
}>;

const unavailableMessage =
  "This service is temporarily unavailable. Please try again later.";
export const neutralRecoveryMessage =
  "If an account exists for that email address, we’ll send password-reset instructions shortly.";

export function publicAuthMessage(code?: PublicAuthDecision["code"]) {
  if (code === "PUBLIC_SIGNUP_CLOSED")
    return "New account registration is currently invitation only.";
  return unavailableMessage;
}

export function recipientDigest(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      process.env.TURNSTILE_SECRET_KEY,
  );
}

export async function authorizePublicAuth(
  flow: PublicAuthFlow,
  formData: FormData,
  email?: string,
): Promise<PublicAuthDecision> {
  const admin = createAdminClient();
  const correlationId = randomUUID();
  const { data: control, error } = await admin
    .from("auth_public_control")
    .select("mode,captcha_required")
    .eq("control_key", "public_auth")
    .single<{ mode: PublicAuthMode; captcha_required: boolean }>();
  const mode = control?.mode ?? "closed";
  if (error || !control)
    return { allowed: false, correlationId, mode, code: "PUBLIC_AUTH_CLOSED" };
  if (flow === "signup" && mode !== "broad_beta")
    return {
      allowed: false,
      correlationId,
      mode,
      code: "PUBLIC_SIGNUP_CLOSED",
    };
  if (flow === "recovery" && mode === "closed")
    return { allowed: false, correlationId, mode, code: "PUBLIC_AUTH_CLOSED" };
  if (!configured() || !control.captcha_required) {
    await recordAuthOperationalAlert("captcha_unavailable", correlationId);
    return { allowed: false, correlationId, mode, code: "CAPTCHA_UNAVAILABLE" };
  }
  const captchaToken = String(formData.get("captchaToken") ?? "").trim();
  if (!captchaToken)
    return { allowed: false, correlationId, mode, code: "CAPTCHA_REQUIRED" };
  if (email && flow !== "login") {
    const digest = recipientDigest(email);
    const { data: suppression } = await admin
      .from("auth_email_suppressions")
      .select("id")
      .eq("recipient_digest", digest)
      .eq("active", true)
      .maybeSingle();
    if (suppression)
      return {
        allowed: false,
        correlationId,
        mode,
        code: "RECIPIENT_SUPPRESSED",
      };
  }
  return { allowed: true, captchaToken, correlationId, mode };
}

export function recipientProvider(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain.includes("gmail")
    ? "gmail"
    : domain.includes("outlook") ||
        domain.includes("hotmail") ||
        domain.includes("live.com")
      ? "microsoft"
      : "other";
}

export async function recordAuthEmailRequest(
  flowType: "confirmation" | "recovery",
  email: string,
  correlationId: string,
) {
  const normalized = email.trim().toLowerCase();
  const provider = recipientProvider(normalized);
  await createAdminClient()
    .from("auth_email_requests")
    .insert({
      correlation_id: correlationId,
      flow_type: flowType,
      recipient_digest: recipientDigest(normalized),
      recipient_provider: provider,
    });
}

export function isRateLimitError(
  error: { status?: number; code?: string; message?: string } | null,
) {
  return (
    error?.status === 429 ||
    error?.code === "over_email_send_rate_limit" ||
    /rate limit|too many/i.test(error?.message ?? "")
  );
}

export async function recordAuthOperationalAlert(
  type: "captcha_unavailable" | "auth_rate_limited",
  correlationId: string,
) {
  const hour = new Date();
  hour.setMinutes(0, 0, 0);
  await createAdminClient()
    .from("auth_email_operational_alerts")
    .upsert(
      {
        alert_type: type,
        dedupe_key: `${type}:${hour.toISOString()}`,
        severity: "warning",
        correlation_id: correlationId,
        diagnostic_code: type.toUpperCase(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key" },
    );
}

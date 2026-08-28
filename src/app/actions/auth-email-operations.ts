"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const modeSchema = z.object({
  targetMode: z.enum(["closed", "invite_only", "broad_beta"]),
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().min(8).max(500),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(200),
  confirmation: z.literal("CONFIRM"),
});

export type PublicAuthModeActionState = Readonly<{
  status: "idle" | "success" | "version_conflict" | "rejected" | "validation_error";
  code?: "VERSION_CONFLICT" | "COMMAND_REJECTED" | "VALIDATION_ERROR";
  message?: string;
  currentMode?: "closed" | "invite_only" | "broad_beta";
  currentVersion?: number;
  preservedReason?: string;
}>;

async function authoritativePublicAuthControl(client: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await client.from("auth_public_control").select("mode,version").eq("control_key", "public_auth").single();
  return data as { mode: "closed" | "invite_only" | "broad_beta"; version: number } | null;
}

export async function setPublicAuthModeAction(
  _previousState: PublicAuthModeActionState,
  formData: FormData,
): Promise<PublicAuthModeActionState> {
  await requireRole(["admin"]);
  const parsed = modeSchema.safeParse(Object.fromEntries(formData));
  const preservedReason = String(formData.get("reason") ?? "").slice(0, 500);
  if (!parsed.success) return { status: "validation_error", code: "VALIDATION_ERROR", message: "Review the required confirmation and reason before trying again.", preservedReason };
  const input = parsed.data;
  const client = await createClient();
  const { data, error } = await client.rpc("set_public_auth_mode", {
    p_target_mode: input.targetMode, p_expected_version: input.expectedVersion, p_reason: input.reason,
    p_correlation_id: input.correlationId, p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const current = await authoritativePublicAuthControl(client);
    if (error.message.includes("AUTH_PUBLIC_CONTROL_VERSION_CONFLICT")) {
      revalidatePath("/admin/auth-email");
      return {
        status: "version_conflict",
        code: "VERSION_CONFLICT",
        message: "This setting changed while you were working. We refreshed the current state. Review it before trying again.",
        currentMode: current?.mode,
        currentVersion: current?.version,
        preservedReason,
      };
    }
    return { status: "rejected", code: "COMMAND_REJECTED", message: "The setting could not be changed. Review the current state and try again.", currentMode: current?.mode, currentVersion: current?.version, preservedReason };
  }
  revalidatePath("/admin/auth-email");
  const result = data as { mode: "closed" | "invite_only" | "broad_beta"; version: number };
  return { status: "success", message: "Public authentication mode updated.", currentMode: result.mode, currentVersion: result.version };
}

export async function getAuthEmailOperations() {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const now = new Date();
  const hour = new Date(now); hour.setMinutes(0, 0, 0);
  const [control, hourly, requests, suppressions, receipt, alerts] = await Promise.all([
    db.from("auth_public_control").select("*").eq("control_key", "public_auth").single(),
    db.from("auth_email_requests").select("id", { count: "exact", head: true }).gte("requested_at", hour.toISOString()),
    db.from("auth_email_requests").select("status").gte("requested_at", new Date(Date.now()-24*60*60*1000).toISOString()),
    db.from("auth_email_suppressions").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("auth_email_webhook_receipts").select("received_at,processing_status").order("received_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("auth_email_operational_alerts").select("alert_type,severity,status,last_seen_at,occurrence_count").eq("status", "open").order("last_seen_at", { ascending: false }).limit(20),
  ]);
  const counts: Record<string,number> = {};
  for (const row of requests.data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return { control: control.data, sendsThisHour: hourly.count ?? 0, deliveryCounts: counts, suppressedCount: suppressions.count ?? 0, lastWebhook: receipt.data, alerts: alerts.data ?? [], captchaConfigured: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY), webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SIGNING_SECRET) };
}

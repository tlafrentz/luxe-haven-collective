"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requirePlatformAdministrator() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Permission denied.");
  const { data } = await client.rpc("is_admin");
  if (data !== true) throw new Error("Permission denied.");
  return user;
}

export async function retryCommerceWebhookReceipt(formData: FormData) {
  const user = await requirePlatformAdministrator();
  const receiptId = String(formData.get("receiptId") ?? "");
  if (!receiptId.startsWith("commerce-receipt-")) throw new Error("Invalid receipt.");
  const admin = createAdminClient();
  const { data: receipt } = await admin.from("commerce_webhook_receipts")
    .select("status,normalized_event")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt || receipt.status !== "failed" || !receipt.normalized_event) throw new Error("Receipt is not eligible for retry.");
  const { error } = await admin.rpc("process_commerce_provider_event", { p_event: receipt.normalized_event });
  if (error) throw new Error("Webhook retry failed.");
  await admin.from("commerce_operational_activity").insert({
    id: `commerce-operation-webhook-retry-${crypto.randomUUID()}`,
    action_type: "webhook-retried",
    subject_type: "webhook",
    subject_id: receiptId,
    actor_profile_id: user.id,
    reason: "Administrator retried an eligible failed provider event.",
    result: "succeeded",
  });
  revalidatePath("/admin/commerce/webhooks");
  revalidatePath("/admin/commerce/health");
}

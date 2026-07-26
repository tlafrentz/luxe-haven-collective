"use server";
import { createClient } from "@/lib/supabase/server";
import type { CommerceCheckoutResult, CommerceOrderStatus, CommercePaymentStatus } from "@/platform/commerce";

export async function getCheckoutResult(sessionId: string): Promise<CommerceCheckoutResult | null> {
  if (!sessionId.startsWith("cs_")) return null;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: checkout } = await client.from("commerce_checkout_sessions")
    .select("order_id")
    .eq("provider_session_id", sessionId)
    .maybeSingle();
  if (!checkout) return null;
  const { data: order } = await client.from("commerce_orders")
    .select("id,order_number,status,payment_status,commerce_order_lines(product_snapshot)")
    .eq("id", checkout.order_id)
    .maybeSingle();
  if (!order) return null;
  const lines = order.commerce_order_lines as unknown as { product_snapshot: { name?: string } }[] | null;
  const orderStatus = order.status as CommerceOrderStatus;
  return Object.freeze({
    orderId: order.id,
    orderNumber: order.order_number,
    productName: lines?.[0]?.product_snapshot.name ?? "Luxe Haven purchase",
    orderStatus,
    ...(order.payment_status ? { paymentStatus: order.payment_status as CommercePaymentStatus } : {}),
    fulfillmentStatus: orderStatus === "paid" ? "ready" : orderStatus === "payment-processing" ? "pending" : "not-ready",
    ...(orderStatus === "payment-processing" || orderStatus === "pending-payment" ? { nextAction: "wait" as const }
      : orderStatus === "payment-failed" || orderStatus === "expired" ? { nextAction: "retry-checkout" as const }
      : {}),
    evaluatedAt: new Date(),
  });
}

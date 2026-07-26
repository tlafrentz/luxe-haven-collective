"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateCommerceHealth,
  validatePersistedCommerceCatalog,
  validateCommerceProductionConfiguration,
  type CommerceOperationalCounts,
} from "@/platform/commerce";

async function requireAdministrator() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("commerce_permission_denied");
  const { data: admin } = await client.rpc("is_admin");
  if (admin !== true) throw new Error("commerce_permission_denied");
  return client;
}

export async function getCommerceHealth() {
  const client = await requireAdministrator();
  const [checkouts, orders, payments, subscriptions, webhooks, fulfillments, alerts, reconciliation] = await Promise.all([
    client.from("commerce_checkout_sessions").select("status").limit(5000),
    client.from("commerce_orders").select("status").limit(5000),
    client.from("commerce_payments").select("status").limit(5000),
    client.from("commerce_subscriptions").select("status").limit(5000),
    client.from("commerce_webhook_receipts").select("status,received_at,processed_at").limit(5000),
    client.from("commerce_fulfillments").select("status,created_at,completed_at").limit(5000),
    client.from("commerce_operational_alerts").select("id,alert_type,severity,subject_type,subject_id,status,summary,last_observed_at").neq("status", "resolved").order("last_observed_at", { ascending: false }).limit(100),
    client.from("commerce_reconciliation_jobs").select("id,environment,subject_type,subject_id,status,severity,attempts,created_at,last_error_code").in("status", ["pending", "processing", "drift-detected", "failed"]).order("created_at").limit(100),
  ]);
  const counts: CommerceOperationalCounts = {
    checkouts: countStatuses(checkouts.data),
    orders: countStatuses(orders.data),
    payments: countStatuses(payments.data),
    subscriptions: countStatuses(subscriptions.data),
    webhooks: countStatuses(webhooks.data),
    fulfillments: countStatuses(fulfillments.data),
  };
  const webhookLatency = averageDuration(webhooks.data, "received_at", "processed_at");
  const fulfillmentLatency = averageDuration(fulfillments.data, "created_at", "completed_at");
  return Object.freeze({
    health: evaluateCommerceHealth(counts),
    counts,
    alerts: alerts.data ?? [],
    reconciliation: reconciliation.data ?? [],
    latency: Object.freeze({ webhookMilliseconds: webhookLatency, fulfillmentMilliseconds: fulfillmentLatency }),
    configuration: validateCommerceProductionConfiguration(process.env),
    dataState: [checkouts, orders, payments, subscriptions, webhooks, fulfillments].some((result) => result.error) ? "partial" as const : "current" as const,
  });
}

export async function getCatalogHealth() {
  const client = await requireAdministrator();
  const [products, prices, offers, entitlements, fulfillments] = await Promise.all([
    client.from("commerce_products").select("id,name,status,stripe_product_id,fulfillment_type,fulfillment_template_id,entitlement_template_ids").order("name"),
    client.from("commerce_prices").select("id,product_id,status,price_type,stripe_price_id,version").order("product_id"),
    client.from("commerce_offers").select("id,name,status,product_ids,price_ids").order("name"),
    client.from("commerce_entitlement_templates").select("id"),
    client.from("commerce_fulfillment_templates").select("id"),
  ]);
  const health = validatePersistedCommerceCatalog({
    products: (products.data ?? []).map((item) => ({
      id: item.id, status: item.status, stripeProductId: item.stripe_product_id,
      fulfillmentType: item.fulfillment_type, fulfillmentTemplateId: item.fulfillment_template_id,
      entitlementTemplateIds: item.entitlement_template_ids ?? [],
    })),
    prices: (prices.data ?? []).map((item) => ({
      id: item.id, productId: item.product_id, status: item.status,
      priceType: item.price_type, stripePriceId: item.stripe_price_id,
    })),
    offers: (offers.data ?? []).map((item) => ({
      id: item.id, status: item.status, productIds: item.product_ids ?? [], priceIds: item.price_ids ?? [],
    })),
    entitlementTemplateIds: (entitlements.data ?? []).map((item) => item.id),
    fulfillmentTemplateIds: (fulfillments.data ?? []).map((item) => item.id),
  });
  return Object.freeze({
    health,
    products: products.data ?? [],
    prices: prices.data ?? [],
    offers: offers.data ?? [],
    dataState: [products, prices, offers, entitlements, fulfillments].some((item) => item.error) ? "partial" as const : "current" as const,
  });
}

export async function refreshCommerceAlerts() {
  const client = await requireAdministrator();
  const { error } = await client.rpc("refresh_commerce_operational_alerts");
  if (error) throw new Error("commerce_alert_refresh_failed");
  revalidatePath("/admin/commerce/health");
}

export async function queueCommerceReconciliation(formData: FormData) {
  const client = await requireAdministrator();
  const environment = String(formData.get("environment") ?? "");
  const subjectType = String(formData.get("subjectType") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const { error } = await client.rpc("queue_commerce_reconciliation", {
    p_environment: environment,
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_reason: reason,
  });
  if (error) throw new Error("commerce_reconciliation_failed");
  revalidatePath("/admin/commerce/health");
}

function countStatuses(rows: { status: string }[] | null): Readonly<Record<string, number>> {
  return Object.freeze((rows ?? []).reduce<Record<string, number>>((result, row) => {
    result[row.status] = (result[row.status] ?? 0) + 1;
    return result;
  }, {}));
}

function averageDuration<T extends Record<string, unknown>>(rows: T[] | null, start: keyof T, end: keyof T) {
  const durations = (rows ?? []).flatMap((row) => {
    if (!row[start] || !row[end]) return [];
    return [new Date(String(row[end])).getTime() - new Date(String(row[start])).getTime()];
  }).filter((duration) => duration >= 0);
  return durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : undefined;
}

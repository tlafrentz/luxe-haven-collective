import {
  CommercePaymentError,
  type CommercePaymentStatus,
  type CommerceProviderEvent,
} from "../../application";
import type { CommerceEnvironment } from "../../application";

type StripeEvent = Readonly<{
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: Readonly<{ object: Record<string, unknown> }>;
}>;

export async function verifyStripeWebhook(input: Readonly<{
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}>): Promise<StripeEvent> {
  if (!input.signatureHeader || !input.secret) {
    throw new CommercePaymentError("commerce_webhook_invalid_signature", "The Stripe webhook signature is missing.");
  }
  const parts = input.signatureHeader.split(",").map((value) => value.trim().split("=") as [string, string]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > (input.toleranceSeconds ?? 300)) {
    throw new CommercePaymentError("commerce_webhook_invalid_signature", "The Stripe webhook signature timestamp is invalid.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${input.rawBody}`),
  );
  const expected = toHex(new Uint8Array(digest));
  if (!signatures.some((signature) => constantTimeEqual(signature, expected))) {
    throw new CommercePaymentError("commerce_webhook_invalid_signature", "The Stripe webhook signature is invalid.");
  }
  let value: unknown;
  try {
    value = JSON.parse(input.rawBody);
  } catch {
    throw new CommercePaymentError("commerce_webhook_invalid_signature", "The Stripe webhook payload is malformed.");
  }
  if (!isStripeEvent(value)) {
    throw new CommercePaymentError("commerce_webhook_processing_failed", "The Stripe event envelope is incomplete.");
  }
  return value;
}

export function normalizeStripeWebhookEvent(
  event: StripeEvent,
  expectedEnvironment: CommerceEnvironment,
): CommerceProviderEvent {
  const environment: CommerceEnvironment = event.livemode ? "live" : "test";
  if (environment !== expectedEnvironment) {
    throw new CommercePaymentError("commerce_environment_mismatch", "The Stripe event environment does not match this deployment.");
  }
  const object = event.data.object;
  const metadata = stringRecord(object.metadata);
  const subscriptionItem = firstSubscriptionItem(object);
  const invoiceLine = firstInvoiceLine(object);
  const providerSubscriptionId = stringId(object.subscription)
    ?? stringId(nested(object, "parent", "subscription_details", "subscription"))
    ?? (event.type.startsWith("customer.subscription.") ? stringId(object.id) : undefined);
  const common = {
    provider: "stripe" as const,
    environment,
    providerEventId: event.id,
    providerEventType: event.type,
    providerCreatedAt: new Date(event.created * 1000),
    providerCustomerId: stringId(object.customer),
    providerCheckoutSessionId: event.type.startsWith("checkout.session.") ? stringId(object.id) : undefined,
    providerPaymentIntentId: stringId(object.payment_intent) ?? (event.type.startsWith("payment_intent.") ? stringId(object.id) : undefined),
    providerChargeId: stringId(object.charge) ?? (event.type === "charge.refunded" ? stringId(object.id) : undefined),
    providerSubscriptionId,
    internalOrderId: metadata.order_id,
    internalCustomerId: metadata.commerce_customer_id,
    workspaceId: metadata.workspace_id,
    metadata,
  };
  const currency = upperString(object.currency);
  const paymentAmount = integer(object.amount_received) ?? integer(object.amount_total) ?? integer(object.amount_paid)
    ?? integer(object.total) ?? integer(object.amount);
  const paymentStatus = mapPaymentStatus(object.payment_status ?? object.status);
  const eventType = normalizeEventType(event.type, stringId(object.mode));
  const refund = eventType === "refund.updated";
  const invoice = eventType.startsWith("invoice.");
  const subscription = eventType.startsWith("subscription.");
  const paymentMethod = eventType === "billing.payment-method-updated";
  return Object.freeze({
    ...withoutUndefined(common),
    eventType,
    ...(paymentAmount !== undefined ? { amountMinor: paymentAmount } : {}),
    ...(currency ? { currency } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(refund ? {
      providerRefundId: stringId(object.id),
      refundedAmountMinor: integer(object.amount),
      refundStatus: mapRefundStatus(object.status),
    } : {}),
    ...(event.type === "charge.refunded" ? {
      refundedAmountMinor: integer(object.amount_refunded),
      refundStatus: "succeeded" as const,
    } : {}),
    ...(failureCode(object) ? { failureCode: failureCode(object) } : {}),
    ...(subscription ? {
      subscriptionStatus: mapSubscriptionStatus(object.status),
      providerPriceId: stringId(nested(subscriptionItem, "price", "id")) ?? stringId(nested(subscriptionItem, "pricing", "price_details", "price")),
      providerProductId: stringId(nested(subscriptionItem, "price", "product")) ?? stringId(nested(subscriptionItem, "pricing", "price_details", "product")),
      currentPeriodStart: unixDate(subscriptionItem.current_period_start ?? object.current_period_start),
      currentPeriodEnd: unixDate(subscriptionItem.current_period_end ?? object.current_period_end),
      cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : false,
    } : {}),
    ...(invoice ? {
      providerInvoiceId: stringId(object.id),
      invoiceNumber: stringId(object.number),
      invoiceStatus: mapInvoiceStatus(object.status),
      invoiceUrl: safeStripeUrl(object.hosted_invoice_url),
      invoicePdfUrl: safeStripeUrl(object.invoice_pdf),
      currentPeriodStart: unixDate(nested(invoiceLine, "period", "start") ?? object.period_start),
      currentPeriodEnd: unixDate(nested(invoiceLine, "period", "end") ?? object.period_end),
      dueAt: unixDate(object.due_date),
      nextPaymentAttemptAt: unixDate(object.next_payment_attempt),
    } : {}),
    ...(paymentMethod ? {
      providerPaymentMethodId: stringId(object.id),
      paymentMethodBrand: stringId(nested(object, "card", "brand")),
      paymentMethodLastFour: stringId(nested(object, "card", "last4")),
      paymentMethodExpirationMonth: integer(nested(object, "card", "exp_month")),
      paymentMethodExpirationYear: integer(nested(object, "card", "exp_year")),
    } : {}),
  }) as CommerceProviderEvent;
}

function normalizeEventType(type: string, mode?: string): CommerceProviderEvent["eventType"] {
  if (type === "checkout.session.completed") return mode === "subscription" ? "subscription.checkout.completed" : "checkout.completed";
  if (type === "checkout.session.async_payment_succeeded" || type === "payment_intent.succeeded") return "payment.succeeded";
  if (type === "checkout.session.async_payment_failed" || type === "payment_intent.payment_failed") return "payment.failed";
  if (type === "checkout.session.expired") return "checkout.expired";
  if (type === "payment_intent.processing") return "payment.processing";
  if (type === "payment_intent.canceled") return "payment.cancelled";
  if (["refund.created", "refund.updated", "refund.failed", "charge.refunded"].includes(type)) return "refund.updated";
  if (type === "customer.subscription.created") return "subscription.created";
  if (type === "customer.subscription.updated") return "subscription.updated";
  if (type === "customer.subscription.deleted") return "subscription.cancelled";
  if (type === "customer.subscription.paused") return "subscription.paused";
  if (type === "customer.subscription.resumed") return "subscription.resumed";
  if (type === "invoice.created" || type === "invoice.finalized") return "invoice.created";
  if (type === "invoice.updated") return "invoice.updated";
  if (type === "invoice.paid") return "invoice.paid";
  if (type === "invoice.payment_failed" || type === "invoice.payment_action_required") return "invoice.payment-failed";
  if (type === "invoice.finalization_failed") return "invoice.finalization-failed";
  if (["payment_method.attached","payment_method.updated","payment_method.automatically_updated"].includes(type)) return "billing.payment-method-updated";
  return "unsupported";
}

function mapPaymentStatus(value: unknown): CommercePaymentStatus | undefined {
  if (value === "paid" || value === "succeeded") return "succeeded";
  if (value === "unpaid" || value === "processing") return "processing";
  if (value === "failed" || value === "requires_payment_method") return "failed";
  if (value === "canceled" || value === "cancelled") return "cancelled";
  return undefined;
}

function mapRefundStatus(value: unknown): "pending" | "succeeded" | "failed" | "cancelled" | undefined {
  return value === "pending" || value === "succeeded" || value === "failed" || value === "cancelled" ? value : undefined;
}
function mapSubscriptionStatus(value: unknown): CommerceProviderEvent["subscriptionStatus"] {
  if (value === "incomplete") return "incomplete";
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due") return "past-due";
  if (value === "paused") return "paused";
  if (value === "canceled") return "cancelled";
  if (value === "incomplete_expired") return "expired";
  if (value === "unpaid") return "unpaid";
  return undefined;
}
function mapInvoiceStatus(value: unknown): CommerceProviderEvent["invoiceStatus"] {
  return value === "draft" || value === "open" || value === "paid" || value === "void" || value === "uncollectible" ? value : undefined;
}

function failureCode(object: Record<string, unknown>): string | undefined {
  const error = object.last_payment_error;
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function isStripeEvent(value: unknown): value is StripeEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.type === "string" && typeof record.created === "number"
    && typeof record.livemode === "boolean" && !!record.data && typeof record.data === "object"
    && !!(record.data as Record<string, unknown>).object && typeof (record.data as Record<string, unknown>).object === "object";
}
function stringId(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function nested(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
function firstSubscriptionItem(object: Record<string, unknown>): Record<string, unknown> {
  const data = nested(object, "items", "data");
  return Array.isArray(data) && data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
}
function firstInvoiceLine(object: Record<string, unknown>): Record<string, unknown> {
  const data = nested(object, "lines", "data");
  return Array.isArray(data) && data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
}
function unixDate(value: unknown): Date | undefined {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : undefined;
}
function safeStripeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".stripe.com") || url.hostname === "stripe.com") ? value : undefined;
  } catch { return undefined; }
}
function upperString(value: unknown): string | undefined { return typeof value === "string" ? value.toUpperCase() : undefined; }
function integer(value: unknown): number | undefined { return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined; }
function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object") return Object.freeze({});
  return Object.freeze(Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
}
function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined)) as T;
}
function toHex(bytes: Uint8Array): string { return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

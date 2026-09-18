import type { verifyStripeWebhook } from "@/platform/commerce";

/**
 * A dedicated, minimal normalizer for booking payment events — deliberately
 * not reusing normalizeStripeWebhookEvent from the commerce module, since
 * that function hardcodes SaaS-commerce metadata keys (metadata.order_id,
 * metadata.commerce_customer_id) and event shapes (subscriptions, invoices)
 * this domain doesn't have. verifyStripeWebhook (signature verification)
 * IS reused as-is — it's a pure, provider-shape utility with no commerce
 * coupling.
 */
type StripeEventLike = Awaited<ReturnType<typeof verifyStripeWebhook>>;

export type BookingPaymentEventType =
  | "checkout.completed"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "checkout.expired"
  | "unsupported";

export type NormalizedBookingPaymentEvent = Readonly<{
  environment: "test" | "live";
  providerEventId: string;
  providerEventType: BookingPaymentEventType;
  providerCreatedAt: string;
  providerCheckoutSessionId?: string;
  providerPaymentIntentId?: string;
  amountMinor?: number;
  currency?: string;
  metadata: Readonly<Record<string, string>>;
}>;

export class BookingPaymentEnvironmentMismatch extends Error {
  constructor() {
    super("The Stripe event environment does not match this deployment.");
    this.name = "BookingPaymentEnvironmentMismatch";
  }
}

function mapEventType(type: string): BookingPaymentEventType {
  if (type === "checkout.session.completed") return "checkout.completed";
  if (type === "checkout.session.expired") return "checkout.expired";
  if (type === "payment_intent.succeeded") return "payment.succeeded";
  if (type === "payment_intent.payment_failed") return "payment.failed";
  if (type === "payment_intent.canceled") return "payment.cancelled";
  return "unsupported";
}

function stringMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function normalizeBookingPaymentEvent(
  event: StripeEventLike,
  expectedEnvironment: "test" | "live",
): NormalizedBookingPaymentEvent {
  const environment: "test" | "live" = event.livemode ? "live" : "test";
  if (environment !== expectedEnvironment) {
    throw new BookingPaymentEnvironmentMismatch();
  }

  const object = event.data.object;
  const isCheckoutSession = event.type.startsWith("checkout.session.");
  const isPaymentIntent = event.type.startsWith("payment_intent.");

  const amountMinor =
    typeof object.amount_total === "number"
      ? object.amount_total
      : typeof object.amount_received === "number"
        ? object.amount_received
        : typeof object.amount === "number"
          ? object.amount
          : undefined;

  return Object.freeze({
    environment,
    providerEventId: event.id,
    providerEventType: mapEventType(event.type),
    providerCreatedAt: new Date(event.created * 1000).toISOString(),
    ...(isCheckoutSession && typeof object.id === "string" ? { providerCheckoutSessionId: object.id } : {}),
    ...(isPaymentIntent && typeof object.id === "string"
      ? { providerPaymentIntentId: object.id }
      : typeof object.payment_intent === "string"
        ? { providerPaymentIntentId: object.payment_intent }
        : {}),
    ...(amountMinor !== undefined ? { amountMinor } : {}),
    ...(typeof object.currency === "string" ? { currency: object.currency.toUpperCase() } : {}),
    metadata: stringMetadata(object.metadata),
  });
}

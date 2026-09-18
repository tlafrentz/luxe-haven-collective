/**
 * The Stripe API key and environment are shared with the existing SaaS
 * commerce integration (src/platform/commerce) — same Stripe account, same
 * getStripeCommerceConfig(). Only the webhook signing secret is distinct,
 * because bookings use their own Stripe webhook endpoint
 * (/api/webhooks/stripe/bookings), isolated from the commerce webhook's
 * existing processing paths.
 */
export function getBookingStripeWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<{ secret: string }> {
  const secret = env.STRIPE_BOOKING_WEBHOOK_SECRET?.trim();

  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("STRIPE_BOOKING_WEBHOOK_SECRET is required.");
  }

  return Object.freeze({ secret });
}

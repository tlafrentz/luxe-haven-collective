import { getStripeCommerceConfig, type StripeCommerceConfig } from "@/platform/commerce";

/**
 * A small, dedicated Stripe client for booking payments — mirrors
 * src/platform/commerce/infrastructure/stripe/stripe-commerce-provider.ts's
 * conventions (hand-rolled fetch, form-encoded body, Idempotency-Key
 * header, pinned Stripe-Version) rather than routing bookings through the
 * catalog/price-shaped StripeCommerceProvider, since a dated stay with a
 * calendar-block hard gate doesn't map onto "offer/price/product".
 */
export type CreateBookingCheckoutInput = Readonly<{
  customerEmail: string;
  currency: string;
  amountMinor: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Readonly<Record<string, string>>;
  idempotencyKey: string;
}>;

export type BookingCheckoutSession = Readonly<{
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  expiresAt: Date;
  environment: "test" | "live";
}>;

export type CreateBookingRefundInput = Readonly<{
  paymentIntentId: string;
  amountMinor: number;
  metadata: Readonly<Record<string, string>>;
  idempotencyKey: string;
}>;

export type BookingRefundResult = Readonly<{
  id: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  amountMinor: number;
  failureCode?: string | undefined;
}>;

export class BookingStripeClient {
  constructor(
    private readonly config: StripeCommerceConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async createCheckoutSession(input: CreateBookingCheckoutInput): Promise<BookingCheckoutSession> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("Booking checkout amount is invalid.");
    }

    const body = new URLSearchParams({
      mode: "payment",
      customer_email: input.customerEmail,
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": input.productName,
      "line_items[0][price_data][unit_amount]": String(input.amountMinor),
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    for (const [key, value] of Object.entries(input.metadata)) {
      body.set(`metadata[${key}]`, value);
      body.set(`payment_intent_data[metadata][${key}]`, value);
    }

    const response = await this.fetcher("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body,
    });
    if (!response.ok) throw await stripeError(response);

    const value = (await response.json()) as Record<string, unknown>;
    return Object.freeze({
      id: String(value.id),
      url: typeof value.url === "string" ? value.url : null,
      status: value.status === "complete" ? "complete" as const : value.status === "expired" ? "expired" as const : "open" as const,
      expiresAt: new Date(Number(value.expires_at) * 1000),
      environment: this.config.environment,
    });
  }

  get environment(): "test" | "live" {
    return this.config.environment;
  }

  async createRefund(input: CreateBookingRefundInput): Promise<BookingRefundResult> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("Booking refund amount is invalid.");
    }
    if (!/^pi_[A-Za-z0-9_]+$/.test(input.paymentIntentId)) {
      throw new Error("Booking refund payment reference is invalid.");
    }

    const body = new URLSearchParams({
      payment_intent: input.paymentIntentId,
      amount: String(input.amountMinor),
      reason: "requested_by_customer",
    });
    for (const [key, value] of Object.entries(input.metadata)) {
      body.set(`metadata[${key}]`, value);
    }

    const response = await this.fetcher("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body,
    });
    if (!response.ok) throw await stripeError(response);

    const value = (await response.json()) as Record<string, unknown>;
    const status = value.status;
    return Object.freeze({
      id: String(value.id),
      status:
        status === "succeeded" ? "succeeded" as const
        : status === "failed" ? "failed" as const
        : status === "canceled" ? "canceled" as const
        : "pending" as const,
      amountMinor: typeof value.amount === "number" ? value.amount : input.amountMinor,
      failureCode: typeof value.failure_reason === "string" ? value.failure_reason : undefined,
    });
  }

  private headers() {
    return { Authorization: `Bearer ${this.config.apiKey}`, "Stripe-Version": this.config.apiVersion };
  }
}

async function stripeError(response: Response): Promise<Error> {
  let code = "stripe_error";
  let message = "Stripe checkout is unavailable.";
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // Fall through with the generic message.
  }
  const error = new Error(message);
  Object.assign(error, { code, status: response.status });
  return error;
}

export function getBookingStripeClient(fetcher: typeof fetch = fetch): BookingStripeClient {
  return new BookingStripeClient(getStripeCommerceConfig(), fetcher);
}

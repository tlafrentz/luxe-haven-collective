import type { CommerceOrderStatus } from "../domain";
import type { CommerceEnvironment } from "./checkout";
import type { CommerceInvoiceStatus, CommerceSubscriptionStatus } from "./billing";

export type CommercePaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partially-refunded"
  | "refunded"
  | "unknown";

export type CommerceProviderEventType =
  | "checkout.completed"
  | "checkout.expired"
  | "payment.processing"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "refund.updated"
  | "subscription.checkout.completed"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "subscription.paused"
  | "subscription.resumed"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.paid"
  | "invoice.payment-failed"
  | "invoice.finalization-failed"
  | "billing.payment-method-updated"
  | "unsupported";

export type CommerceProviderEvent = Readonly<{
  provider: "stripe";
  environment: CommerceEnvironment;
  providerEventId: string;
  providerEventType: string;
  eventType: CommerceProviderEventType;
  providerCreatedAt: Date;
  providerCustomerId?: string;
  providerCheckoutSessionId?: string;
  providerPaymentIntentId?: string;
  providerChargeId?: string;
  providerSubscriptionId?: string;
  providerRefundId?: string;
  providerPriceId?: string;
  providerProductId?: string;
  providerInvoiceId?: string;
  internalOrderId?: string;
  internalCustomerId?: string;
  workspaceId?: string;
  amountMinor?: number;
  currency?: string;
  paymentStatus?: CommercePaymentStatus;
  refundedAmountMinor?: number;
  refundStatus?: "pending" | "succeeded" | "failed" | "cancelled";
  failureCode?: string;
  subscriptionStatus?: CommerceSubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  invoiceNumber?: string;
  invoiceStatus?: CommerceInvoiceStatus;
  invoiceUrl?: string;
  invoicePdfUrl?: string;
  dueAt?: Date;
  nextPaymentAttemptAt?: Date;
  providerPaymentMethodId?: string;
  paymentMethodBrand?: string;
  paymentMethodLastFour?: string;
  paymentMethodExpirationMonth?: number;
  paymentMethodExpirationYear?: number;
  metadata: Readonly<Record<string, string>>;
}>;

export type CommerceCheckoutResult = Readonly<{
  orderId: string;
  orderNumber: string;
  productName: string;
  orderStatus: CommerceOrderStatus;
  paymentStatus?: CommercePaymentStatus;
  fulfillmentStatus: "not-ready" | "ready" | "pending" | "unavailable";
  nextAction?: "wait" | "retry-checkout" | "contact-support";
  evaluatedAt: Date;
}>;

export class CommercePaymentError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
    Object.freeze(this);
  }
}

const ORDER_TRANSITIONS: Readonly<Record<CommerceOrderStatus, readonly CommerceOrderStatus[]>> = Object.freeze({
  draft: ["pending-payment", "cancelled"],
  "pending-payment": ["payment-processing", "paid", "payment-failed", "expired", "cancelled"],
  "payment-processing": ["paid", "payment-failed", "expired"],
  paid: ["partially-refunded", "refunded"],
  "payment-failed": ["payment-processing", "paid", "expired", "cancelled"],
  "partially-refunded": ["refunded"],
  refunded: [],
  cancelled: [],
  expired: ["paid"],
});

export function assertCommerceOrderTransition(current: CommerceOrderStatus, next: CommerceOrderStatus): void {
  if (current === next) return;
  if (!ORDER_TRANSITIONS[current].includes(next)) {
    throw new CommercePaymentError(
      "commerce_invalid_payment_transition",
      `Commerce Order cannot transition from ${current} to ${next}.`,
    );
  }
}

export function orderStatusForProviderEvent(
  current: CommerceOrderStatus,
  event: CommerceProviderEvent,
): CommerceOrderStatus {
  let next = current;
  if (event.eventType === "checkout.completed") {
    next = event.paymentStatus === "succeeded" ? "paid" : "payment-processing";
  } else if (event.eventType === "subscription.checkout.completed") {
    next = event.paymentStatus === "succeeded" ? "paid" : "payment-processing";
  } else if (event.eventType === "payment.processing") {
    next = "payment-processing";
  } else if (event.eventType === "payment.succeeded") {
    next = "paid";
  } else if (event.eventType === "payment.failed") {
    next = "payment-failed";
  } else if (event.eventType === "checkout.expired") {
    next = "expired";
  } else if (event.eventType === "refund.updated" && event.refundStatus === "succeeded") {
    next = event.refundedAmountMinor === event.amountMinor ? "refunded" : "partially-refunded";
  }
  assertCommerceOrderTransition(current, next);
  return next;
}

export function reconcileProviderAmount(
  order: Readonly<{ totalMinor: number; currency: string }>,
  event: Pick<CommerceProviderEvent, "amountMinor" | "currency">,
): void {
  if (event.currency && event.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new CommercePaymentError("commerce_currency_mismatch", "Provider and Order currencies do not match.");
  }
  if (event.amountMinor !== undefined && event.amountMinor !== order.totalMinor) {
    throw new CommercePaymentError("commerce_amount_mismatch", "Provider and Order totals do not match.");
  }
}

export function isRetryableCommercePaymentError(error: unknown): boolean {
  return error instanceof CommercePaymentError && error.retryable;
}

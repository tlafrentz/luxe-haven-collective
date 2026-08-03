export const OFFER_STATUSES = [
  "draft",
  "under_review",
  "published",
  "paused",
  "archived",
] as const;
export const OFFER_TYPES = [
  "digital_product",
  "configured_product",
  "fixed_scope_service",
  "consulting_engagement",
  "subscription",
] as const;
export const FULFILLMENT_MODELS = [
  "immediate_access",
  "customer_configured",
  "luxe_haven_delivered",
  "collaborative_delivery",
  "recurring_service",
] as const;
export const PAYMENT_MODELS = [
  "free",
  "one_time",
  "deposit_balance",
  "installments",
  "subscription",
  "invoice",
  "proposal_required",
] as const;
export function offerReadiness(input: {
  name?: string;
  slug?: string;
  offerType?: string;
  fulfillmentModel?: string;
  paymentModel?: string;
  activationSteps: number;
  priceCount: number;
}) {
  const missing: string[] = [];
  if (!input.name?.trim()) missing.push("name");
  if (!input.slug?.trim()) missing.push("slug");
  if (!input.offerType) missing.push("offer type");
  if (!input.fulfillmentModel) missing.push("fulfillment model");
  if (!input.paymentModel) missing.push("payment model");
  if (
    input.paymentModel !== "free" &&
    input.paymentModel !== "proposal_required" &&
    !input.priceCount
  )
    missing.push("pricing");
  if (!input.activationSteps) missing.push("activation workflow");
  return { ready: missing.length === 0, missing: Object.freeze(missing) };
}
export function activationIdempotencyKey(
  orderId: string,
  flowId: string,
  version: number,
) {
  return `activate:${orderId}:${flowId}:v${version}`;
}
export function preserveOrderSnapshot<T>(value: T): T {
  return structuredClone(value);
}
export function separateOrderStatuses(input: {
  payment?: string | null;
  activation?: string | null;
  fulfillment?: string | null;
}) {
  return Object.freeze({
    payment: input.payment ?? "pending",
    activation: input.activation ?? "not_started",
    fulfillment: input.fulfillment ?? "not_required",
  });
}

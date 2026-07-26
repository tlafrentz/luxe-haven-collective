import { Money } from "@/platform/kernel";

export type CommerceProductType = "subscription" | "digital-product" | "professional-service" | "scheduled-service" | "one-time-service" | "add-on" | "credit-pack";
export type ProductStatus = "draft" | "active" | "inactive" | "archived";
export type PriceType = "free" | "one-time" | "monthly" | "annual" | "custom-quote";
export type PriceStatus = "draft" | "active" | "inactive" | "archived";
export type FulfillmentType = "digital-download" | "entitlement-grant" | "service-project" | "appointment" | "analysis-credit" | "manual-fulfillment" | "no-fulfillment";
export type EligibilityAudience = "public" | "authenticated" | "workspace" | "owner" | "admin" | "invite-only" | "property-required" | "opportunity-required";
export type CommerceOrderStatus =
  | "draft"
  | "pending-payment"
  | "payment-processing"
  | "paid"
  | "payment-failed"
  | "partially-refunded"
  | "refunded"
  | "cancelled"
  | "expired";

export type CommerceCategory = Readonly<{ id: string; slug: string; name: string; description?: string; active: boolean }>;
export type EntitlementTemplate = Readonly<{ id: string; key: string; name: string; description: string; grantQuantity?: number; metadata: Readonly<Record<string, string>> }>;
export type FulfillmentTemplate = Readonly<{ id: string; type: FulfillmentType; name: string; handlerKey: string; configuration: Readonly<Record<string, string>> }>;
export type EligibilityPolicy = Readonly<{ id: string; audience: EligibilityAudience; active: boolean }>;

export type CommerceProduct = Readonly<{
  id: string; slug: string; name: string; shortDescription: string; longDescription: string;
  categoryId: string; type: CommerceProductType; fulfillmentType: FulfillmentType; status: ProductStatus;
  eligibilityPolicyId?: string; entitlementTemplateIds: readonly string[]; fulfillmentTemplateId?: string;
  providerReferences: Readonly<{ stripeProductId?: string }>; metadata: Readonly<Record<string, string>>;
  createdAt: Date; updatedAt: Date;
}>;

export type CommercePrice = Readonly<{
  id: string; productId: string; version: number; type: PriceType; amount: Money;
  interval?: "month" | "year"; providerReferences: Readonly<{ stripePriceId?: string }>;
  status: PriceStatus; effectiveFrom?: Date; effectiveTo?: Date; createdAt: Date;
}>;

/** An offer bundles products and selects commercial availability without changing product identity. */
export type CommerceOffer = Readonly<{
  id: string; slug: string; name: string; productIds: readonly string[]; priceIds: readonly string[];
  eligibilityPolicyId?: string; status: ProductStatus; metadata: Readonly<Record<string, string>>;
  availableFrom?: Date; availableTo?: Date; createdAt: Date; updatedAt: Date;
}>;

export type CommerceCustomer = Readonly<{
  id: string; workspaceId?: string; profileId?: string; email: string;
  providerReferences: Readonly<{ stripeCustomerId?: string }>;
  status: "active" | "inactive" | "archived"; createdAt: Date;
}>;

export type CommerceProductSnapshot = Readonly<{ id: string; slug: string; name: string; type: CommerceProductType; fulfillmentType: FulfillmentType; entitlementTemplateIds: readonly string[]; metadata: Readonly<Record<string, string>> }>;
export type CommercePriceSnapshot = Readonly<{ id: string; version: number; type: PriceType; amount: Readonly<{ amount: number; currency: string; minorUnits: number }> }>;
export type CommerceOrderLine = Readonly<{ id: string; orderId: string; productSnapshot: CommerceProductSnapshot; priceSnapshot: CommercePriceSnapshot; quantity: number; lineTotal: Money }>;
export type CommerceOrder = Readonly<{ id: string; orderNumber: string; customerId: string; workspaceId?: string; status: CommerceOrderStatus; currency: string; subtotal: Money; total: Money; lines: readonly CommerceOrderLine[]; createdAt: Date; updatedAt: Date }>;

export class CommerceDomainError extends Error {
  constructor(public readonly code: string, message: string) { super(message); Object.freeze(this); }
}

export function createCommerceProduct(input: Omit<CommerceProduct, "providerReferences" | "metadata"> & { providerReferences?: CommerceProduct["providerReferences"]; metadata?: Record<string, string> }): CommerceProduct {
  if (!input.id.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || !input.name.trim()) throw new CommerceDomainError("COMMERCE_PRODUCT_INVALID", "Product identity, slug, and name are required.");
  return freeze({ ...input, entitlementTemplateIds: [...new Set(input.entitlementTemplateIds)], providerReferences: { ...input.providerReferences }, metadata: { ...input.metadata } });
}

export function createCommercePrice(input: Omit<CommercePrice, "version" | "providerReferences"> & { version?: number; providerReferences?: CommercePrice["providerReferences"] }): CommercePrice {
  if (!input.id.trim() || !input.productId.trim() || input.amount.isNegative()) throw new CommerceDomainError("COMMERCE_PRICE_INVALID", "Price identity, product, and a non-negative amount are required.");
  if ((input.type === "monthly" || input.type === "annual") && !input.interval) throw new CommerceDomainError("COMMERCE_PRICE_INTERVAL_REQUIRED", "Recurring prices require an interval.");
  return freeze({ ...input, version: input.version ?? 1, providerReferences: { ...input.providerReferences } });
}

export function createCommerceOrder(input: { id: string; orderNumber: string; customerId: string; workspaceId?: string; currency: string; lines: readonly { id: string; product: CommerceProduct; price: CommercePrice; quantity: number }[]; createdAt: Date }): CommerceOrder {
  if (!input.lines.length) throw new CommerceDomainError("COMMERCE_ORDER_EMPTY", "An order requires at least one line.");
  const lines = input.lines.map(({ id, product, price, quantity }) => {
    if (price.productId !== product.id || !Number.isInteger(quantity) || quantity < 1) throw new CommerceDomainError("COMMERCE_ORDER_LINE_INVALID", "Order line product, price, and quantity must be compatible.");
    return freeze({ id, orderId: input.id, productSnapshot: { id: product.id, slug: product.slug, name: product.name, type: product.type, fulfillmentType: product.fulfillmentType, entitlementTemplateIds: [...product.entitlementTemplateIds], metadata: { ...product.metadata } }, priceSnapshot: { id: price.id, version: price.version, type: price.type, amount: { amount: price.amount.amount, currency: price.amount.currency, minorUnits: price.amount.minorUnits } }, quantity, lineTotal: price.amount.multiply(quantity) });
  });
  const subtotal = lines.reduce((sum, line) => sum.add(line.lineTotal), Money.zero(input.currency));
  return freeze({ id: input.id, orderNumber: input.orderNumber, customerId: input.customerId, ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}), status: "draft" as const, currency: input.currency, subtotal, total: subtotal, lines, createdAt: new Date(input.createdAt), updatedAt: new Date(input.createdAt) });
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

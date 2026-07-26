import type { CommerceOffer, CommercePrice, CommerceProduct, EligibilityAudience, EligibilityPolicy } from "../domain";

export interface CommerceCatalogRepository {
  listProducts(): Promise<readonly CommerceProduct[]>;
  listPrices(): Promise<readonly CommercePrice[]>;
  listOffers(): Promise<readonly CommerceOffer[]>;
  getProduct(idOrSlug: string): Promise<CommerceProduct | null>;
}
export interface CommerceCustomerRepository { save(customer: import("../domain").CommerceCustomer): Promise<void>; }
export interface CommerceOrderRepository { save(order: import("../domain").CommerceOrder): Promise<void>; }

export type CommerceActorContext = Readonly<{ authenticated: boolean; workspaceId?: string; owner: boolean; admin: boolean; invited?: boolean; propertyId?: string; opportunityId?: string }>;

export function resolveProductEligibility(policy: EligibilityPolicy | undefined, actor: CommerceActorContext) {
  if (!policy?.active) return Object.freeze({ eligible: !policy, reason: policy ? "Eligibility policy is inactive." : undefined });
  const rules: Record<EligibilityAudience, boolean> = { public: true, authenticated: actor.authenticated, workspace: Boolean(actor.workspaceId), owner: actor.owner, admin: actor.admin, "invite-only": Boolean(actor.invited), "property-required": Boolean(actor.propertyId), "opportunity-required": Boolean(actor.opportunityId) };
  return Object.freeze({ eligible: rules[policy.audience], ...(rules[policy.audience] ? {} : { reason: `${policy.audience} eligibility is required.` }) });
}

export async function getCommerceCatalog(repository: CommerceCatalogRepository) {
  const [products, prices, offers] = await Promise.all([repository.listProducts(), repository.listPrices(), repository.listOffers()]);
  const active = products.filter(({ status }) => status === "active");
  return Object.freeze({ products: Object.freeze(active.map(product => Object.freeze({ ...product, prices: Object.freeze(prices.filter(price => price.productId === product.id && price.status === "active")) }))), offers: Object.freeze(offers.filter(({ status }) => status === "active")), state: active.length ? "available" as const : "empty" as const });
}

export async function getCommerceAdministration(repository: CommerceCatalogRepository) {
  const [products, prices, offers] = await Promise.all([repository.listProducts(), repository.listPrices(), repository.listOffers()]);
  return Object.freeze({ products, prices, offers, counts: Object.freeze({ products: products.length, activeProducts: products.filter(({ status }) => status === "active").length, prices: prices.length, offers: offers.length }) });
}

export async function getCommerceProduct(repository: CommerceCatalogRepository, idOrSlug: string) {
  const product = await repository.getProduct(idOrSlug);
  if (!product) return null;
  const prices = (await repository.listPrices()).filter(price => price.productId === product.id);
  return Object.freeze({ product, prices: Object.freeze(prices) });
}

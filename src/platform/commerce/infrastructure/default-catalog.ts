import { Money } from "@/platform/kernel";
import { createCommercePrice, createCommerceProduct, type CommerceOffer } from "../domain";
import { InMemoryCommerceCatalogRepository } from "./in-memory-commerce-repository";

const createdAt = new Date("2026-07-25T00:00:00.000Z");
const products = [
  createCommerceProduct({ id: "commerce-product-investment-analysis", slug: "investment-decision-analysis", name: "Investment Decision Analysis", shortDescription: "Transparent property underwriting with evidence, risks, and recommendation.", longDescription: "A complete Purchase or Rental Arbitrage investment decision analysis with inspectable calculations.", categoryId: "investment", type: "professional-service", fulfillmentType: "analysis-credit", status: "active", eligibilityPolicyId: "public", entitlementTemplateIds: ["investment.analysis.create", "reports.generate"], fulfillmentTemplateId: "grant-analysis-credit", createdAt, updatedAt: createdAt, metadata: { featured: "true" } }),
  createCommerceProduct({ id: "commerce-product-guidebook-design", slug: "guidebook-design", name: "Guidebook Design", shortDescription: "Professional guest guidebook design.", longDescription: "A professionally configured digital guidebook for one property.", categoryId: "guidebooks", type: "professional-service", fulfillmentType: "service-project", status: "active", eligibilityPolicyId: "workspace", entitlementTemplateIds: ["guidebooks.design"], fulfillmentTemplateId: "create-guidebook-project", createdAt, updatedAt: createdAt }),
] as const;
const prices = [
  createCommercePrice({ id: "commerce-price-investment-analysis-v1", productId: products[0].id, type: "one-time", amount: Money.usd(199), status: "active", effectiveFrom: createdAt, createdAt }),
  createCommercePrice({ id: "commerce-price-guidebook-design-v1", productId: products[1].id, type: "custom-quote", amount: Money.usd(0), status: "active", effectiveFrom: createdAt, createdAt }),
] as const;
const offers: readonly CommerceOffer[] = [Object.freeze({ id: "commerce-offer-investment-starter", slug: "investment-starter-pack", name: "Investment Starter Pack", productIds: [products[0].id], priceIds: [prices[0].id], eligibilityPolicyId: "public", status: "active", metadata: Object.freeze({ featured: "true" }), createdAt, updatedAt: createdAt })];
export const defaultCommerceCatalog = new InMemoryCommerceCatalogRepository(products, prices, offers);

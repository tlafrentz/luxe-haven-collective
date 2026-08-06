import type { SupabaseClient } from "@supabase/supabase-js";
import { Money } from "@/platform/kernel";
import type { CommerceCatalogRepository } from "../application";
import type { CommerceOffer, CommercePrice, CommerceProduct } from "../domain";

type ProductRow = {
  id: string; slug: string; name: string; short_description: string; long_description: string;
  category_id: string; product_type: string; fulfillment_type: string; status: string;
  eligibility_policy_id: string | null; entitlement_template_ids: string[]; fulfillment_template_id: string | null;
  stripe_product_id: string | null; metadata: Record<string, string>;
  created_at: string; updated_at: string;
};

type PriceRow = {
  id: string; product_id: string; version: number; price_type: string; amount_minor: number; currency: string;
  billing_interval: string | null; stripe_price_id: string | null; status: string;
  effective_from: string | null; effective_to: string | null; created_at: string;
};

type OfferRow = {
  id: string; slug: string; name: string; product_ids: string[]; price_ids: string[];
  eligibility_policy_id: string | null; status: string; metadata: Record<string, string>;
  available_from: string | null; available_to: string | null; created_at: string; updated_at: string;
};

function mapProduct(row: ProductRow): CommerceProduct {
  return Object.freeze({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    categoryId: row.category_id,
    type: row.product_type as CommerceProduct["type"],
    fulfillmentType: row.fulfillment_type as CommerceProduct["fulfillmentType"],
    status: row.status as CommerceProduct["status"],
    ...(row.eligibility_policy_id ? { eligibilityPolicyId: row.eligibility_policy_id } : {}),
    entitlementTemplateIds: Object.freeze(row.entitlement_template_ids ?? []),
    ...(row.fulfillment_template_id ? { fulfillmentTemplateId: row.fulfillment_template_id } : {}),
    providerReferences: Object.freeze({
      ...(row.stripe_product_id ? { stripeProductId: row.stripe_product_id } : {}),
    }),
    metadata: Object.freeze(row.metadata ?? {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function mapPrice(row: PriceRow): CommercePrice {
  return Object.freeze({
    id: row.id,
    productId: row.product_id,
    version: row.version,
    type: row.price_type as CommercePrice["type"],
    amount: Money.fromMinorUnits(row.amount_minor, row.currency),
    ...(row.billing_interval ? { interval: row.billing_interval as CommercePrice["interval"] } : {}),
    providerReferences: Object.freeze({
      ...(row.stripe_price_id ? { stripePriceId: row.stripe_price_id } : {}),
    }),
    status: row.status as CommercePrice["status"],
    ...(row.effective_from ? { effectiveFrom: new Date(row.effective_from) } : {}),
    ...(row.effective_to ? { effectiveTo: new Date(row.effective_to) } : {}),
    createdAt: new Date(row.created_at),
  });
}

function mapOffer(row: OfferRow): CommerceOffer {
  return Object.freeze({
    id: row.id,
    slug: row.slug,
    name: row.name,
    productIds: Object.freeze(row.product_ids ?? []),
    priceIds: Object.freeze(row.price_ids ?? []),
    ...(row.eligibility_policy_id ? { eligibilityPolicyId: row.eligibility_policy_id } : {}),
    status: row.status as CommerceOffer["status"],
    metadata: Object.freeze(row.metadata ?? {}),
    ...(row.available_from ? { availableFrom: new Date(row.available_from) } : {}),
    ...(row.available_to ? { availableTo: new Date(row.available_to) } : {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export class SupabaseCommerceCatalogRepository implements CommerceCatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listProducts(): Promise<readonly CommerceProduct[]> {
    const { data, error } = await this.client.from("commerce_products").select("*");
    if (error) throw error;
    return (data as ProductRow[]).map(mapProduct);
  }

  async listPrices(): Promise<readonly CommercePrice[]> {
    const { data, error } = await this.client.from("commerce_prices").select("*");
    if (error) throw error;
    return (data as PriceRow[]).map(mapPrice);
  }

  async listOffers(): Promise<readonly CommerceOffer[]> {
    const { data, error } = await this.client.from("commerce_offers").select("*");
    if (error) throw error;
    return (data as OfferRow[]).map(mapOffer);
  }

  async getProduct(idOrSlug: string): Promise<CommerceProduct | null> {
    const { data, error } = await this.client
      .from("commerce_products")
      .select("*")
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data as ProductRow) : null;
  }
}

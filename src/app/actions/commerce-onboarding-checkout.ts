"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CommerceCheckoutError,
  createCommerceCheckout,
  getStripeCommerceConfig,
  StripeCommerceProvider,
  SupabaseCommerceCatalogRepository,
  type CommerceCheckoutRecord,
  type CommerceCustomer,
  type CommerceOrder,
} from "@/platform/commerce";
import { SupabaseWorkspaceRepository } from "@/features/workspace/infrastructure/supabase-workspace-repository";
import { plansBySlug, resolvePlanOfferId, type PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics/track";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export type BeginOnboardingCheckoutResult =
  | { redirectUrl: string }
  | { error: string };

export async function beginCommerceOnboardingCheckout(
  planSlug: string,
  billing: BillingCycle,
): Promise<BeginOnboardingCheckoutResult> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "NOT_AUTHENTICATED" };

  const plan = plansBySlug[planSlug as PlanSlug];
  if (!plan) return { error: "OFFER_UNAVAILABLE" };

  const offerId = resolvePlanOfferId(plan, billing);
  if (!offerId) return { error: "OFFER_UNAVAILABLE" };

  const identity = await new SupabaseWorkspaceRepository().resolveIdentity(user.id);
  if (!identity.workspaceId) return { error: "WORKSPACE_NOT_CONFIGURED" };

  const config = getStripeCommerceConfig();
  const catalog = new SupabaseCommerceCatalogRepository(client);

  const customers = {
    async findByIdentity(input: { profileId?: string; email: string }) {
      const { data, error } = await client
        .from("commerce_customers")
        .select("*")
        .or(`profile_id.eq.${input.profileId},email.eq.${input.email}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return Object.freeze({
        id: data.id,
        profileId: data.profile_id ?? undefined,
        workspaceId: data.workspace_id ?? undefined,
        email: data.email,
        providerReferences: Object.freeze({ stripeCustomerId: data.stripe_customer_id ?? undefined }),
        status: data.status,
        createdAt: new Date(data.created_at),
      }) as CommerceCustomer;
    },
    async save(value: CommerceCustomer) {
      const { error } = await client.from("commerce_customers").upsert({
        id: value.id,
        profile_id: value.profileId ?? null,
        workspace_id: value.workspaceId ?? null,
        email: value.email,
        stripe_customer_id: value.providerReferences.stripeCustomerId ?? null,
        status: value.status,
        created_at: value.createdAt.toISOString(),
      });
      if (error) throw error;
    },
  };

  const orders = {
    async save(value: CommerceOrder) {
      const { error } = await client.from("commerce_orders").insert({
        id: value.id,
        order_number: value.orderNumber,
        customer_id: value.customerId,
        workspace_id: value.workspaceId ?? null,
        status: value.status,
        currency: value.currency,
        subtotal_minor: value.subtotal.minorUnits,
        total_minor: value.total.minorUnits,
        created_at: value.createdAt.toISOString(),
        updated_at: value.updatedAt.toISOString(),
      });
      if (error) throw error;
      const { error: lineError } = await client.from("commerce_order_lines").insert(
        value.lines.map((line) => ({
          id: line.id,
          order_id: value.id,
          product_snapshot: line.productSnapshot,
          price_snapshot: line.priceSnapshot,
          quantity: line.quantity,
          line_total_minor: line.lineTotal.minorUnits,
        })),
      );
      if (lineError) throw lineError;
    },
  };

  const checkouts = {
    async save(value: CommerceCheckoutRecord) {
      const { error } = await client.from("commerce_checkout_sessions").insert({
        id: value.id,
        provider_session_id: value.providerSessionId,
        order_id: value.orderId,
        customer_id: value.customerId,
        workspace_id: value.workspaceId ?? null,
        product_id: value.productId,
        offer_id: value.offerId,
        price_id: value.priceId,
        environment: value.environment,
        status: value.status,
        checkout_url: value.checkoutUrl ?? null,
        expires_at: value.expiresAt.toISOString(),
        created_at: value.createdAt.toISOString(),
      });
      if (error) throw error;
    },
    async findByProviderSession() {
      return null;
    },
  };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    track("checkout_started", { plan: plan.slug, billing, workspaceId: identity.workspaceId });
    const result = await createCommerceCheckout(
      {
        catalog,
        customers,
        orders,
        checkouts,
        provider: new StripeCommerceProvider(config),
        environment: config.environment,
      },
      {
        offerId,
        commerceCustomerId: `commerce-customer-${user.id}`,
        email: user.email ?? "",
        profileId: user.id,
        workspaceId: identity.workspaceId,
        baseUrl,
        idempotencyKey: `checkout:${user.id}:${offerId}:${crypto.randomUUID()}`,
        successPath: `/commerce/complete?plan=${plan.slug}`,
        cancelPath: `/commerce/checkout/cancelled?plan=${plan.slug}`,
      },
    );
    if (!result.redirectUrl) return { error: "NO_REDIRECT_URL" };
    return { redirectUrl: result.redirectUrl };
  } catch (error) {
    if (error instanceof CommerceCheckoutError) return { error: error.code };
    throw error;
  }
}

"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  activationIdempotencyKey,
  offerReadiness,
} from "@/features/offer-catalog";
async function admin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
export async function getOfferCatalog() {
  const { db } = await admin();
  const results = await Promise.all([
    db.from("commerce_products").select("*"),
    db.from("commerce_offer_definitions").select("*"),
    db.from("commerce_offer_variants").select("*").order("sort_order"),
    db.from("commerce_offer_deliverables").select("*").order("sort_order"),
    db
      .from("commerce_prices")
      .select("*")
      .order("version", { ascending: false }),
    db.from("commerce_catalog_addons").select("*"),
    db.from("commerce_bundles").select("*"),
    db.from("commerce_bundle_items").select("*"),
    db.from("commerce_checkout_flows").select("*"),
    db.from("commerce_activation_flows").select("*"),
    db.from("commerce_activation_steps").select("*").order("position"),
    db
      .from("commerce_orders")
      .select(
        "*,commerce_customers(email),commerce_order_lines(product_snapshot,price_snapshot,quantity,line_total_minor)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("commerce_payments")
      .select(
        "order_id,status,amount_minor,captured_amount_minor,refunded_amount_minor,created_at",
      ),
    db
      .from("commerce_fulfillments")
      .select(
        "id,order_id,status,target_type,target_id,failure_code,created_at,completed_at",
      ),
    db
      .from("commerce_entitlement_grants")
      .select(
        "id,order_id,entitlement_key,status,effective_from,effective_until",
      ),
    db.from("commerce_activation_runs").select("*"),
    db.from("commerce_activation_step_runs").select("*"),
    db
      .from("commerce_offer_activity")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(100),
    db
      .from("commerce_catalog_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle(),
    db.from("commerce_categories").select("*").eq("active", true),
  ]);
  const error = results.find((x) => x.error)?.error;
  const [
    dataProducts,
    dataDefinitions,
    dataVariants,
    dataDeliverables,
    dataPrices,
    dataAddons,
    dataBundles,
    dataBundleItems,
    dataCheckout,
    dataFlows,
    dataSteps,
    dataOrders,
    dataPayments,
    dataFulfillments,
    dataEntitlements,
    dataRuns,
    dataStepRuns,
    dataActivity,
    dataSettings,
    dataCategories,
  ] = results;
  return {
    ok: !error,
    error: error?.message,
    products: dataProducts.data ?? [],
    definitions: dataDefinitions.data ?? [],
    variants: dataVariants.data ?? [],
    deliverables: dataDeliverables.data ?? [],
    prices: dataPrices.data ?? [],
    addons: dataAddons.data ?? [],
    bundles: dataBundles.data ?? [],
    bundleItems: dataBundleItems.data ?? [],
    checkoutFlows: dataCheckout.data ?? [],
    activationFlows: dataFlows.data ?? [],
    activationSteps: dataSteps.data ?? [],
    orders: dataOrders.data ?? [],
    payments: dataPayments.data ?? [],
    fulfillments: dataFulfillments.data ?? [],
    entitlements: dataEntitlements.data ?? [],
    activationRuns: dataRuns.data ?? [],
    activationStepRuns: dataStepRuns.data ?? [],
    activity: dataActivity.data ?? [],
    settings: dataSettings.data ?? null,
    categories: dataCategories.data ?? [],
  };
}
export async function createOfferAction(formData: FormData) {
  const { db, user } = await admin(),
    id = `commerce-product-${crypto.randomUUID()}`,
    slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    name = String(formData.get("name") ?? "").trim(),
    category = String(formData.get("category") ?? ""),
    offerType = String(formData.get("offerType") ?? "configured_product"),
    fulfillmentModel = String(
      formData.get("fulfillmentModel") ?? "customer_configured",
    ),
    paymentModel = String(formData.get("paymentModel") ?? "one_time"),
    amount = Math.round((Number(formData.get("price")) || 0) * 100);
  if (!name || !slug || !category) throw new Error("offer_identity_required");
  const now = new Date().toISOString(),
    priceId = `commerce-price-${crypto.randomUUID()}`;
  const product = {
    id,
    slug,
    name,
    short_description: String(formData.get("shortDescription") ?? ""),
    long_description: String(formData.get("description") ?? ""),
    category_id: category,
    product_type: offerType === "subscription" ? "subscription" : "product",
    fulfillment_type:
      fulfillmentModel === "immediate_access"
        ? "entitlement-grant"
        : fulfillmentModel === "luxe_haven_delivered"
          ? "service-project"
          : "manual-fulfillment",
    status: "draft",
    entitlement_template_ids: [],
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  const { error } = await db.from("commerce_products").insert(product);
  if (error) throw new Error(error.message);
  const { data: flow, error: flowError } = await db
    .from("commerce_activation_flows")
    .insert({
      product_id: id,
      name: `${name} activation`,
      trigger_type:
        paymentModel === "free" ? "free_order_created" : "payment_succeeded",
      status: "draft",
    })
    .select("id")
    .single();
  if (flowError) throw new Error(flowError.message);
  await Promise.all([
    db.from("commerce_offer_definitions").insert({
      product_id: id,
      offer_type: offerType,
      fulfillment_model: fulfillmentModel,
      payment_model: paymentModel,
      specialist_workspace: String(formData.get("workspace") ?? "") || null,
      owner_name: String(formData.get("owner") ?? ""),
      catalog_status: "draft",
      intended_customer: String(formData.get("customer") ?? ""),
      best_fit: String(formData.get("bestFit") ?? ""),
      expected_time_to_value: String(formData.get("timeToValue") ?? ""),
    }),
    db.from("commerce_prices").insert({
      id: priceId,
      product_id: id,
      version: 1,
      price_type: paymentModel === "subscription" ? "recurring" : "one-time",
      amount_minor: amount,
      currency: "USD",
      billing_interval: paymentModel === "subscription" ? "month" : null,
      status: "draft",
      created_at: now,
    }),
    db.from("commerce_checkout_flows").insert({
      product_id: id,
      mode:
        paymentModel === "proposal_required"
          ? "proposal_required"
          : "self_service",
      settings: {
        guestCheckout: true,
        accountRequired: false,
        promoCodes: true,
        termsAcceptance: true,
      },
    }),
    db.from("commerce_activation_steps").insert({
      flow_id: flow.id,
      step_type: "create_entitlement",
      name: "Create customer entitlement",
      position: 1,
    }),
    db.from("commerce_offer_activity").insert({
      product_id: id,
      event_type: "offer_created",
      summary: `Offer ${name} created`,
      actor_id: user.id,
    }),
  ]);
  revalidatePath("/admin/offers");
  redirect(`/admin/offers/${id}`);
}
export async function updateOfferStatusAction(formData: FormData) {
  const { db, user } = await admin(),
    productId = String(formData.get("productId")),
    status = String(formData.get("status"));
  if (
    !["draft", "under_review", "published", "paused", "archived"].includes(
      status,
    )
  )
    throw new Error("invalid_offer_status");
  if (status === "published") {
    const [{ data: p }, { data: d }, { count: prices }, { data: flow }] =
        await Promise.all([
          db
            .from("commerce_products")
            .select("name,slug")
            .eq("id", productId)
            .single(),
          db
            .from("commerce_offer_definitions")
            .select("offer_type,fulfillment_model,payment_model")
            .eq("product_id", productId)
            .single(),
          db
            .from("commerce_prices")
            .select("id", { count: "exact", head: true })
            .eq("product_id", productId),
          db
            .from("commerce_activation_flows")
            .select("id")
            .eq("product_id", productId)
            .single(),
        ]),
      { count: steps } = await db
        .from("commerce_activation_steps")
        .select("id", { count: "exact", head: true })
        .eq("flow_id", flow?.id ?? "");
    const readiness = offerReadiness({
      name: p?.name,
      slug: p?.slug,
      offerType: d?.offer_type,
      fulfillmentModel: d?.fulfillment_model,
      paymentModel: d?.payment_model,
      activationSteps: steps ?? 0,
      priceCount: prices ?? 0,
    });
    if (!readiness.ready)
      throw new Error(`offer_not_ready:${readiness.missing.join(",")}`);
  }
  await Promise.all([
    db
      .from("commerce_offer_definitions")
      .update({ catalog_status: status, updated_at: new Date().toISOString() })
      .eq("product_id", productId),
    db
      .from("commerce_products")
      .update({
        status:
          status === "published"
            ? "active"
            : status === "archived"
              ? "archived"
              : status === "draft"
                ? "draft"
                : "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId),
    db.from("commerce_offer_activity").insert({
      product_id: productId,
      event_type: `offer_${status}`,
      summary: `Offer moved to ${status.replaceAll("_", " ")}`,
      actor_id: user.id,
    }),
  ]);
  revalidatePath(`/admin/offers/${productId}`);
  revalidatePath("/admin/offers/catalog");
}
export async function createActivationRunAction(formData: FormData) {
  const { db } = await admin(),
    orderId = String(formData.get("orderId")),
    productId = String(formData.get("productId")),
    { data: flow } = await db
      .from("commerce_activation_flows")
      .select("id,version")
      .eq("product_id", productId)
      .single();
  if (!flow) throw new Error("activation_flow_missing");
  const key = activationIdempotencyKey(orderId, flow.id, flow.version),
    { data: run, error } = await db
      .from("commerce_activation_runs")
      .upsert(
        {
          order_id: orderId,
          flow_id: flow.id,
          idempotency_key: key,
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" },
      )
      .select("id")
      .single();
  if (error) throw new Error(error.message);
  const { data: steps } = await db
    .from("commerce_activation_steps")
    .select("id")
    .eq("flow_id", flow.id);
  if (steps?.length)
    await db.from("commerce_activation_step_runs").upsert(
      steps.map((step) => ({
        run_id: run.id,
        step_id: step.id,
        status: "not_started",
      })),
      { onConflict: "run_id,step_id" },
    );
  await db
    .from("commerce_orders")
    .update({ activation_status: "in_progress" })
    .eq("id", orderId);
  revalidatePath(`/admin/offers/orders/${orderId}`);
}
export async function createBundleAction(formData: FormData) {
  const { db } = await admin();
  const name = String(formData.get("name") ?? "").trim(),
    slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  if (!name || !slug) throw new Error("bundle_identity_required");
  const { data, error } = await db
    .from("commerce_bundles")
    .insert({
      name,
      slug,
      description: String(formData.get("description") ?? ""),
      amount_minor: Math.round((Number(formData.get("price")) || 0) * 100),
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const productIds = formData.getAll("productId").map(String);
  if (productIds.length)
    await db
      .from("commerce_bundle_items")
      .insert(
        productIds.map((productId, index) => ({
          bundle_id: data.id,
          product_id: productId,
          activation_order: index + 1,
        })),
      );
  revalidatePath("/admin/offers/bundles");
  redirect(`/admin/offers/bundles/${data.id}`);
}
export async function createAddonAction(formData: FormData) {
  const { db } = await admin();
  const { error } = await db
    .from("commerce_catalog_addons")
    .insert({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      linked_product_ids: formData.getAll("productId").map(String),
      amount_minor: Math.round((Number(formData.get("price")) || 0) * 100),
      payment_model: "one_time",
      selection_rule: String(formData.get("selectionRule") ?? "optional"),
      status: "active",
    });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/offers/add-ons");
}
export async function createPriceVersionAction(formData: FormData) {
  const { db } = await admin(),
    productId = String(formData.get("productId"));
  const { data: latest } = await db
    .from("commerce_prices")
    .select("version")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db
    .from("commerce_prices")
    .insert({
      id: `commerce-price-${crypto.randomUUID()}`,
      product_id: productId,
      version: Number(latest?.version ?? 0) + 1,
      price_type: String(formData.get("priceType") ?? "one-time"),
      amount_minor: Math.round((Number(formData.get("price")) || 0) * 100),
      currency: "USD",
      billing_interval: String(formData.get("interval") ?? "") || null,
      status: "draft",
      effective_from: String(formData.get("effectiveFrom") ?? "") || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/offers/pricing");
}
export async function createOfferVariantAction(formData: FormData) {
  const { db } = await admin(),
    productId = String(formData.get("productId"));
  const { error } = await db
    .from("commerce_offer_variants")
    .insert({
      product_id: productId,
      name: String(formData.get("name") ?? ""),
      sku: String(formData.get("sku") ?? ""),
      description: String(formData.get("description") ?? ""),
      price_override_minor: formData.get("price")
        ? Math.round(Number(formData.get("price")) * 100)
        : null,
      status: "draft",
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/offers/${productId}`);
}
export async function createOfferDeliverableAction(formData: FormData) {
  const { db } = await admin(),
    productId = String(formData.get("productId"));
  const { error } = await db
    .from("commerce_offer_deliverables")
    .insert({
      product_id: productId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      quantity: Number(formData.get("quantity")) || 1,
      delivery_method: String(formData.get("method") ?? "digital"),
      required: formData.get("required") === "on",
      fulfilled_by: String(formData.get("fulfilledBy") ?? "Luxe Haven"),
      expected_timing: String(formData.get("timing") ?? ""),
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/offers/${productId}`);
}

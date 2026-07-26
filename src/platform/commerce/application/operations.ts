import type {
  CommerceOffer,
  CommercePrice,
  CommerceProduct,
  EntitlementTemplate,
  FulfillmentTemplate,
} from "../domain";

export type CommerceHealthStatus = "healthy" | "degraded" | "critical" | "unavailable";
export type CommerceDriftSeverity = "critical" | "high" | "medium" | "low";

export type CommerceOperationalCounts = Readonly<{
  checkouts: Readonly<Record<string, number>>;
  orders: Readonly<Record<string, number>>;
  payments: Readonly<Record<string, number>>;
  subscriptions: Readonly<Record<string, number>>;
  webhooks: Readonly<Record<string, number>>;
  fulfillments: Readonly<Record<string, number>>;
}>;

export type CommerceHealthMetric = Readonly<{
  key: string;
  label: string;
  status: CommerceHealthStatus;
  value?: number;
  unit?: "percent" | "count" | "milliseconds";
  explanation: string;
}>;

export type CommerceHealth = Readonly<{
  status: CommerceHealthStatus;
  metrics: readonly CommerceHealthMetric[];
  evaluatedAt: Date;
}>;

export type CatalogValidationIssue = Readonly<{
  code: string;
  severity: CommerceDriftSeverity;
  subjectType: "product" | "offer" | "price";
  subjectId: string;
  message: string;
}>;

export type CatalogHealth = Readonly<{
  status: CommerceHealthStatus;
  issues: readonly CatalogValidationIssue[];
  evaluatedAt: Date;
}>;

export type ProductionConfigurationCheck = Readonly<{
  key: string;
  status: "pass" | "fail" | "warning";
  explanation: string;
}>;

export function evaluateCommerceHealth(
  counts: CommerceOperationalCounts,
  evaluatedAt = new Date(),
): CommerceHealth {
  const checkoutCompleted = counts.checkouts.completed ?? 0;
  const checkoutFailed =
    (counts.checkouts.cancelled ?? 0) + (counts.checkouts.expired ?? 0);
  const paymentSucceeded = counts.payments.succeeded ?? 0;
  const paymentFailed = counts.payments.failed ?? 0;
  const webhookProcessed = counts.webhooks.processed ?? 0;
  const webhookFailed = counts.webhooks.failed ?? 0;
  const fulfillmentCompleted =
    (counts.fulfillments.completed ?? 0) +
    (counts.fulfillments.ready ?? 0) +
    (counts.fulfillments["in-progress"] ?? 0);
  const fulfillmentFailed = counts.fulfillments.failed ?? 0;
  const pastDue =
    (counts.subscriptions["past-due"] ?? 0) + (counts.subscriptions.unpaid ?? 0);
  const active =
    (counts.subscriptions.active ?? 0) + (counts.subscriptions.trialing ?? 0);

  const rate = (success: number, failed: number) =>
    success + failed === 0 ? undefined : (success / (success + failed)) * 100;
  const statusForRate = (value: number | undefined): CommerceHealthStatus =>
    value === undefined ? "unavailable" : value >= 98 ? "healthy" : value >= 90 ? "degraded" : "critical";
  const statusForFailures = (failed: number): CommerceHealthStatus =>
    failed === 0 ? "healthy" : failed <= 2 ? "degraded" : "critical";

  const checkoutRate = rate(checkoutCompleted, checkoutFailed);
  const paymentRate = rate(paymentSucceeded, paymentFailed);
  const webhookRate = rate(webhookProcessed, webhookFailed);
  const fulfillmentRate = rate(fulfillmentCompleted, fulfillmentFailed);

  const metrics: CommerceHealthMetric[] = [
    {
      key: "checkout-success",
      label: "Checkout success",
      status: statusForRate(checkoutRate),
      value: checkoutRate,
      unit: "percent",
      explanation: "Completed sessions compared with cancelled and expired sessions.",
    },
    {
      key: "payment-success",
      label: "Payment success",
      status: statusForRate(paymentRate),
      value: paymentRate,
      unit: "percent",
      explanation: "Successful payment attempts compared with failed attempts.",
    },
    {
      key: "webhook-health",
      label: "Webhook health",
      status: statusForRate(webhookRate),
      value: webhookRate,
      unit: "percent",
      explanation: "Processed verified events compared with failed processing.",
    },
    {
      key: "fulfillment-health",
      label: "Fulfillment health",
      status: statusForRate(fulfillmentRate),
      value: fulfillmentRate,
      unit: "percent",
      explanation: "Completed or actionable handoffs compared with failed fulfillment.",
    },
    {
      key: "subscription-attention",
      label: "Subscription attention",
      status: statusForFailures(pastDue),
      value: pastDue,
      unit: "count",
      explanation: `${active} active or trialing; ${pastDue} past due or unpaid.`,
    },
  ];
  const status = metrics.some((metric) => metric.status === "critical")
    ? "critical"
    : metrics.some((metric) => metric.status === "degraded")
      ? "degraded"
      : metrics.every((metric) => metric.status === "unavailable")
        ? "unavailable"
        : "healthy";
  return Object.freeze({ status, metrics: Object.freeze(metrics), evaluatedAt });
}

export function validateCommerceCatalog(input: {
  products: readonly CommerceProduct[];
  offers: readonly CommerceOffer[];
  prices: readonly CommercePrice[];
  entitlementTemplates: readonly EntitlementTemplate[];
  fulfillmentTemplates: readonly FulfillmentTemplate[];
  evaluatedAt?: Date;
}): CatalogHealth {
  const issues: CatalogValidationIssue[] = [];
  const productIds = new Set(input.products.map((value) => value.id));
  const prices = new Map(input.prices.map((value) => [value.id, value]));
  const entitlements = new Set(input.entitlementTemplates.map((value) => value.id));
  const fulfillment = new Set(input.fulfillmentTemplates.map((value) => value.id));

  for (const product of input.products.filter((value) => value.status === "active")) {
    if (!product.providerReferences.stripeProductId) {
      issues.push(issue("missing-stripe-product", "high", "product", product.id, "Active product has no Stripe Product mapping."));
    }
    if (!input.prices.some((price) => price.productId === product.id && price.status === "active")) {
      issues.push(issue("missing-active-price", "critical", "product", product.id, "Active product has no active price."));
    }
    for (const templateId of product.entitlementTemplateIds) {
      if (!entitlements.has(templateId)) {
        issues.push(issue("missing-entitlement", "high", "product", product.id, `Entitlement template ${templateId} is unavailable.`));
      }
    }
    if (product.fulfillmentType !== "no-fulfillment" &&
      (!product.fulfillmentTemplateId || !fulfillment.has(product.fulfillmentTemplateId))) {
      issues.push(issue("missing-fulfillment", "critical", "product", product.id, "Active product has no valid fulfillment template."));
    }
  }
  for (const price of input.prices.filter((value) => value.status === "active")) {
    if (!productIds.has(price.productId)) {
      issues.push(issue("missing-product", "critical", "price", price.id, "Price references an unavailable product."));
    }
    if (price.type !== "free" && price.type !== "custom-quote" && !price.providerReferences.stripePriceId) {
      issues.push(issue("missing-stripe-price", "critical", "price", price.id, "Active payable price has no Stripe Price mapping."));
    }
  }
  for (const offer of input.offers.filter((value) => value.status === "active")) {
    if (offer.productIds.some((id) => !productIds.has(id)) || offer.priceIds.some((id) => !prices.has(id))) {
      issues.push(issue("invalid-offer-mapping", "critical", "offer", offer.id, "Offer references an unavailable product or price."));
    }
  }
  const status: CommerceHealthStatus = issues.some((value) => value.severity === "critical")
    ? "critical"
    : issues.length ? "degraded" : "healthy";
  return Object.freeze({ status, issues: Object.freeze(issues), evaluatedAt: input.evaluatedAt ?? new Date() });
}

export function validatePersistedCommerceCatalog(input: {
  products: readonly Readonly<{ id: string; status: string; stripeProductId?: string | null; fulfillmentType: string; fulfillmentTemplateId?: string | null; entitlementTemplateIds: readonly string[] }>[];
  offers: readonly Readonly<{ id: string; status: string; productIds: readonly string[]; priceIds: readonly string[] }>[];
  prices: readonly Readonly<{ id: string; productId: string; status: string; priceType: string; stripePriceId?: string | null }>[];
  entitlementTemplateIds: readonly string[];
  fulfillmentTemplateIds: readonly string[];
  evaluatedAt?: Date;
}): CatalogHealth {
  const productIds = new Set(input.products.map((item) => item.id));
  const priceIds = new Set(input.prices.map((item) => item.id));
  const entitlements = new Set(input.entitlementTemplateIds);
  const fulfillments = new Set(input.fulfillmentTemplateIds);
  const issues: CatalogValidationIssue[] = [];
  for (const product of input.products.filter((item) => item.status === "active")) {
    if (!product.stripeProductId) issues.push(issue("missing-stripe-product", "high", "product", product.id, "Active product has no Stripe Product mapping."));
    if (!input.prices.some((price) => price.productId === product.id && price.status === "active")) issues.push(issue("missing-active-price", "critical", "product", product.id, "Active product has no active price."));
    if (product.entitlementTemplateIds.some((id) => !entitlements.has(id))) issues.push(issue("missing-entitlement", "high", "product", product.id, "One or more entitlement mappings are unavailable."));
    if (product.fulfillmentType !== "no-fulfillment" && (!product.fulfillmentTemplateId || !fulfillments.has(product.fulfillmentTemplateId))) issues.push(issue("missing-fulfillment", "critical", "product", product.id, "Active product has no valid fulfillment mapping."));
  }
  for (const price of input.prices.filter((item) => item.status === "active")) {
    if (!productIds.has(price.productId)) issues.push(issue("missing-product", "critical", "price", price.id, "Price references an unavailable product."));
    if (!["free", "custom-quote"].includes(price.priceType) && !price.stripePriceId) issues.push(issue("missing-stripe-price", "critical", "price", price.id, "Active payable price has no Stripe Price mapping."));
  }
  for (const offer of input.offers.filter((item) => item.status === "active")) {
    if (offer.productIds.some((id) => !productIds.has(id)) || offer.priceIds.some((id) => !priceIds.has(id))) issues.push(issue("invalid-offer-mapping", "critical", "offer", offer.id, "Offer references an unavailable product or price."));
  }
  const status: CommerceHealthStatus = issues.some((item) => item.severity === "critical") ? "critical" : issues.length ? "degraded" : "healthy";
  return Object.freeze({ status, issues: Object.freeze(issues), evaluatedAt: input.evaluatedAt ?? new Date() });
}

export function validateCommerceProductionConfiguration(
  env: Record<string, string | undefined>,
): readonly ProductionConfigurationCheck[] {
  const production = env.NODE_ENV === "production";
  const secret = env.STRIPE_SECRET_KEY?.trim();
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const webhook = env.STRIPE_WEBHOOK_SECRET?.trim();
  const checks: ProductionConfigurationCheck[] = [
    check("stripe-key", Boolean(secret && (!production || /^rk_live_/.test(secret))), production
      ? "Production uses a live restricted Stripe API key."
      : "A Stripe API key is configured for this environment.", secret?.startsWith("sk_") ? "warning" : "fail"),
    check("publishable-key", Boolean(publishable && (!production || /^pk_live_/.test(publishable))), "Publishable key matches the release environment."),
    check("webhook-secret", Boolean(webhook?.startsWith("whsec_")), "Webhook signing secret is configured."),
    check("portal", Boolean(env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim()), "Billing Portal configuration is explicit."),
    check("site-url", Boolean(env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")), "Canonical HTTPS return URL is configured."),
    check("environment", !production || env.STRIPE_ENVIRONMENT !== "test", "Test and live Commerce environments are isolated."),
  ];
  return Object.freeze(checks);
}

function issue(code: string, severity: CommerceDriftSeverity, subjectType: CatalogValidationIssue["subjectType"], subjectId: string, message: string): CatalogValidationIssue {
  return Object.freeze({ code, severity, subjectType, subjectId, message });
}

function check(key: string, passed: boolean, explanation: string, failed: "fail" | "warning" = "fail"): ProductionConfigurationCheck {
  return Object.freeze({ key, status: passed ? "pass" : failed, explanation });
}

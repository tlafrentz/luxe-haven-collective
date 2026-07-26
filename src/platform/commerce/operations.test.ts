import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import {
  createCommercePrice,
  createCommerceProduct,
  evaluateCommerceHealth,
  validateCommerceCatalog,
  validateCommerceProductionConfiguration,
} from "./index";

const now = new Date("2026-07-25T12:00:00Z");

describe("Commerce operations", () => {
  it("classifies operational failure rates without treating missing activity as healthy", () => {
    const health = evaluateCommerceHealth({
      checkouts: {},
      orders: {},
      payments: { succeeded: 90, failed: 10 },
      subscriptions: { active: 8, "past-due": 3 },
      webhooks: { processed: 100, failed: 0 },
      fulfillments: { completed: 10, failed: 0 },
    }, now);
    expect(health.status).toBe("critical");
    expect(health.metrics.find((metric) => metric.key === "checkout-success")?.status).toBe("unavailable");
  });

  it("detects unsafe active catalog mappings", () => {
    const product = createCommerceProduct({
      id: "product", slug: "product", name: "Product", shortDescription: "Short", longDescription: "Long",
      categoryId: "category", type: "digital-product", fulfillmentType: "digital-download", status: "active",
      entitlementTemplateIds: ["missing"], fulfillmentTemplateId: "missing", createdAt: now, updatedAt: now,
    });
    const price = createCommercePrice({
      id: "price", productId: product.id, type: "one-time", amount: Money.usd(10),
      status: "active", createdAt: now,
    });
    const health = validateCommerceCatalog({ products: [product], offers: [], prices: [price], entitlementTemplates: [], fulfillmentTemplates: [], evaluatedAt: now });
    expect(health.status).toBe("critical");
    expect(health.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      "missing-stripe-product", "missing-stripe-price", "missing-entitlement", "missing-fulfillment",
    ]));
  });

  it("requires production-only live restricted credentials", () => {
    const checks = validateCommerceProductionConfiguration({
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_secret",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_public",
      STRIPE_WEBHOOK_SECRET: "whsec_secret",
      STRIPE_BILLING_PORTAL_CONFIGURATION_ID: "bpc_1",
      NEXT_PUBLIC_SITE_URL: "https://luxehavenco.com",
    });
    expect(checks.find((item) => item.key === "stripe-key")?.status).toBe("warning");
    expect(checks.filter((item) => item.status === "fail")).toHaveLength(0);
  });
});

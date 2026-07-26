import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getStripeCommerceConfig,
  getStripeWebhookConfig,
  resolveStripeCommerceEnvironment,
} from "./config";

describe("Stripe Commerce configuration", () => {
  describe("resolveStripeCommerceEnvironment", () => {
    it("uses test mode for local development", () => {
      expect(
        resolveStripeCommerceEnvironment({
          NODE_ENV: "development",
        }),
      ).toBe("test");
    });

    it("uses test mode for Vercel Preview even when NODE_ENV is production", () => {
      expect(
        resolveStripeCommerceEnvironment({
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
        }),
      ).toBe("test");
    });

    it("uses live mode for Vercel Production", () => {
      expect(
        resolveStripeCommerceEnvironment({
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        }),
      ).toBe("live");
    });

    it("allows an explicit test environment", () => {
      expect(
        resolveStripeCommerceEnvironment({
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          STRIPE_ENVIRONMENT: "test",
        }),
      ).toBe("test");
    });

    it("allows an explicit live environment", () => {
      expect(
        resolveStripeCommerceEnvironment({
          NODE_ENV: "development",
          STRIPE_ENVIRONMENT: "live",
        }),
      ).toBe("live");
    });
  });

  describe("getStripeCommerceConfig", () => {
    it("accepts test credentials in Preview", () => {
      expect(
        getStripeCommerceConfig({
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
          STRIPE_SECRET_KEY: "rk_test_example",
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example",
        }),
      ).toMatchObject({
        environment: "test",
        apiKey: "rk_test_example",
        publishableKey: "pk_test_example",
      });
    });

    it("accepts live credentials in Production", () => {
      expect(
        getStripeCommerceConfig({
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          STRIPE_SECRET_KEY: "rk_live_example",
        }),
      ).toMatchObject({
        environment: "live",
        apiKey: "rk_live_example",
      });
    });

    it("rejects live credentials in Preview", () => {
      expect(() =>
        getStripeCommerceConfig({
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
          STRIPE_SECRET_KEY: "rk_live_example",
        }),
      ).toThrow(
        "Stripe live credentials cannot run in the test Commerce environment.",
      );
    });

    it("rejects test credentials in Production", () => {
      expect(() =>
        getStripeCommerceConfig({
          NODE_ENV: "production",
          VERCEL_ENV: "production",
          STRIPE_SECRET_KEY: "rk_test_example",
        }),
      ).toThrow(
        "Stripe test credentials cannot run in the live Commerce environment.",
      );
    });

    it("requires a supported Stripe credential", () => {
      expect(() =>
        getStripeCommerceConfig({
          NODE_ENV: "test",
          STRIPE_SECRET_KEY: "invalid",
        }),
      ).toThrow(
        "STRIPE_SECRET_KEY has an unsupported environment prefix.",
      );
    });
  });

  describe("getStripeWebhookConfig", () => {
    it("uses the same environment resolver as Checkout", () => {
      expect(
        getStripeWebhookConfig({
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
          STRIPE_WEBHOOK_SECRET: "whsec_example",
        }),
      ).toEqual({
        secret: "whsec_example",
        environment: "test",
      });
    });

    it("requires a Stripe webhook signing secret", () => {
      expect(() =>
        getStripeWebhookConfig({
          NODE_ENV: "test",
          STRIPE_WEBHOOK_SECRET: "invalid",
        }),
      ).toThrow("STRIPE_WEBHOOK_SECRET is required.");
    });
  });
});

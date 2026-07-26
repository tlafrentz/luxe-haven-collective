import type { CommerceEnvironment } from "../../application";

export type StripeCommerceConfig = Readonly<{
  apiKey: string;
  publishableKey?: string;
  environment: CommerceEnvironment;
  apiVersion: "2026-06-24.dahlia";
}>;

export function resolveStripeCommerceEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): CommerceEnvironment {
  const explicitEnvironment = env.STRIPE_ENVIRONMENT?.trim();

  if (
    explicitEnvironment === "live" ||
    explicitEnvironment === "test"
  ) {
    return explicitEnvironment;
  }

  if (env.VERCEL_ENV === "production") {
    return "live";
  }

  return "test";
}

export function getStripeCommerceConfig(
  env: NodeJS.ProcessEnv = process.env,
): StripeCommerceConfig {
  const apiKey = env.STRIPE_SECRET_KEY?.trim();

  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  const credentialEnvironment = apiKey.startsWith("sk_live_") ||
    apiKey.startsWith("rk_live_")
    ? "live"
    : apiKey.startsWith("sk_test_") ||
        apiKey.startsWith("rk_test_")
      ? "test"
      : null;

  if (!credentialEnvironment) {
    throw new Error(
      "STRIPE_SECRET_KEY has an unsupported environment prefix.",
    );
  }

  const expectedEnvironment = resolveStripeCommerceEnvironment(env);

  if (credentialEnvironment !== expectedEnvironment) {
    throw new Error(
      `Stripe ${credentialEnvironment} credentials cannot run in the ${expectedEnvironment} Commerce environment.`,
    );
  }

  const publishableKey =
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  return Object.freeze({
    apiKey,
    ...(publishableKey ? { publishableKey } : {}),
    environment: credentialEnvironment,
    apiVersion: "2026-06-24.dahlia",
  });
}

export function getStripeWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<{
  secret: string;
  environment: CommerceEnvironment;
}> {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required.");
  }

  return Object.freeze({
    secret,
    environment: resolveStripeCommerceEnvironment(env),
  });
}

export const INTEGRATION_IDS = [
  "hospitable",
  "realty_api",
  "rentcast",
  "airroi",
  "stripe",
  "supabase",
  "vercel",
  "resend",
] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];
export type IntegrationCategory =
  | "Channel / PMS"
  | "Property Intelligence"
  | "Market Intelligence"
  | "Commerce"
  | "Platform Infrastructure"
  | "Communications";
export type ConfigurationStatus = "configured" | "not_configured" | "invalid" | "disabled" | "unknown";
export type RuntimeStatus = "operational" | "degraded" | "unavailable" | "unknown";
export type ManagementMode = "workspace" | "platform" | "environment";

export type ConfigurationRequirement = Readonly<{
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
}>;

export type IntegrationDefinition = Readonly<{
  id: IntegrationId;
  adapterIds: readonly string[];
  displayName: string;
  category: IntegrationCategory;
  description: string;
  capabilities: readonly string[];
  dependentWorkflows: readonly string[];
  configurationRequirements: readonly ConfigurationRequirement[];
  supportsManualSync: boolean;
  supportsConnectionTest: boolean;
  supportsWebhooks: boolean;
  supportsHealthChecks: boolean;
  managementMode: ManagementMode;
  documentationUrl?: string;
  managementUrl?: string;
}>;

const requirement = (key: string, label: string, required = true, secret = true): ConfigurationRequirement =>
  Object.freeze({ key, label, required, secret });

export const INTEGRATION_REGISTRY: readonly IntegrationDefinition[] = Object.freeze([
  {
    id: "hospitable", adapterIds: ["hospitable"], displayName: "Hospitable", category: "Channel / PMS",
    description: "Property, reservation, guest, and messaging synchronization.",
    capabilities: ["Properties", "Reservations", "Guests", "Messages", "Webhooks"],
    dependentWorkflows: ["Operations workspace", "Guest communications", "Booking context"],
    configurationRequirements: [requirement("HOSPITABLE_API_TOKEN", "API token"), requirement("HOSPITABLE_WEBHOOK_SECRET", "Webhook signing secret", false), requirement("HOSPITABLE_SYNC_SECRET", "Scheduled sync secret", false)],
    supportsManualSync: true, supportsConnectionTest: true, supportsWebhooks: true, supportsHealthChecks: true,
    managementMode: "platform", documentationUrl: "https://developer.hospitable.com/", managementUrl: "https://my.hospitable.com/",
  },
  {
    id: "realty_api", adapterIds: ["realtyapi"], displayName: "RealtyAPI", category: "Property Intelligence",
    description: "Subject-property lookup and canonical property intelligence.",
    capabilities: ["Property search", "Property details", "Subject resolution"],
    dependentWorkflows: ["Investment workspace", "Property snapshots"],
    configurationRequirements: [requirement("REALTY_API_KEY", "API key")],
    supportsManualSync: false, supportsConnectionTest: true, supportsWebhooks: false, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://realtyapi.io/",
  },
  {
    id: "rentcast", adapterIds: ["rentcast"], displayName: "RentCast", category: "Property Intelligence",
    description: "Property resolution, valuation, rent estimates, and comparable intelligence.",
    capabilities: ["Property search", "Sale estimates", "Rent estimates", "Comparables"],
    dependentWorkflows: ["Investment analysis", "Market diagnostics"],
    configurationRequirements: [requirement("RENTCAST_API_KEY", "API key")],
    supportsManualSync: false, supportsConnectionTest: true, supportsWebhooks: false, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://developers.rentcast.io/",
  },
  {
    id: "airroi", adapterIds: ["airroi"], displayName: "AirROI", category: "Market Intelligence",
    description: "Short-term-rental market and comparable intelligence.",
    capabilities: ["STR market snapshots", "Revenue projections", "Comparable listings"],
    dependentWorkflows: ["Investment workspace", "STR market snapshots"],
    configurationRequirements: [requirement("AIRROI_API_KEY", "API key")],
    supportsManualSync: false, supportsConnectionTest: true, supportsWebhooks: false, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://www.airroi.com/",
  },
  {
    id: "stripe", adapterIds: ["stripe"], displayName: "Stripe", category: "Commerce",
    description: "Checkout, payments, subscriptions, invoices, and verified webhooks.",
    capabilities: ["Checkout", "Payments", "Subscriptions", "Invoices", "Webhooks"],
    dependentWorkflows: ["Commerce", "Billing", "Fulfillment"],
    configurationRequirements: [requirement("STRIPE_SECRET_KEY", "Restricted API key"), requirement("STRIPE_WEBHOOK_SECRET", "Webhook signing secret")],
    supportsManualSync: false, supportsConnectionTest: true, supportsWebhooks: true, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://docs.stripe.com/", managementUrl: "https://dashboard.stripe.com/",
  },
  {
    id: "supabase", adapterIds: ["supabase"], displayName: "Supabase", category: "Platform Infrastructure",
    description: "PostgreSQL persistence, authentication, row-level security, and storage.",
    capabilities: ["Database", "Authentication", "Row-level security", "Storage"],
    dependentWorkflows: ["All persisted application workflows"],
    configurationRequirements: [requirement("NEXT_PUBLIC_SUPABASE_URL", "Project URL", true, false), requirement("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Anonymous client key"), requirement("SUPABASE_SERVICE_ROLE_KEY", "Service role key")],
    supportsManualSync: false, supportsConnectionTest: true, supportsWebhooks: false, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://supabase.com/docs", managementUrl: "https://supabase.com/dashboard",
  },
  {
    id: "vercel", adapterIds: ["vercel"], displayName: "Vercel", category: "Platform Infrastructure",
    description: "Application hosting, deployment, and runtime environment.",
    capabilities: ["Hosting", "Deployments", "Server runtime"],
    dependentWorkflows: ["Application delivery"], configurationRequirements: [],
    supportsManualSync: false, supportsConnectionTest: false, supportsWebhooks: false, supportsHealthChecks: false,
    managementMode: "environment", documentationUrl: "https://vercel.com/docs", managementUrl: "https://vercel.com/dashboard",
  },
  {
    id: "resend", adapterIds: ["resend"], displayName: "Resend", category: "Communications",
    description: "Transactional email delivery for contact, access, and notification workflows.",
    capabilities: ["Transactional email"], dependentWorkflows: ["Contact inquiries", "Workspace invitations", "Notifications"],
    configurationRequirements: [requirement("RESEND_API_KEY", "API key"), requirement("RESEND_FROM_EMAIL", "Verified sender", true, false)],
    supportsManualSync: false, supportsConnectionTest: false, supportsWebhooks: false, supportsHealthChecks: true,
    managementMode: "environment", documentationUrl: "https://resend.com/docs", managementUrl: "https://resend.com/emails",
  },
]);

export function getIntegrationDefinition(id: IntegrationId): IntegrationDefinition {
  const definition = INTEGRATION_REGISTRY.find((candidate) => candidate.id === id);
  if (!definition) throw new RangeError(`Unregistered integration: ${id}`);
  return definition;
}

export function configurationStatus(definition: IntegrationDefinition, env: Readonly<Record<string,string|undefined>> = process.env): ConfigurationStatus {
  if (definition.id === "vercel") return env.VERCEL ? "configured" : env.NODE_ENV === "development" ? "disabled" : "unknown";
  if ((definition.id === "rentcast" || definition.id === "realty_api") && env.MARKET_PROVIDER_ENABLED === "false") return "disabled";
  const required = definition.configurationRequirements.filter((item) => item.required);
  if (!required.length) return "unknown";
  const values = required.map((item) => env[item.key]?.trim());
  if (values.every(Boolean)) return "configured";
  return values.some(Boolean) ? "invalid" : "not_configured";
}

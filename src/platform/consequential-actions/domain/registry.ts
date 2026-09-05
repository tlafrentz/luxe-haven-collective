export type ConsequentialActionModule =
  | "commerce"
  | "financials"
  | "furnishing"
  | "revenue"
  | "notifications";

export type ConsequentialExternalEffect =
  | "live_purchase"
  | "charge"
  | "refund"
  | "provider_disconnection"
  | "rate_publication"
  | "bulk_email";

export type ConsequentialActionAtomicBoundaryStatus = Readonly<{
  reauthorizesBeforeCall: boolean;
  bindsIdempotencyKey: boolean;
  recordsIntentBeforeCall: boolean;
  reconcilesProviderResult: boolean;
  hasLiveKillSwitch: boolean;
}>;

export type ConsequentialActionDefinition = Readonly<{
  code: string;
  module: ConsequentialActionModule;
  externalEffect: ConsequentialExternalEffect;
  description: string;
  /**
   * A PA-001 privilege identifier (module.resource.action), where one
   * already exists for this action. Typed as a plain string rather than
   * platform-access's `PrivilegeId` union: `src/platform/` code is
   * architecturally forbidden from importing anything from `src/features/*`
   * (enforced by `src/platform/platform-compliance.test.ts` with no
   * exception mechanism), matching the same fallback AUTH-012 already
   * established for `PlatformActionSource.requiredPrivilege`.
   */
  relatedPrivilegeId?: string;
  /** Whether this action reaches a genuine external effect today. */
  implementationStatus: "live" | "not_yet_implemented";
  atomicBoundary: ConsequentialActionAtomicBoundaryStatus;
  /** Where the implementation (or its documented absence) lives, for reference. */
  sourceFiles: readonly string[];
}>;

function action(
  input: Omit<ConsequentialActionDefinition, "atomicBoundary"> &
    Readonly<{ atomicBoundary: Partial<ConsequentialActionAtomicBoundaryStatus> }>,
): ConsequentialActionDefinition {
  return Object.freeze({
    ...input,
    atomicBoundary: Object.freeze({
      reauthorizesBeforeCall: false,
      bindsIdempotencyKey: false,
      recordsIntentBeforeCall: false,
      reconcilesProviderResult: false,
      hasLiveKillSwitch: false,
      ...input.atomicBoundary,
    }),
  });
}

/**
 * SEP-004: a short, explicit registry of external effects requiring an
 * emergency boundary. This is a catalog, not a database table -- nothing in
 * the codebase consumes it yet (ships unused, matching PA-001's own
 * `PRIVILEGE_IDS` before PA-002 wired it in). Deliberately does not reuse
 * `privilege_definitions.sensitivity` ("critical"): that field is 3-4x
 * broader than this list and mixes "needs an elevated role" with "has an
 * irreversible external effect" -- reusing it directly would violate
 * SEP-004's own acceptance criterion that internal drafting, reviewing,
 * approvals, calculations, and tracking must NOT be placed behind an
 * emergency switch.
 *
 * `atomicBoundary` records which of SEP-005's four elements (reauthorize
 * immediately before the request, bind an idempotency key, record intent,
 * reconcile the provider result) each action actually has today, plus
 * whether a live (togglable) kill switch exists. As of this registry's
 * creation, no action has a complete cycle -- see each entry's
 * `sourceFiles` for the code this was verified against.
 */
export const CONSEQUENTIAL_ACTION_REGISTRY = Object.freeze({
  STRIPE_PURCHASE: action({
    code: "STRIPE_PURCHASE",
    module: "commerce",
    externalEffect: "live_purchase",
    description:
      "Purchase a paid product or service (e.g. a furnishing service package) via Stripe Checkout.",
    implementationStatus: "live",
    atomicBoundary: {
      bindsIdempotencyKey: true,
      recordsIntentBeforeCall: true,
      reconcilesProviderResult: true,
    },
    sourceFiles: [
      "src/platform/commerce/application/furnishing-checkout.ts",
      "src/platform/commerce/application/ca001b-checkout.ts",
      "src/platform/commerce/infrastructure/stripe/stripe-commerce-provider.ts",
      "supabase/migrations/20260725235900_commerce_payments_webhooks.sql",
    ],
  }),
  STRIPE_REFUND: action({
    code: "STRIPE_REFUND",
    module: "commerce",
    externalEffect: "refund",
    description: "Issue a refund for a completed Stripe purchase.",
    implementationStatus: "live",
    atomicBoundary: {
      bindsIdempotencyKey: true,
      recordsIntentBeforeCall: true,
      reconcilesProviderResult: true,
    },
    sourceFiles: [
      "src/platform/commerce/application/admin-furnishing-operations.ts",
      "src/platform/commerce/infrastructure/stripe/stripe-commerce-provider.ts",
    ],
  }),
  PLAID_PROVIDER_DISCONNECT: action({
    code: "PLAID_PROVIDER_DISCONNECT",
    module: "financials",
    externalEffect: "provider_disconnection",
    description:
      "Disconnect a customer's linked Plaid bank connection. The internal " +
      "'disconnected' state is written before the external Plaid call, but " +
      "the action reports success regardless of whether that call actually " +
      "succeeds -- there is no reconciliation of the provider's response.",
    relatedPrivilegeId: "financials.connection.manage_connections",
    implementationStatus: "live",
    atomicBoundary: {
      recordsIntentBeforeCall: true,
    },
    sourceFiles: ["src/app/actions/plaid-financial-ingestion.ts"],
  }),
  FURNISHING_PURCHASE_AUTHORIZATION: action({
    code: "FURNISHING_PURCHASE_AUTHORIZATION",
    module: "furnishing",
    externalEffect: "live_purchase",
    description:
      "Authorize a furnishing procurement purchase batch. Today this only " +
      "calls internal Postgres RPCs (create/approve/record bookkeeping) -- " +
      "no outbound call to a retailer or payment provider is made yet, so " +
      "there is no real external effect to protect.",
    relatedPrivilegeId: "furnishing.procurement.purchase_authorize",
    implementationStatus: "not_yet_implemented",
    atomicBoundary: {
      bindsIdempotencyKey: true,
    },
    sourceFiles: [
      "src/app/actions/furnishing-procurement.ts",
      "src/features/furnishing-studio/server-command-context.ts",
    ],
  }),
  REVENUE_RATE_PUBLICATION: action({
    code: "REVENUE_RATE_PUBLICATION",
    module: "revenue",
    externalEffect: "rate_publication",
    description:
      "Publish pricing/rate changes to external distribution channels " +
      "(OTAs, channel managers). No application code exists for this yet " +
      "-- only the PA-001 privilege has been seeded.",
    relatedPrivilegeId: "revenue.rates.publish_rates",
    implementationStatus: "not_yet_implemented",
    atomicBoundary: {},
    sourceFiles: [
      "supabase/migrations/20260903030000_pa001_platform_access_foundation.sql",
    ],
  }),
  BULK_EMAIL_DIGEST: action({
    code: "BULK_EMAIL_DIGEST",
    module: "notifications",
    externalEffect: "bulk_email",
    description:
      "Send scheduled/batched notification digest emails to workspace members.",
    implementationStatus: "live",
    atomicBoundary: {
      bindsIdempotencyKey: true,
      recordsIntentBeforeCall: true,
      reconcilesProviderResult: true,
    },
    sourceFiles: [
      "src/lib/notifications/digest-worker.ts",
      "src/lib/email/send.ts",
      "supabase/migrations/20260828030000_ps002_notification_digests.sql",
    ],
  }),
} as const);

export type ConsequentialActionCode = keyof typeof CONSEQUENTIAL_ACTION_REGISTRY;

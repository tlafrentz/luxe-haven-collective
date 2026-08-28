# FS-008B Commercial Baseline Audit

Status: read-only baseline; implementation is not authorized until this package is reviewed.
Date: 2026-08-25

## Reused foundations

- FS-008A `resolveFurnishingActivation` and its global/workspace/cohort/capability hierarchy remain the only activation policy.
- CA-001 OC-001 purchase intent, checkout, payment-event, entitlement, idempotency, webhook, retry, and reconciliation boundaries are the commerce source of truth.
- Stripe provider configuration is read by `getStripeCommerceConfig`; provider secrets remain server-only.
- Existing tenant membership, authenticated server client, RLS, telemetry, and immutable audit controls remain authoritative.
- FS-008C–G remain disabled. No Production state or commercial record was changed by this audit.

## Approved offer matrix

The approved OC-001 matrix defines the following Furnishing candidates:

| Offer | State in approved matrix | Price | Entitlement / handoff |
|---|---|---:|---|
| `FS-CONSULT` | Yes | $249 one-time | consultation service; FS-008C pending handoff |
| `FS-DESIGN` | Yes | $1,495 one-time | design-plan service; FS-008C pending handoff |
| `FS-DESIGN-ROOM` | Add-on | $250 per approved room | configuration-dependent; not independently purchasable |
| `FS-DESIGN-REVISION` | Add-on | $150 | configuration-dependent; not independently purchasable |
| `FS-FULL` | Deferred | Custom | no price, provider mapping, or purchase action |

The matrix requires immutable commercial versions, currency, inclusions/exclusions, eligibility, cancellation/refund policy, and trusted provider references before activation. Existing `default-catalog.ts` contains legacy Furnishing products and prices, but this audit does not treat those records as approved FS-008B offers until their OC-001 mapping and provider references are reconciled.

## Boundary inventory

| Boundary | Existing implementation | Read-only state | FS-008B dependency | Evidence / gap |
|---|---|---|---|---|
| Marketing offer presentation | `src/app/(marketing)/furnishing/**`, `src/app/(commerce)/furnishing/purchase/**` | Present, activation-gated | Offer discovery | `FS008B-F01`: approved offer/version mapping not yet proven |
| Checkout initiation | `src/app/actions/commerce-checkout.ts`, OC-001 `create_oc001_purchase_intent` / `attach_oc001_checkout` | Present and idempotent | Checkout capability + eligibility | `FS008B-F02`: Furnishing-specific activation re-evaluation and trusted offer binding require focused proof |
| Provider checkout | `StripeCommerceProvider` and `getStripeCommerceConfig` | Present | Trusted Stripe price/environment | Configuration names only; no values recorded |
| Payment confirmation | CA-001 payment/webhook boundaries under `src/platform/commerce/application` and Stripe infrastructure | Present | Signature, amount, currency, event/account verification | `FS008B-F03`: Furnishing event-to-entitlement matrix and replay proof required |
| Entitlement activation | `src/platform/commerce/application/entitlements.ts`, CA-001 RPC lifecycle | Present | Exactly-once Furnishing grant | `FS008B-F04`: no project creation and exact Furnishing product-family binding must be proven |
| Purchase confirmation | checkout success pages and `getCheckoutResult` | Present | Server-confirmed status and pending state | `FS008B-F05`: coherent FS-008C pending handoff needs explicit coverage |
| Refund/cancellation | CA-001 billing/payment/recovery paths | Present | Approved one-time service policy | `FS008B-F06`: Furnishing refund/revocation mapping requires focused evidence |
| Admin commercial projection | `/admin/commerce/**`, `/admin/furnishing/**` | Present | Purchase/payment/entitlement lineage | `FS008B-F07`: Furnishing projection and controlled reconciliation actions require proof |

## Required FS-008A capability changes

FS-008B may enable only Furnishing offer discovery, checkout, entitlement activation, purchase confirmation, and Admin commercial projection for an explicitly approved internal cohort. Project creation, onboarding activation, catalog, notifications, installation, procurement, and retailer ordering remain disabled. The safe-state hierarchy remains authoritative above offer state.

## Payment and configuration inventory

The Stripe integration is server-side and environment-aware. Configuration is inspected by variable name only; values are not included in this document or telemetry. Required follow-up is to verify Production presence and test/live account parity without exposing secrets, then bind approved offer versions to trusted provider product/price references.

## Baseline findings

The seven findings above are documentation-only baseline gaps, not Production defects. They must be resolved or dispositioned during Phase 2 before any cohort or checkout capability is enabled. No code, migration, payment, entitlement, project, notification, catalog, installation, procurement, or retailer mutation occurred during this audit.

## Recommendation

Proceed to a bounded Phase 2 implementation only after the baseline is reviewed. Reuse CA-001 and FS-008A; do not introduce a parallel Furnishing payment or entitlement system. Keep the internal cohort and all commercial effects disabled until the exact candidate passes the FS-008B gates.

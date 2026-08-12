# CA-001B — Checkout and Subscription Activation Completion

Status: local foundation implemented; commercial approval and production verification blocked.

- Final implementation commit: pending review and commit
- Production deployment: not performed
- Stripe API version: `2026-06-24.dahlia`
- Supported billing models: one-time payment and fixed recurring monthly/annual Checkout; usage, promotions, trials, installments, marketplace payments, and automatic tax are disabled
- Active mappings: none — CA-001A offers remain unapproved drafts, so no Stripe price identifiers were invented
- Database migration: `20260811060000_ca001b_checkout_subscription_activation.sql`
- Webhook endpoint: `/api/webhooks/stripe`; verified raw-body ingress covers Checkout completion/expiration, subscription creation/update/deletion, invoices, Payment Intents, refunds, and disputes through registered normalization and lifecycle boundaries
- Subscription policy: initial paid invoice required before recurring entitlement activation; scheduled cancellation retains paid-period access; final cancellation/expiry affects only the agreement source
- Failed-payment policy: seven-day grace, retain access on first failure, suspend at grace expiry, restore automatically after verified payment
- Cancellation policy: server-resolved agreement only; period-end retention; no resource deletion
- One-time policies: must come from the immutable CA-001A offer version; a one-time charge never implies unlimited lifetime access
- Entitlement integration: verified commercial events invoke the CA-001A activation port idempotently by agreement source; Stripe metadata never defines grants
- Reconciliation: provider-neutral, authorized, idempotent repair boundary added; no charge-creation capability
- Guidebook-only verification: checkout selection has no HPM prerequisite and entitlement contents remain sourced exclusively from `guidebook.standalone`; production transaction not run
- Authorization/RLS: tenant customer-account authorization at checkout and portal boundaries; RLS on all new tables; anonymous access and browser mutation denied
- Test results: `npm test` — 685 files/3,726 tests passed; `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed
- Controlled production verification: not run; requires approved active offers, controlled identities, test/live Stripe mappings, endpoint configuration, and business authorization
- Known limitations: no approved price mappings, no production migration, no live payment method, and no deployed reconciliation scheduler
- Deferred: CA-001C onboarding workspace, usage billing, promotions, tax, proposal workflow, generalized billing, and self-service plan-change UX
- Working tree: uncommitted implementation changes pending review

The existing repository already contained legacy Checkout, webhook, subscription, invoice, portal, and fulfillment paths. CA-001B adds canonical CA-001A-linked contracts and removes promotion enablement, but broader self-service activation must remain disabled until approved active offers and exact mappings exist.

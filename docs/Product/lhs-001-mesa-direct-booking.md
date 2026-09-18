# LHS-001 v2.0: Mesa Direct Booking Request Pilot — Foundation Phase

Source requirements: `LHS-001 Mesa Direct Booking Request Pilot` (v2.0, 18 Sep 2026) and its UX storyboard — a controlled revision of commit `69485356` (the v1 foundation, merged and deployed). This document supersedes the v1 write-up: Hospitable Direct's paid widget/checkout/API dependency has been dropped and replaced with an assisted request-to-book flow gated by a human-verified calendar block and Stripe-hosted payment.

## Why the pivot

v1 built a guest-facing Hospitable Direct checkout, but that dependency was never actually configured (no live widget snippet, no checkout URL, no confirmed webhook contract) and requires a recurring paid plan upgrade to even access. v2.0 keeps everything else from v1 — `/stays`, `/stays/mesa`, the bookings projection, Action Center, exceptions, analytics foundation — and replaces only the guest checkout path: a guest submits a **request** (no payment), an operator manually verifies availability and **records a calendar block** as a server-enforced hard gate, and only a **verified Stripe webhook event** can atomically confirm a booking.

## What this phase builds

- **Guest flow**: `/stays/mesa/book` (real request form — dates, guests, contact, visit purpose, consent, then a provisional estimate before sending) → `/stays/mesa/checkout` (final terms + Stripe-hosted payment, reachable only once an operator has approved and blocked the dates) → `/stays/booking/return` and `/stays/booking/status` (a shared, durable guest-safe status page covering the full request lifecycle, not just pending/confirmed).
- **Data model** (`supabase/migrations/20260918100000_lhs001v2_request_to_book.sql`): `checkout_attempts` renamed and extended into `booking_requests` (LHS-MIG-002 — no data loss, every v1 row mapped forward); new `booking_request_guests` (PII kept separate — LHS-DAT-001), `request_quotes` (versioned), `request_reviews` (append-only operator decisions), `calendar_blocks` (the hard gate), `payment_invitations`, `booking_payment_events` (a dedicated Stripe webhook idempotency ledger for this domain).
- **The hard gate**: `createPaymentInvitation` (`src/app/actions/booking-requests.ts`) re-validates request status, quote acceptance/expiry, and calendar-block validity from scratch on every call — never trusts an earlier check. `confirm_booking_from_payment` (the Postgres function backing the webhook) re-checks the same gate again at confirmation time, inside a row-locked transaction, before ever inserting a `bookings` row. Modeled directly on `process_commerce_provider_event` (the existing SaaS commerce webhook's transaction), which was the closest existing precedent for "verify amount/currency/identity, lock the aggregate row, never regress a terminal state."
- **Stripe integration**: a dedicated webhook endpoint (`/api/webhooks/stripe/bookings`, its own signing secret) isolated from the existing SaaS commerce webhook's processing paths — reuses `verifyStripeWebhook`/`resolveStripeCommerceEnvironment`/`getStripeCommerceConfig` from `src/platform/commerce`'s public barrel (signature verification and API key/environment resolution are provider-shape utilities with no commerce-domain coupling), but a purpose-built `BookingStripeClient` and event normalizer for the booking checkout-session shape.
- **Operator UI**: `/admin/booking-requests` (pipeline list — needs review / awaiting payment / confirmed / overdue) and `/admin/booking-requests/[id]` (review checklist → approve/alternate/decline, then a calendar-block recording form once approved, plus quote/review/block/payment history).
- **Hospitable demotion** (LHS-HOS-002/003): the existing Hospitable reservation webhook and reconciliation code (v1) remain for channel-booking visibility (Airbnb/Vrbo still sync through it), but its coupling to the booking-request flow (`correlateCheckoutAttempt`) has been removed — it can no longer touch `booking_requests` or influence a direct-booking confirmation.
- **Analytics**: the funnel in `src/lib/analytics/track.ts` was replaced with the LHS-AN-001 request lifecycle (`request_started` → `request_submitted` → … → `payment_verified`/`booking_confirmed`), fired only from server-verified code paths for the payment/confirmation events.

## Environment variables

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENVIRONMENT`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Already configured in Vercel production (shared with the SaaS commerce integration) — no new setup needed for the Stripe account itself. |
| `STRIPE_BOOKING_WEBHOOK_SECRET` | **New, not yet configured.** Register a second Stripe webhook endpoint at `/api/webhooks/stripe/bookings` for `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, and set this to that endpoint's signing secret. |
| `NEXT_PUBLIC_SITE_URL` | Already configured — used to build Stripe success/cancel URLs. |
| `BOOKING_REQUEST_INTAKE_ENABLED` | Optional kill switch (LHS-MIG-004) — set to `"false"` to pause request intake without removing property content or history. |

`HOSPITABLE_DIRECT_WIDGET_EMBED_HTML`/`HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE` (v1) are retired — no longer read anywhere (LHS-HOS-001/LHS-DOD-003).

## Known limitations (not fixed in this pass)

- **Refunds**: no `createRefund` capability exists anywhere in this codebase yet (confirmed by research before building this phase) — refunds today happen manually in the Stripe dashboard and reconcile passively via the *commerce* webhook's `refund.updated` handling, which the booking domain does not currently share. A booking refund is out of scope for this pass; real scope for its own follow-up (LHS-CAN-002).
- **Notification templating**: guests get Action Center visibility and a live-polling status page, not templated transactional email (LHS-OPS-012 — deferred).
- **Alternate-date guest UX**: the data model and operator side are complete (propose → guest accepts/withdraws), but the guest-facing UI is minimal, not the storyboard's fully polished comparison view.
- **SLA defaults**: review SLA (24h) and quote validity (24h) are placeholder defaults, not the business's actual chosen values (PRD §13.2, still open).

## PRD §13.2 open decisions — not fabricated

Rate/quote model uses the `properties` table's already-configured `nightly_rate`/`cleaning_fee`/`tax_rate` (real data, not invented) — discount rules, proration, and rounding refinements remain open. Payment schedule (full vs. deposit), merchant of record/statement descriptor, Arizona/Mesa tax registration, cancellation/refund policy, rental agreement versions, block-evidence standard, review/release SLAs, and guest verification/deposit requirements are all still business/legal decisions requiring sign-off before production use — see [lhs-001-go-live-checklist.md](lhs-001-go-live-checklist.md).

## Explicitly out of scope for this phase

Instant booking or any real-time availability claim, a custom channel manager or automatic Hospitable writeback, refund initiation, full notification templating, and anything marketplace/independent-host related (out of the PRD's scope entirely — LHS-DOD-008 equivalent).

# LHS-001: Mesa Direct Booking Pilot — Foundation Phase

Source requirements: `LHS-001-Mesa-Direct-Booking-Pilot-Requirements-final.docx` (v1.1, 2026-09-17) and its UX storyboard. This document records what the **foundation phase** implements, what remains a config-driven placeholder pending a real Hospitable Direct account, and the open PRD §20 decisions currently using the PRD's own recommended defaults.

## What this phase builds

- **IA**: top-level nav renamed Properties → Stays (`src/components/shared/site-header.tsx`); Mesa's canonical route is `/stays/mesa` (slug renamed from `mesa-downtown-retreat`, with a permanent redirect from the old path).
- **Guest pages** (`src/app/(marketing)/stays/`): `/stays`, `/stays/[slug]`, `/stays/[slug]/book`, `/stays/[slug]/checkout`, `/stays/booking/return` — Airbnb-specific CTAs/imagery removed from all of them.
- **Data model** (`supabase/migrations/20260916120000_lhs001_direct_booking_foundation.sql`): `checkout_attempts`, `hospitable_reservation_events` (idempotency ledger), `booking_exceptions`. All service-role-write / admin-read only, matching the `admin_audit_events` convention.
- **Reservation webhook** (`src/app/api/webhooks/hospitable/reservations/route.ts`): treats the webhook body only as a "go re-check reservation X" trigger, always re-fetches the authoritative reservation from Hospitable's API before writing, and reuses the existing sync pipeline's `upsertBooking`.
- **Reconciliation**: a new cron (`/api/internal/hospitable-reconciliation`, every 6 hours) wraps the pre-existing `runHospitableReservationSync` pull-and-upsert pipeline — no new reconciliation logic was needed, since that pipeline was already one-directional (Hospitable → local).
- **Operator UI**: a "Manage in Hospitable" deep link on booking detail (`src/features/bookings`); Hospitable's webhook/exception counters on `/admin/integrations`; a new `/admin/booking-exceptions` queue; property-scoped exceptions also surface as Action Center tasks (`src/features/integrations/hospitable/lib/booking-exception-action.ts`).
- **Analytics**: `stay_property_viewed` / `stay_availability_interaction` / `stay_quote_shown` / `stay_checkout_launched` / `stay_booking_verified` / `stay_booking_cancelled` added to `src/lib/analytics/track.ts`. `stay_booking_verified` fires only from server-side verified code paths.

## What's still a placeholder

Hospitable Direct's guest-facing booking surface is a **per-property widget/checkout you configure from the Hospitable dashboard** (Direct Bookings → Website), not something buildable without that account. Until real values are supplied via environment configuration, the guest pages render an honest "not connected yet" state rather than a fabricated one:

| Env var | Purpose | Set when |
|---|---|---|
| `HOSPITABLE_DIRECT_WIDGET_EMBED_HTML` | The date/quote widget markup shown on `/stays/[slug]/book` | Copied from Hospitable dashboard |
| `HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE` | Hospitable-hosted checkout URL, with `{propertyId}`/`{returnUrl}` placeholders | Confirmed from Hospitable Direct account/API docs |
| `HOSPITABLE_RESERVATIONS_WEBHOOK_SECRET` | Bearer secret Hospitable sends on reservation webhook calls | Hospitable webhook subscription configured |
| `HOSPITABLE_DASHBOARD_RESERVATION_URL_TEMPLATE` | Deep link from booking detail into Hospitable's own reservation view, `{reservationId}` placeholder | Confirmed exact Hospitable dashboard URL format |

## Known limitations (not fixed in this pass)

- **Ack/processing coupling (LHS-INT-015)**: the reservation webhook processes synchronously in the request path rather than queuing, relying on Hospitable's own retry/backoff schedule for resilience. Fine for pilot volume; revisit before adding properties.
- **Attempt-to-reservation correlation (LHS-AN-002/003)**: Hospitable's checkout doesn't currently echo our `checkout_attempts.attempt_token` back on the reservation, so correlation is a best-effort match on property + exact dates (`correlateCheckoutAttempt` in the webhook, mirrored in `verifyCheckoutAttempt`). Prefer a real passthrough reference if Hospitable Direct supports one.
- **Event idempotency key**: without a confirmed distinct "event id" field in Hospitable's actual webhook payload, the fallback key is `eventType:reservationId:timestamp` (or coarser). This doesn't risk duplicate bookings — the `bookings` table's own `(external_provider, external_reservation_id)` unique constraint is what actually prevents that — but it can cause an occasional legitimate update to be treated as a duplicate. The 6-hour reconciliation cron is the backstop for that gap.

## PRD §20 open decisions — using recommended pilot defaults, pending legal review (LHS-SEC-008)

Cancellation policy, payment schedule, security deposit, guest verification level, tax registration/remittance, and Hospitable Direct plan/merchant-of-record are all real business and legal decisions the PRD explicitly leaves open. This phase does not fabricate specific answers to these (e.g. no invented cancellation window is hardcoded); guest-facing copy references "our cancellation policy" generically and links to `/terms`, to be finalized once those decisions are made and legal has reviewed the actual booking terms, privacy disclosures, and tax position for the Mesa jurisdiction.

## Explicitly out of scope for this phase

Real Hospitable Direct widget/checkout wiring, live controlled booking testing, legal sign-off, full WCAG/Lighthouse audit passes, new attribution reporting dashboards, and anything marketplace/independent-host related (out of the PRD's scope entirely — see LHS-DOD-008).

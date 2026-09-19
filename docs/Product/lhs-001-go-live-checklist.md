# LHS-001 v2.0: Go-Live Checklist

What's needed before the next milestone (operator rehearsal with the real Mesa calendar workflow, per the PRD's release sequence) can start. The code side is done and deployed; everything below needs your input or a business/legal decision. See [lhs-001-mesa-direct-booking.md](lhs-001-mesa-direct-booking.md) for the architecture.

## 1. Stripe (mostly already done)

The Stripe account itself is already live and configured — this pilot reuses it, not a new integration.

| # | Item | Where | Status |
|---|---|---|---|
| 1 | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / environment | Vercel production env vars | Already configured |
| 2 | **New** booking payments webhook endpoint | Stripe Dashboard → Developers → Webhooks → Add endpoint, URL `https://luxehavencollective.co/api/webhooks/stripe/bookings`, events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `refund.created`, `refund.updated`, `refund.failed` | **Needed** |
| 3 | `STRIPE_BOOKING_WEBHOOK_SECRET` | That new endpoint's signing secret, set as a Vercel env var | **Needed** |

Once #2/#3 are done, hand the secret back and it's a config-only change — no code changes needed.

## 2. Business and legal decisions (PRD §13.2)

Same category as before — these need a business owner and, per the PRD's own DOD, legal review before production use.

| Decision | What's needed |
|---|---|
| Final rate and quote model | Confirm nightly/weekly/monthly rules, discounts, rounding, and quote expiry — the pilot currently uses the property's already-configured nightly rate, cleaning fee, and tax rate directly |
| Payment schedule | Full payment at booking vs. deposit + balance |
| Merchant of record & statement descriptor | Confirm the Luxe Haven entity guests see on their statement, and who owns disputes/chargebacks |
| Arizona/Mesa taxes | Registration, collection, and remittance obligations |
| Cancellation/refund policy | Windows, fees, no-shows, extensions |
| Rental agreement / house rules | Versions and consent evidence |
| Block evidence standard | What counts as sufficient calendar-block evidence (reference number vs. attestation vs. screenshot) |
| Review and release SLAs | Real business-hours response target (pilot default: 24h) and owner/escalation coverage |
| Guest verification / deposit | Whether to require ID verification or a security deposit, and through what provider |
| Retention and deletion | How long to keep request/guest/payment/audit data, and the test-data cleanup plan |

## 3. Operational readiness

- Assign at least one operator with admin access to `/admin/booking-requests` who will actually run the review → block → monitor workflow.
- Decide the calendar system operators check against for conflicts (Hospitable is the existing one) and make sure whoever reviews requests has access to it.
- Refund initiation is **not built** in this pass (see the main doc's "known limitations") — confirm the plan is to handle any pilot refunds manually in the Stripe dashboard for now.

## 4. What happens once these land

1. Set `STRIPE_BOOKING_WEBHOOK_SECRET` — the payment step goes from a gate that will fail closed (never a security risk, just non-functional) to fully live.
2. Run the PRD's controlled scenarios (request happy path, alternate dates, approval + block, gate-bypass attempts, controlled live payment, atomic confirmation, duplicate/delayed events, expiry/failure, cancellation/refund, concurrency) with real test data before inviting any real traffic.
3. Legal/business sign-off on the items in section 2 clears the way for the private production booking stage.

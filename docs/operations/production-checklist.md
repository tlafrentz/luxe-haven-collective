# Commerce production checklist

## Configuration

- [ ] Live restricted Stripe API key stored as a sensitive deployment secret.
- [ ] Live publishable key configured only where required.
- [ ] Live webhook signing secret configured separately from test and preview.
- [ ] Billing Portal live configuration ID verified.
- [ ] HTTPS site and Checkout return URLs verified.
- [ ] Stripe API version reviewed.
- [ ] Key rotation and Dashboard access policy reviewed.
- [ ] Stripe Dashboard team uses strong multifactor authentication.

## Catalog

- [ ] Every active payable Product has a live Stripe Product mapping.
- [ ] Every active payable Price has a live Stripe Price mapping.
- [ ] Offers reference compatible Products and Prices.
- [ ] Entitlement and fulfillment mappings are complete and versioned.
- [ ] Stripe Tax configuration and registrations are explicitly reviewed before enabling automatic tax.

## Security and isolation

- [ ] Raw-body webhook signature verification passes.
- [ ] Invalid and replayed webhook tests pass.
- [ ] Delayed and out-of-order event tests pass.
- [ ] Test objects cannot mutate live records.
- [ ] RLS and administrative authorization pass.
- [ ] Secrets, signatures, signed URLs, and raw payloads are absent from logs.
- [ ] Cross-workspace Checkout, Payment, Subscription, Entitlement, and Fulfillment access is denied.

## Release validation

- [ ] Migrations applied and verified.
- [ ] TypeScript, ESLint, relevant tests, full suite, build, route validation, and `git diff --check` pass.
- [ ] Preview subscription and one-time purchases complete.
- [ ] Webhook, fulfillment, Portal, invoice, refund, cancellation, and resume walkthroughs complete.
- [ ] Approved production smoke purchase completes.
- [ ] Stripe delivery logs and Commerce runtime health reviewed.
- [ ] Temporary test records removed through an audited cleanup.
- [ ] Release evidence and rollback owner recorded.

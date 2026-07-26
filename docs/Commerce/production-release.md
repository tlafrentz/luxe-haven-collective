# Commerce production release

PC-001C.6 releases the provider-neutral Commerce lifecycle implemented in PC-001C.1–C.5. Stripe remains an infrastructure provider; Commerce Orders, Payments, Subscriptions, Entitlements, and Fulfillments remain canonical.

## Release sequence

1. Apply and verify every Commerce migration in order.
2. Run the catalog and production-configuration checks.
3. Verify test-mode Checkout, webhooks, Billing Portal, invoices, refunds, subscriptions, and fulfillment.
4. Deploy to preview and repeat the end-to-end walkthrough.
5. Configure live restricted API credentials and the live webhook endpoint.
6. Verify live Product and Price mappings without copying test identifiers.
7. Complete the approved low-value production smoke purchase.
8. Review Stripe delivery logs and application operational health.
9. Remove temporary records through an audited cleanup procedure.

The release must stop for any critical catalog issue, environment mismatch, invalid webhook signature behavior, unresolved payment mismatch, or cross-workspace authorization failure.

## Stripe baseline

- API version: `2026-06-24.dahlia`.
- Prefer a least-privilege restricted key (`rk_live_`) over an unrestricted secret key.
- Store live credentials as sensitive deployment secrets.
- Use separate test and live Customers, Products, Prices, webhook secrets, and Portal configurations.
- Keep duplicate and delayed webhook processing idempotent.
- Confirm raw-body signature verification at `/api/webhooks/stripe`.
- Rotate superseded keys after the production restricted key is verified.

## Release evidence

Preserve the migration report, test and build summaries, route manifest, preview walkthrough, smoke-test order number, webhook delivery references, runtime-log review, and release decision. Never place secrets or complete provider payloads in release evidence.

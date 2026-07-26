# Commerce Payment Walkthrough

Use Stripe test mode and a non-production workspace.

1. Start Checkout and verify the Pending Order exists before redirect.
2. Return before webhook delivery and verify the page says confirmation is processing.
3. Deliver Checkout completed and Payment succeeded; verify one Payment, one paid transition, one activity record per event, and one pending ready-for-fulfillment outbox event.
4. Redeliver events and confirm no duplicate effects.
5. Deliver success before completion, then a late failure, and confirm Paid does not regress.
6. Exercise failed, expired, partial-refund, and full-refund states.
7. Verify forged signatures, metadata, workspace, environment, amount, and currency are rejected or retained for recovery.
8. Verify another workspace and an anonymous Session ID cannot read the result.
9. Confirm admin diagnostics omit raw payloads and sensitive values.
10. Remove test records and review Stripe delivery and application runtime logs.

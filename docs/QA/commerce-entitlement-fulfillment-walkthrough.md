# Commerce Entitlement and Fulfillment Walkthrough

1. Complete a test one-time purchase and verify Payment becomes Paid before fulfillment starts.
2. Verify one Fulfillment per Order Line and one target per idempotency key.
3. Redeliver Payment events and confirm no duplicate grants, credits, downloads, or service orders.
4. Activate and renew a subscription; verify grants activate and extend.
5. Schedule cancellation and verify access through period end.
6. Exercise Past Due grace, Paused, Unpaid, Cancelled, and resumed states.
7. Reserve, consume, release, and overdraw-test a credit.
8. Verify protected downloads use authorized five-minute signed URLs and never expose asset paths.
9. Force an adapter failure, correct it, and retry from the admin queue.
10. Verify cross-workspace, suspended, removed, anonymous, expired, revoked, and test/live access is denied.
11. Confirm refunds create the configured effect or manual review without deleting feature data.
12. Remove test grants, fulfillments, downloads, and service orders.

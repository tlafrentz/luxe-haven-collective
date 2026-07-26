# Stripe Webhook Runbook

Investigate failed or delayed delivery at `/admin/commerce/webhooks`.

1. Confirm the endpoint received a verified receipt.
2. Check environment, Order resolution, customer/workspace identity, amount, and currency.
3. Retry only transient provider, database, or lease failures.
4. For reconciliation-required events, load the current provider object and compare it to the immutable Order; never type a paid status manually.
5. Mark unsupported events ignored only when they cannot represent money movement.

Alert on signature spikes, old processing receipts, unresolved paid provider state, amount/currency mismatch, duplicate successful Payments, or a failed outbox write. Logs must contain identifiers and typed error codes, never raw payloads or secrets.

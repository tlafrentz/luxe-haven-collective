# Subscription Policy

Stripe Billing owns renewal, collection, retry, payment-method, and portal workflows. Commerce owns the synchronized workspace projection and append-only history.

Webhook mappings:

- `customer.subscription.created` → Subscription Created
- `customer.subscription.updated` → renewed, changed plan, cancellation scheduled, or other update
- `customer.subscription.paused` → Paused
- `customer.subscription.resumed` → Resumed
- `customer.subscription.deleted` → Cancelled
- `invoice.created` and `invoice.finalized` → Invoice Created/Open
- `invoice.updated` → Invoice Updated
- `invoice.paid` → Invoice Paid
- `invoice.payment_failed` and `invoice.payment_action_required` → Invoice Payment Failed/Attention
- `invoice.finalization_failed` → Invoice Finalization Failed

Events are signature-verified, environment-scoped, idempotent, and resolved by trusted Customer, Subscription, Price, and workspace mappings. Missing dependencies remain failed receipts for replay after the related provider state arrives.

Plan changes preserve previous/resulting Price, status, period, event identity, and revision. Cancellation at period end does not become Cancelled until provider state confirms it. Billing Portal actions are never inferred from the redirect.

# Commerce Fulfillment Runbook

Use `/admin/commerce/fulfillment` for pending, failed, completed, and manual-review handoffs.

1. Confirm Payment or Subscription state is canonical.
2. Inspect the Order Line snapshot, adapter, scope, attempt count, and safe error code.
3. Correct missing configuration or scope before retrying.
4. Retry the same outbox identity; never create a replacement target manually.
5. For uncertain target creation, reconcile the adapter’s idempotency key.
6. Route consumed-credit, completed-service, and downloaded-product refunds to manual review.

Never log signed download URLs, private asset paths, customer secrets, or restricted manual notes.

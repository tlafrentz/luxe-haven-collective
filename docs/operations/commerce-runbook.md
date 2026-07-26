# Commerce operations runbook

Start at `/admin/commerce/health`. The dashboard provides bounded operational status without exposing secret values or raw Stripe payloads.

## Daily review

- Review critical and high alerts.
- Check failed webhook and fulfillment queues.
- Review pending, processing, and failed Orders and Payments.
- Review past-due or unpaid Subscriptions.
- Review average webhook and fulfillment latency.
- Confirm catalog and production-configuration health after catalog or deployment changes.

## Safe recovery

- Retry only records shown as eligible by the administrative queue.
- A webhook retry reprocesses its persisted normalized event idempotently.
- A fulfillment retry reuses the durable outbox record and target idempotency identity.
- Reconciliation requests must name an internal subject and environment and include a reason.
- Provider state, amount, currency, customer, workspace, and environment remain authoritative validation inputs.
- Operators cannot type an arbitrary Paid or Fulfilled state.

Every retry and reconciliation request writes append-only operational activity. Never delete and recreate commercial history as a recovery method.

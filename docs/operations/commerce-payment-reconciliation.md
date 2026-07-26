# Commerce Payment Reconciliation Policy

One-time Orders require full payment in the Order currency. Underpayment, overpayment, currency mismatch, customer mismatch, workspace mismatch, and environment mismatch block confirmation.

Checkout completion with unresolved payment produces Payment Processing. A verified success may arrive before Checkout completion and can confirm the Order when trusted metadata reconciles. Paid Orders do not regress when delayed failure or expiration events arrive.

Manual reconciliation is an administrative provider-state refresh, not a status override. It must use the same validations, transaction, idempotency key, activity log, and outbox rule as webhook processing.

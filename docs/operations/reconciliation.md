# Commerce reconciliation

Reconciliation compares canonical Commerce state with trusted current provider state. It detects drift; it does not replace Orders with Stripe objects.

## Supported subjects

Orders, Payments, Customers, Subscriptions, Invoices, Products, Prices, and Entitlements can enter the reconciliation queue.

## Severity

- Critical: money, currency, environment, duplicate successful payment, or cross-workspace conflict.
- High: paid provider state is unresolved internally, fulfillment is blocked, or subscription access materially differs.
- Medium: invoice, catalog, or entitlement projection is stale but customer value remains available.
- Low: nonmaterial metadata or freshness differences.

## Procedure

1. Resolve the internal subject and environment.
2. Load provider state through the Commerce provider adapter.
3. Validate environment, customer, workspace, amount, currency, and provider mapping.
4. Apply the existing canonical transition policy idempotently.
5. Append operational activity and preserve prior state.
6. Re-run catalog, entitlement, or fulfillment validation as applicable.

Never reconcile from redirect parameters, browser state, copied provider identifiers, or manually entered payment success.

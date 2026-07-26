# Orders, Payments, and Webhooks

PC-001C.3 makes verified provider state the source of payment truth. A browser return never changes an Order. Stripe events enter only through `POST /api/webhooks/stripe`, become safe durable receipts, normalize into Commerce events, and are transactionally reconciled into Payments, Orders, activity, and the outbox.

Order and Payment are separate aggregates. Failed attempts remain historical. Paid, partially refunded, and refunded are canonical Order states. Payment success writes `order.ready-for-fulfillment` once; fulfillment and entitlement consumers are intentionally absent.

Customer result pages resolve an authenticated, RLS-authorized local Order from the persisted Checkout Session. Provider identifiers alone grant no access.

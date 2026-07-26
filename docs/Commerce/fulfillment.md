# Fulfillment

Fulfillment begins from a durable `order.ready-for-fulfillment` or `subscription.entitlements-reconcile` outbox event. Payment, Order, Subscription, Entitlement, Fulfillment, and downstream execution remain distinct.

One-time Orders build one fulfillment per immutable Order Line snapshot. Analysis products grant credits; digital products grant protected downloads; Guidebook, Notary, and manual services create canonical service orders until dedicated feature ports are available.

Every handoff has an idempotency key, attempt history, target reference, and recoverable outbox event. Commerce completion means the value entered the correct platform workflow, not that professional work finished.

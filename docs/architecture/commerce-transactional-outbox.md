# Commerce Transactional Outbox

`commerce_outbox_events` is the durable handoff between payment confirmation and later fulfillment. The ready event is committed in the same transaction as the successful Payment and paid Order.

Identity is `order + event type + paid revision`. Duplicate or concurrent provider events therefore cannot create duplicate fulfillment work. PC-001C.3 leaves events pending. PC-001C.5 will lease, publish, and consume them idempotently.

Outbox payloads contain internal aggregate references and versioned state only. They contain no card, billing-address, or raw Stripe payload data.

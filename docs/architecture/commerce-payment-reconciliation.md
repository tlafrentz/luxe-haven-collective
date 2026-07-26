# Commerce Payment Reconciliation

Flow:

`raw Stripe request → signature verification → safe receipt → provider-neutral event → trusted Order resolution → amount/currency/scope validation → atomic reconciliation`

Resolution uses internal metadata, persisted Checkout mapping, then existing Payment mapping. Missing or ambiguous resolution fails closed. Test and live environments are part of every provider uniqueness boundary.

The database transaction updates the Payment attempt and Order revision, appends deterministic activity, creates at most one ready-for-fulfillment outbox event, and marks the receipt processed. Terminal states cannot regress because late events are applied against current state.

Stripe shapes remain in `src/platform/commerce/infrastructure/stripe`. Application and presentation consume canonical types.

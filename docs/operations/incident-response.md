# Commerce incident response

## Immediate priorities

1. Protect customers from duplicate payment or duplicate fulfillment.
2. Preserve webhook receipts, Orders, Payments, outbox events, and audit history.
3. Determine whether the incident affects test, preview, or live Commerce.
4. Disable only the affected entry point when containment is necessary.
5. Communicate that payment and fulfillment are separate states.

## Credential exposure

Rotate or revoke the affected Stripe key immediately, review Stripe Workbench request logs, replace the deployment secret, and verify the new restricted key before restoring traffic. Rotate the webhook signing secret independently when applicable. Search application logs and source history without copying secrets into incident notes.

## Webhook failure

Validate endpoint availability and signature configuration. Do not bypass verification. Inspect the persisted receipt, retry eligible processing, and reconcile the related Order from trusted provider state when delivery order is ambiguous.

## Payment or fulfillment mismatch

Do not refund, recreate an Order, or grant access merely to clear an alert. Queue reconciliation, validate provider and canonical state, then use the bounded recovery command. Completed customer work and immutable snapshots remain preserved.

## Closure

Record scope, timeline, customer impact, recovery actions, evidence, and follow-up controls. Resolve operational alerts only after canonical and provider states agree.

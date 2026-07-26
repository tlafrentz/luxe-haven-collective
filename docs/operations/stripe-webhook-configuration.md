# Stripe Webhook Configuration

Configure separate test and live endpoints at `/api/webhooks/stripe`. Store `STRIPE_WEBHOOK_SECRET` and the restricted Stripe API key in the deployment secret store. Never commit either value.

Subscribe only to:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.processing`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.refunded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.created`
- `invoice.finalized`
- `invoice.updated`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.finalization_failed`
- `payment_method.attached`
- `payment_method.updated`
- `payment_method.automatically_updated`

The adapter maps these to Checkout completed/expired, Payment processing/succeeded/failed/cancelled, and Refund updated. Unknown events are verified, recorded, and intentionally ignored.

Validate delivery in Stripe Workbench and review application receipt health before enabling live traffic.

# Stripe Configuration

Use separate restricted keys for test and live environments.

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_INVESTMENT_ANALYSIS`
- `NEXT_PUBLIC_SITE_URL`
- Reserved: `STRIPE_WEBHOOK_SECRET`
- Reserved: `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`

Never commit keys. Production rejects test credentials and non-production rejects live credentials. Configure product and price identifiers independently per environment.

Stripe Tax is not enabled until active jurisdiction registrations and product tax codes are confirmed with a tax advisor.

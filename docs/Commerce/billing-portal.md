# Billing Portal

The billing workspace creates a new short-lived Stripe-hosted Customer Portal session after authenticating the Commerce Customer and workspace relationship. The browser supplies no Customer ID, plan, or subscription mutation.

Stripe’s portal manages payment methods, billing details, eligible upgrades/downgrades, cancellation, and resume. Luxe Haven persists only safe Portal session identity, environment, workspace, return URL, and expiry. Returning from the portal performs no commercial mutation; verified webhooks synchronize changes.

Test and live configurations remain isolated. `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` is optional when a default configuration exists.

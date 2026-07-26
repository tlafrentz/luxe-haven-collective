# Invoices

Invoices are historical commercial records associated with a canonical Subscription. The current provider projection stores number, amount, currency, state, service period, due/retry dates, and Stripe-hosted invoice/PDF links.

States are Draft, Open, Paid, Void, and Uncollectible. Every provider event appends an immutable invoice revision, so renewals and payment failures remain reproducible while the read model exposes the latest state.

Only HTTPS Stripe-hosted document URLs are accepted. Customers receive invoice access through RLS-authorized billing reads; provider Invoice IDs alone do not authorize access.

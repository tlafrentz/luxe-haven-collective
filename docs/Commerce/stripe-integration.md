# Stripe Integration

Stripe is a Commerce infrastructure provider. Features never import Stripe or provider identifiers.

The curated Stripe plugin was unavailable in the configured marketplace, and no Stripe MCP planner was exposed. The official Stripe documentation fallback was installed and its Checkout, Billing, Tax, and Security guidance was reviewed.

The integration uses API version `2026-06-24.dahlia`, hosted Checkout Sessions, dynamic payment methods, restricted keys where possible, idempotent Customer creation, and test/live isolation. Stripe Tax remains disabled until Luxe Haven confirms active registrations.

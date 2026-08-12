# OC-001 — Purchasable Offer Catalog Requirements

OC-001 establishes one immutable, server-owned catalog over CA-001. The public projection is emitted only for an active offer version with a passed publication record. A checkout action is emitted only when every active price version has one exact, live Stripe mapping matching amount, currency, cadence, environment, and effective period.

The browser may select only registered offer codes, price codes, cadence, and allowlisted configuration values. It never supplies an amount, Stripe identifier, entitlement, policy version, return origin, or destination. Checkout creates an immutable purchase-intent snapshot before requesting a Stripe-hosted Checkout Session. Verified webhooks remain the only payment authority; CA-001 remains the account, entitlement, onboarding, and first-value authority.

Guidebook and Investment definitions contain no HPM grant or prerequisite. Furnishing prices cover only the stated service scope and exclude furniture purchases, construction, and unapproved procurement or installation. Add-ons remain unavailable until separately approved and registered.

Publication gates: approved matrix; immutable catalog and price versions; complete policies; exact live mapping; marketing parity; entitlement/onboarding resolution; passed production journey; authorization, RLS, idempotency, and concurrency proofs.

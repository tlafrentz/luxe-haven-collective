# Subscriptions

Commerce subscriptions are provider-neutral projections of Stripe Billing relationships. They contain customer, workspace, canonical Product/Price, current billing period, cancellation intent, status, revision, and synchronization time.

Supported states are Incomplete, Trialing, Active, Past Due, Paused, Cancelled, Expired, and Unpaid. Stripe remains authoritative for billing collection and retry behavior. Verified `customer.subscription.*` events update the current projection and append an immutable `commerce_subscription_history` snapshot.

V1 permits one nonterminal primary subscription per workspace and environment. Plan swaps resolve Stripe Price IDs back to canonical Commerce Prices. Unknown prices or workspaces fail reconciliation rather than guessing.

A Subscription never grants or revokes an entitlement. PC-001C.5 consumes commercial state through a separate policy.

# Entitlements

Entitlements are provider-independent access records. Features ask `HasEntitlement` or `ResolveEntitlements`; they never inspect Stripe products, plans, subscriptions, or invoices.

Stable namespaced templates define scope, grant type, duration, and quantity. Grants preserve source, subject, effective dates, quantity, status, environment, and revision. Pending, Active, Suspended, Expired, Revoked, and Consumed history remains auditable.

Resolution is deterministic and scope-aware. Compatible finite grants aggregate remaining quantities; overlapping unlimited grants do not multiply access. Missing access returns Unavailable. Suspended and expired grants block protected actions.

# Commerce Entitlement Resolution

Resolution inputs are authenticated profile, authorized workspace, optional Property or Opportunity, requested keys, and evaluation time. The resolver filters by scope, environment, grant state, effective dates, and remaining quantity.

The result includes Available, Unavailable, Suspended, or Expired state, compatible aggregate quantities, expiration, bounded source references, and a cache version. Stripe is never queried.

Feature routes, APIs, and commands must enforce `HasEntitlement` at their server application boundary. Navigation is only presentation and never authorization.

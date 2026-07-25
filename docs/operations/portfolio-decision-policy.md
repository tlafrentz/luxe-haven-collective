# Portfolio Decision Policy

`PORTFOLIO_DECISION_POLICY` centralizes readiness, recommendation expiration,
approval authority, freshness, and review timing.

A recommendation is review-ready only when it has active source findings,
evidence, expected impact, resources, material assumptions and dependencies,
and at least two alternatives including the baseline.

Recommendation strength is one of Strong Recommendation, Recommendation,
Consider, Monitor, or Insufficient Evidence. Ordering exposes materiality,
urgency, confidence, risk reduction, dependency readiness, and time to impact.
No unexplained priority score is shown.

V1 capital approval is owner-only. Approval requires an in-scope active
recommendation, selected reviewed alternative, rationale, review date, valid
material assumptions, and no unresolved critical dependency.

Logs may contain IDs, role, revision, status, policy/evidence versions, resource
types, counts, typed result, and duration. They must omit raw capital values,
sensitive rationale, full evidence, guest data, credentials, and inaccessible
property details.


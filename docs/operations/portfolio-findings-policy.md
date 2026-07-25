# Portfolio Findings Policy

PI-001E thresholds are centralized in `PORTFOLIO_FINDINGS_POLICY` and carry a
policy version for cache invalidation and operational traceability.

Priority is lexicographic and explainable:

1. impact
2. confidence
3. urgency
4. affected scope
5. evidence strength

There is no hidden weighted score. Data-quality limitations lower confidence or
suppress a finding; they do not manufacture a conclusion. Opportunity evaluation
requires the configured minimum property coverage.

Operational traces may record workspace ID, authorized property count, finding
counts, state, confidence, freshness, policy/projection versions, and duration.
They must not include raw financial values, inaccessible property names, guest
data, provider credentials, or full evidence payloads.


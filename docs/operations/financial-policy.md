# Financial Policy

## Access

Financial authorization is capability-based:

- `financial.read`: bounded summary snapshot;
- `financial.detail`: transaction detail;
- `financial.planning`: budget and forecast operations;
- `financial.administration`: identity, accounts, providers, and policy.

Viewer and Contributor receive summary read access. Operator additionally
receives detail. Administrator and Owner receive planning and administration.
Property assignments still constrain every role except Workspace Owner.
Anonymous, inactive, cross-Workspace, and unassigned-property reads fail before
financial repositories are queried.

## Quality

Confidence is evidence quality, never financial performance:

- High: at least 90% transaction/provider/expense evidence and current sync.
- Moderate: at least 60% minimum coverage and known freshness.
- Low: some usable evidence with material gaps or stale synchronization.
- Insufficient evidence: no posted transactions or no revenue observations.

Freshness bands are current (up to 24 hours), partial (up to 72 hours), stale
(over 72 hours), and unknown (no valid successful synchronization time).

Manual adjustments remain counted and traceable. Posted transactions cannot be
edited. Reporting currency conversion belongs in an upstream adapter with
conversion evidence; the canonical builder never guesses exchange rates.

## Incident response

On provider or repository failure, preserve the last explicitly labeled cached
snapshot only when authorization and the full cache key match. Log the failure,
mark the serving state stale in the delivery layer, and never silently replace
missing categories with inferred values.

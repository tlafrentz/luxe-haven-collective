# IA-001D — Investment Workspace Integration

## Outcome

The Investment Workspace exposes the existing canonical lifecycle: setup, analysis, immutable opportunity version, scenario, comparison, report, and history. Presentation surfaces link to persisted commands and snapshots; they do not introduce underwriting, market, score, or financial calculations.

## State machine

The application state vocabulary is `idle`, `ready`, `running`, `succeeded`, `saved`, `scenario`, and `archived`. Failures carry exactly one category: validation, provider, authorization, persistence, concurrency, expired save token, or unknown.

Save readiness is a domain predicate. A successful canonical analysis and an unexpired server-issued save token are required. Completed forms and rendered metrics do not enable saving.

## Navigation and lifecycle

Investment navigation is:

1. Overview
2. New Analysis
3. Portfolio
4. Scenarios
5. Reports

Analysis history contains immutable opportunity analysis versions only. Each version links to reanalysis, scenario creation, and report generation. Scenario comparisons consume persisted output snapshots. Investment reports are filtered to `investment-decision` reports and are generated from a saved analysis version or scenario.

## Authorization

Server actions and query handlers remain the authority. UI visibility is convenience, never authorization. Read access is available to authorized viewers; mutation commands require the operator/admin permissions enforced by opportunity, scenario, and reporting handlers.

## Lineage

The durable chain is:

`Opportunity → Analysis Version → Scenario → Comparison/Report`

Reanalysis creates a new version. Historical analysis and scenario output snapshots are not modified or recomputed when reopened.

## Error handling

Provider, validation, authorization, persistence, concurrency, expired-token, and unknown failures retain their canonical application classification. User-facing provider language remains safe. Mutations refresh server-rendered state after success.

## Testing strategy

- State-machine unit tests cover failure classification and save eligibility.
- Opportunity application tests cover sequential immutable versions and authorization.
- Scenario tests cover creation, duplication, preferred selection, archive/restore, persisted comparison, and lineage.
- Reporting tests verify analysis/scenario source validation and immutable projection snapshots.
- Route/build validation confirms the investment Reports destination is in the production manifest.

No formulas, provider selection, provider behavior, retry policy, or user-facing provider messaging changed in IA-001D.

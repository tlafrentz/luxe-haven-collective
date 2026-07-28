# IA-001D — Investment Workspace Integration

## Outcome

The Investment Intelligence workspace now exposes canonical Saved Analysis and
Scenario persistence. A completed analysis is represented by one client-facing
discriminated state containing the server-issued analysis identity, save token,
analysis timestamp, token expiry, acquisition route, and canonical result.
Save readiness is derived only from that completed state and an unexpired token.

The `Scenarios` navigation destination is live at
`/dashboard/investments/scenarios`; no release-placeholder badge is used.

## Save Opportunity

- The analysis server action stores the immutable calculation payload and
  returns the opaque token with its authoritative expiration.
- Idle, running, failed, completed, expired, and saving states have distinct
  operator feedback.
- New saves and compatible opportunity appends continue through the SA-001
  atomic persistence boundary.
- Initial notes remain part of the initial opportunity transaction.
- Idempotency receipts prevent replay from creating another version.
- Successful saves navigate to the canonical Opportunity route and refresh
  server data.
- Domain and persistence errors are mapped to safe, actionable messages; raw
  database messages are not rendered.

## Scenario read model

The workspace-wide route queries persisted scenarios under Supabase RLS and
joins only accessible opportunity and immutable analysis metadata. It supports
active/archive, acquisition route, scenario type, opportunity, and preferred
filters. Financial metrics, recommendation, and confidence are read directly
from `output_snapshot`; React does not run the investment calculator.

Opportunity-scoped routes remain the mutation and comparison boundary:

- `/dashboard/investments/opportunities/[id]/scenarios`
- `/dashboard/investments/opportunities/[id]/scenarios/[scenarioId]`
- `/dashboard/investments/opportunities/[id]/compare`

Scenario detail includes source-analysis lineage and parent-scenario lineage.
Metadata mutations use the scenario RPC and do not modify source lineage,
assumption snapshots, output snapshots, or creation provenance. Comparison
reads persisted snapshots and the existing persisted comparison selection.

## Authorization and integrity

Workspace scenario reads rely on RLS for workspace/property visibility.
Opportunity-scoped reads and mutations additionally use the canonical
application authorization operations (`scenario.read`, `scenario.create`, and
`scenario.modify`). Viewers therefore receive readable persisted results when
policy permits but do not pass mutation authorization. The database remains the
authoritative enforcement layer.

Analysis versions and scenarios remain separate tables and projections.
Scenario records are never inserted into immutable analysis history.

## Verification

Run:

```text
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

The production build must include `/dashboard/investments/scenarios` and the
opportunity-scoped scenario detail and comparison routes.

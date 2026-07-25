# PI-001A — Portfolio Domain & Read Model

## Status

Implemented July 25, 2026.

## Canonical boundary

`PortfolioProjection` is the authoritative, presentation-neutral portfolio read
model. It is computed for one Workspace, one explicit authorized property scope,
and one explicit current/comparison period.

The older `Portfolio` aggregate in this bounded context represents strategic
membership planning. It is not used as the source of this operational projection.
The PI-001A read model does not persist bookings, properties, revenue, evidence,
or a copy of the projection.

## Flow

1. Validate the requested period.
2. Require an active Workspace membership with `intelligence.view`.
3. list the Workspace property catalog without loading portfolio facts.
4. Apply inclusion, property assignment, and optional filters.
5. Load metrics, observations, evidence, confidence, and Operational Data Quality
   only for the resolved property IDs.
6. Normalize each property contribution and roll up the portfolio.

Source adapters are required to reject any fact returned outside the resolved
scope. This makes authorization-before-aggregation an executable invariant.

## States

- `no-portfolio`: no authorized, included properties;
- `insufficient-evidence`: the portfolio exists but evidence is below the
  configured threshold or does not cover every included property;
- `ready`: included properties meet the descriptive evidence boundary.

Freshness uses `current`, `stale`, `degraded`, or `unknown` and propagates the
worst property state from Operational Data Quality. Confidence propagates the
least trustworthy source assessment; the projection does not invent a score.

## Deliberate exclusions

The read model contains no recommendations, rankings, health score, concentration
analysis, risk engine, scenarios, decisions, actions, or presentation queries.

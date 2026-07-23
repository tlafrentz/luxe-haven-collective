# Investment Opportunity domain (IA-001A)

## Boundary and ownership

Investment Opportunity owns durable portfolio workflow: identity, authenticated ownership, route, point-in-time subject-property reference, status, archive state, metadata, immutable saved-analysis versions, current-analysis designation, optimistic version, and append-only system activity. Investment Intelligence remains the sole owner of underwriting, formulas, recommendations, scores, confidence, evidence, risks, execution, outcomes, learning, and decision meaning. Market Intelligence remains the owner of property resolution and market analysis.

Dependency direction is presentation → Investment Opportunity → the public `@/features/investment-intelligence` contract → Platform. Investment Intelligence, Market Intelligence, and Platform do not import this capability. Opportunity domain code imports only the Platform kernel identifier primitive; the lifecycle projection is application code.

## Characterized contracts and snapshot decision

The repository's canonical `InvestmentLifecycleResult` is a discriminated union on `AcquisitionType.Purchase | AcquisitionType.RentalArbitrage`. Its `analysis` exposes property, market, assumptions, revenue and expense projections, financial performance, score, risks, supporting evidence, recommendation, and confidence. Contrary to the illustrative IA-001A model, it currently exposes no lifecycle-result ID, analysis timestamp, source-resolution summary, data gaps, lineage IDs, recommendation ID, or policy versions.

IA-001A therefore uses a hybrid record: a durable, schema-versioned decision snapshot plus save-command metadata. `SaveOpportunityAnalysisInput` requires the canonical lifecycle-result identity and analyzed timestamp from the orchestration/persistence boundary and accepts only policy/lineage/source facts actually available there. It never fabricates a canonical policy version. Snapshot schema `1` projects results without rerunning formulas or calling Market Intelligence. Purchase price and proposed lease remain deal terms. No estimated market property value or market rent is synthesized because the current public lifecycle result does not expose either one.

The snapshot records recommendation using the canonical five-value vocabulary, the original 0–100 score, confidence level, route-specific economics, market ADR/occupancy, risks, and evidence. `derived`, `market`, and `user` labels are used only where their provenance is structurally explicit in the canonical result; richer assumption-resolution counts arrive as save metadata.

## Aggregate and lifecycle

`InvestmentOpportunity` is the aggregate root. Server-generated opportunity and analysis identifiers use the Platform `Identifier` primitive and distinct prefixes. Owner, route, property identity, and creation timestamp have no mutation methods. Analyses are immutable and receive a stable ID plus a monotonically increasing per-opportunity sequence. Adding one validates route, subject identity, schema support, canonical identity, and duplication, then makes it current.

The pipeline is `evaluating → researching/shortlisted/rejected`, `researching → evaluating/shortlisted/rejected`, `shortlisted → researching/offer-submitted/rejected`, `offer-submitted → shortlisted/under-contract/rejected`, `under-contract → offer-submitted/acquired/rejected`, and `rejected → evaluating/researching`. Acquired is terminal. Archive is orthogonal and preserves status; restore removes `archivedAt`, so no status is guessed.

Names are trimmed and limited to 120 characters. Tags are trimmed, whitespace-normalized, case-normalized for uniqueness, sorted deterministically, limited to 40 characters and 20 entries. Each successful command mutation increments the aggregate version. Analysis sequence increments only when an analysis is added.

## Persistence, concurrency, and access

Migration `20260722090000_investment_opportunity_foundation.sql` creates opportunities, analyses, tags, activity, and idempotency-command tables. Historical analyses and activity are append-only and ordinary product deletion is intentionally absent. The current-analysis foreign key is deferred to avoid insertion ordering hazards. Unique constraints guard sequence and canonical lifecycle identity.

`save_investment_opportunity` is the transaction boundary. It locks the aggregate row, validates expected/current/next versions, inserts a new immutable analysis, replaces tags, advances the current pointer, appends activity, and records the owner-scoped command ID atomically. PostgreSQL serialization code `40001` maps to `CONCURRENT_OPPORTUNITY_MODIFICATION`. Duplicate command IDs return the prior opportunity result.

RLS allows authenticated owners and existing admins to read parent opportunities; analyses, tags, and activity inherit access through the parent. No direct write grants exist for historical or aggregate tables. Mutation is through the security-definer RPC, which checks `auth.uid()` or the existing admin policy. Unauthenticated callers cannot execute it. Server application ownership checks remain mandatory.

## Persistence flow

```text
InvestmentLifecycleResult
  → pure snapshot builder
  → compatibility and duplicate policy
  → InvestmentOpportunity.addAnalysis
  → repository payload mapper
  → atomic save RPC (version lock + analysis + pointer + activity)
```

## Deferred scope

IA-001B owns portfolio UI, advanced search/filtering, comparison and ranking projections. IA-001C owns user-authored notes and timeline presentation. IA-001D owns metric-oriented comparison persistence. Offer management, tasks, documents, CRM, messaging, MLS synchronization, photos, collaboration, and acquisition-strategy generation remain outside this capability.

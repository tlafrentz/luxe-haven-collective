# Standard Report Catalog Requirements

Status: implemented as a bounded catalog contract. Report calculation, generation, scheduling, delivery, and custom report design remain outside this increment.

The catalog is the authoritative immutable definition layer for the Executive, Owner, Investment, and Operations standard-report families. Each version declares its decision question, audience, subject, ordered section contract, canonical input projections, date and comparison policy, formats, readiness behavior, disclosures, entitlement rules, authorization policy, and registered destinations.

## Governing rules

- Definitions follow `draft → approved → active → retired`; active versions are immutable and material changes require a new version.
- Exactly 13 launch definitions are active. Five reports awaiting canonical product data remain drafts and cannot be generated.
- Performance reports use `shared_date_context.v1`; investment reports use immutable analysis snapshots through `snapshot_version.v1`.
- Supported performance presets are current/previous month, month-to-date, current/previous quarter, quarter-to-date, current/previous year, year-to-date, rolling 30/90 days, and an authorized custom range.
- Comparisons are allowlisted per report. Missing comparisons are disclosed, never coerced to zero; canonical calculations own percentage and denominator handling.
- Sections call registered canonical projection providers. Definitions contain no report calculations or scoring logic.
- Readiness is server-derived as `ready`, `partial`, `blocked`, or `unavailable`. Missing required inputs block; conditional gaps produce explicit section disclosures.
- Every generated presentation format must consume the same immutable report snapshot. CSV is tabular; ZIP requires an authorized manifest; PDF retains report identity and disclosures.
- Every operation reauthorizes actor, tenant/account, membership, entitlement, subject/resource, definition, format, and destination.
- Customer-safe catalog projections expose commercial availability and expected content, not repositories, scoring logic, provider configuration, or administrative notes.
- Registration uses the immutable code registry, is idempotent, and rejects fingerprint drift.

## Explicit exclusions

No custom builder, arbitrary metric selection, scheduling, delivery automation, new calculations, HPM health model, Investment engine, operations-data collection, accounting statements, BI framework, or parallel date/authorization/entitlement model is introduced.

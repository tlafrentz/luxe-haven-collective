# PS-001B — Observe + Understand Stabilization

**Parent:** PS-001 — Platform v1 Customer Readiness Stabilization

**Prerequisite:** PS-001A implementation baseline

**Type:** Stabilization / production-readiness gate

**Priority:** P0/P1

**Status:** Complete — production verified 2026-08-23
**Feature freeze:** Closed without new product scope

## Objective

Prove that a Founding Partner can move from Observe (Revenue and Financial Intelligence) to Understand (Executive and Portfolio Intelligence) without incorrect calculations, inert controls, misleading evidence, broken drill-downs, duplicate context, orphaned routes, lost return state, or raw runtime/provider failures. This milestone stabilizes exposed capability; it does not add intelligence features.

## Canonical scope

```text
Observe
├── Revenue Intelligence
└── Financial Intelligence
    ├── Overview
    ├── Expenses
    ├── Cash Flow
    └── Forecast

Understand
├── Executive Intelligence
│   ├── Executive Brief
│   ├── Business Health
│   └── Attention Queue / diagnostic
└── Portfolio Intelligence
    ├── Overview
    ├── Properties
    ├── Concentration
    └── contextual: Supporting Signals, Property Intelligence, Data Quality
```

Retired parallel intelligence workspaces are compatibility redirects only and are never navigation destinations.

## Hard contracts

- Shared Workspace, Scope, Reporting Period, Comparison, and Basis come only from the PS-001A workspace context.
- Missing evidence is not an error; provider degradation is not automatically an error; zero is never substituted for unknown.
- Material values disclose measured, derived, estimated, last-known, or insufficient-evidence semantics as applicable, plus source, period, freshness, confidence, and derivation.
- Loading, ready, partial evidence, insufficient evidence, degraded data, empty, recoverable failure, and unauthorized behavior are intentional presentation states. Raw provider, database, and JavaScript errors are never customer copy.
- Export and Export options converge on canonical Reports. Shared context and current/full-capability report intent survive the handoff.
- Report rendering uses the immutable request snapshot as its authoritative reporting context. It must not substitute current context, default or hard-coded dates, or reconstructed UI state. The snapshot retains workspace and scope as applicable, reporting period, comparison, basis, source capability/view, and current-view versus full-capability intent.
- Connected Systems manages providers; it is not a generic fallback for manual entry, CSV import, or unrelated setup.
- Contextual Attention, Supporting Signals, Property Intelligence, and Data Quality remain within their owning Understand capability and receive deterministic return targets.
- Every visible interactive element is registered or explicitly verified as navigation, command, filter, drawer/modal, external, or disabled-by-design.

## Regression floor

Permanent coverage must protect Revenue and Financial overflow actions, exactly one Export/overflow, context retention after Connected Systems, canonical report generation, manual/CSV/connected cash evidence, Cash Flow retained/stale/degraded behavior, Forecast ready and incomplete states, Executive and Portfolio menus, URL-addressable Attention filters, canonical Attention/Data Quality routes, functional Supporting Signals, hidden primary tabs on diagnostics, canonical property drill-down/return, and report destinations.

FI-003C remains closed. PS-001B checks its customer-facing regression floor and introduces no Plaid scope.

## Controlled journey

1. Revenue Intelligence: change shared context, export through Reports, and return.
2. Financial Intelligence: Overview → Expenses → Cash Flow → Forecast → Data Sources → deterministic return.
3. Executive Intelligence: Review Attention → change URL-addressable filter → refresh/Back/Forward → return.
4. Portfolio Intelligence: Properties → Property Intelligence → return → Concentration → Data Quality → return → Supporting Signals.

The controlled workspace must contain known complete, partial, empty, and degraded evidence. Verify authorized customer, admin, wrong-tenant, anonymous, and revoked-user behavior without exposing cross-tenant aggregates, records, reports, or source details.

## Release gate

PS-001B closes only after the full suite, typecheck, lint, production build, action inventory, regression suite, authorization checks, controlled authenticated production journey, deep-link/refresh and Back/Forward checks all pass. Retain evidence and clean synthetic artifacts. Local architecture tests do not substitute for controlled production evidence.

## Non-goals

No new metrics, forecasting model, Plaid work, report implementation, intelligence capability, lifecycle stage, provider, categorization feature, performance rewrite, or visual redesign. Fix bounded defects required by this gate and stop.

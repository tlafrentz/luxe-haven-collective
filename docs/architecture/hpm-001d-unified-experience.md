# HPM-001D — Unified Experience

HPM-001D adds `/dashboard/hpm`, `/dashboard/hpm/attention`, `/dashboard/hpm/lifecycle`, and stable thread-detail routes. The dashboard shell exposes one feature-flagged HPM entry while retaining the existing capability workspaces.

Server components parse and validate URL context, resolve the authenticated workspace and property access, and call HPM-001B/C projection boundaries. Presentation components receive lifecycle health, stage state, freshness, attention rank, lineage, and valid commands as presentation-ready contracts; they do not calculate domain policy.

`HPM_UNIFIED_WORKSPACE_ENABLED=false` disables navigation and direct routes. It is enabled by default during the controlled implementation period so authenticated environments can verify it; capability authorization and RLS still apply independently.

The current production composition adapts the existing RLS-filtered Analytics/Revenue assembly into the HPM Observe source. Intelligence, Decisions, Execute, Outcomes, Learning, and Recommendations remain explicitly `not-configured` until their production source adapters are registered. HPM therefore reports a partial lifecycle and never substitutes mock records or zero values.

Scope, dates, filters, cursors, and thread identity use validated URL state. Capability destinations remain responsible for authorization. Projected destination commands are rendered as handoffs; mutation commands without a registered owning-capability UI route are explained rather than simulated in React.

Failures map to stable, user-safe states with correlation references. Optional unavailable sources preserve unaffected content. The shared components provide responsive cards, semantic headings and lists, labeled controls, non-color state text, keyboard-focus styling, and route-level loading and error states.

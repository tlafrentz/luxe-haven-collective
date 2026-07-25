# Portfolio Composition Projection

`PortfolioComposition` derives from the authorized PI-001A projection plus
bounded property metadata and canonical booking attribution loaded only for the
resolved property IDs.

Composition dimensions, concentration findings, diversification summaries,
distributions, seasonality, history, and evidence are separate read concepts.
PI-001B delegates its composition snapshot to this builder.

Cache identity contains Workspace, membership, role, authorized property IDs,
current and comparison periods, and projection version. Observability contains
only scope, counts, policy context, duration, confidence, and freshness.

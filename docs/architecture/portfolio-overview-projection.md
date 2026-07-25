# Portfolio Overview Projection

`PortfolioOverview` is derived from one current PI-001A `PortfolioProjection`,
an optional comparison projection, and a bounded execution summary.
Presentation calls only `getPortfolioOverviewRouteState`.

Authorization order:

1. resolve active Workspace membership;
2. resolve included, assigned, and requested property IDs;
3. load canonical property facts for those IDs;
4. build current and comparison Portfolio projections;
5. derive Overview interpretation;
6. read portfolio execution only for full-workspace authorization.

The cache key contains workspace, membership, role, sorted authorized property
IDs, current period, comparison type, and comparison period. Workspace
invalidation removes all derived variants. No projection is persisted.

Observability records scope type, authorized count, period comparison,
evaluation duration, availability outcome, confidence, and freshness. It omits
property values, guest data, credentials, inaccessible identities, and evidence
payloads.

# Workspace foundation

Workspace answers: **Which hospitality business am I operating, and how is it
configured?**

The canonical route is `/dashboard/workspace`. Global navigation contains Home
and Workspace. Workspace provides local navigation for Overview, Organization,
Team & Access, Properties, Connected Systems, Notifications, and Preferences.

Sprint 4A fully implements Overview and establishes the remaining section
routes for later milestones.

Overview reads organization identity, membership, properties, provider
connection, synchronization, and operational data health through one bounded
`WorkspaceSummary`. Property and connection health come from the shared
operational projection; Workspace does not independently evaluate freshness or
quality.

Supported states are:

- first use: an eligible profile has no owner record;
- healthy: configuration and shared operational projections are current;
- setup required: specific checklist items remain;
- degraded: Workspace remains usable while sync or operational data is stale;
- permission restricted: the signed-in role cannot administer Workspace;
- loading: route skeleton;
- error: unexpected failure only.

The Overview setup checklist names missing configuration. Empty operational data
is treated as setup work, not an error.

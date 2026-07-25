# Workspace Properties and Systems Architecture

The bounded model is:

```text
Authenticated profile
  -> workspace membership
  -> workspace / owner
  -> canonical property
  <- provider property reference
  <- connected system
```

`profileId`, `ownerId`, `workspaceId`, `propertyId`, and `connectionId` remain named and separate. `workspaceId` currently persists as `owners.id`; application contracts do not infer that they are conceptually interchangeable.

`property_workspace_configuration` owns inclusion and supported property overrides. `external_properties` remains the stable provider-reference table and gains workspace and reconciliation state. `integration_connections` gains workspace scope but returns no credentials. Existing provider and property IDs are preserved.

The read repository returns `WorkspacePropertySummary`, `ConnectedSystemSummary`, and bounded activity. Health is composed once in the application layer. Operational quality remains owned by the shared quality projection; Workspace does not create another evidence score.

Mutations pass through an authenticated RPC. It resolves active membership, enforces Owner or Administrator access, verifies target ownership, records safe activity, and deduplicates a repeated command ID. Database RLS remains authoritative for reads.

Backfill links a connection to a workspace only when its already-linked canonical properties resolve to exactly one owner. Ambiguous and unlinked records remain unresolved. No name-based auto-linking occurs.


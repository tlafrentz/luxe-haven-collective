# Workspace identity

Workspace is the canonical customer-facing business boundary:

`profiles.id → owners.profile_id → owners.id → properties.owner_id → operational data`

The application contract always carries three named identifiers:

```ts
type WorkspaceIdentity = {
  profileId: string;
  ownerId: string;
  workspaceId: string;
};
```

For Sprint 4A, `workspaceId` intentionally equals `ownerId`. This is an
application policy, not a claim that profiles and owners share an identifier.
A future workspace aggregate can change that mapping without changing callers.

## Identity consumers

| Identifier | Meaning | Current consumers |
| --- | --- | --- |
| `profileId` | Authenticated person | Auth checks, guests, reservation context, operational quality and sync projections |
| `ownerId` | Ownership aggregate | `properties.owner_id`, owner-scoped property reads |
| `workspaceId` | Customer business boundary | Workspace contracts and cross-product context |

Pages do not query `owners` or reconstruct this relationship. They call
`ResolveWorkspaceIdentity` through the Workspace repository. Owner isolation is
enforced both by application comparison and Supabase RLS.

Empty property, connection, or quality collections are valid first-use/setup
data. They are not application failures.

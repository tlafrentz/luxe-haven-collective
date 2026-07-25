# Workspace authorization

`WorkspaceAccessContext` is the shared application authorization result. It
contains the authenticated `profileId`, canonical `workspaceId`/`ownerId`,
business `ownerProfileId`, membership ID, status, role, property scope, and
permissions from `workspace-role-policy-v1`.

Authorization order is:

1. authenticated profile;
2. active membership;
3. canonical role permission;
4. property scope;
5. action-specific safeguard.

Suspended and removed memberships fail at step two. The final active Owner
cannot be demoted, suspended, or removed. Members cannot change their own role
or expand/remove their own access. Administrators cannot manage or grant Owner.

Operational identity resolution consumes memberships first and retains
`ownerProfileId` for guest, synchronization, and quality records that are
intentionally profile-scoped. Properties, bookings, reservation context, Home,
and intelligence-backed operational summaries use the same accessible property
IDs. RLS independently enforces the equivalent boundary.

Access mutations revalidate the dashboard layout, Workspace, Properties, and
Bookings. Server-rendered requests resolve membership afresh, so the defined
propagation window is the next request rather than session expiration or
deployment.

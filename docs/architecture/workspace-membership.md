# Workspace membership

Authentication and workspace authorization are separate:

`profiles.id → workspace_memberships → role + property scope → capabilities`

`workspace_memberships.workspace_id` uses the canonical Sprint 4A workspace ID,
which currently equals `owners.id`. It never stores or implies that a profile
ID is an owner or workspace ID.

Each valid existing owner is idempotently backfilled as one active Owner
membership with All Properties. Profiles do not receive access merely because
they exist. Invalid owner/profile relationships are surfaced rather than
repaired by inventing identities.

One membership row is retained per workspace/profile across active, suspended,
and removed states so history and safeguards remain stable. Selected property
access is stored in `workspace_member_property_access`; zero selected rows is
invalid for Selected mode.

Invitations are separate from memberships. Acceptance requires an authenticated
profile whose normalized email matches, an unexpired pending invitation, and
the raw token corresponding to the stored SHA-256 hash. Acceptance atomically
creates or restores membership, applies property assignments, invalidates the
token, and records activity.

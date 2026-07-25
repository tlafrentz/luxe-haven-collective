# Workspace access control

Workspace access is deny-by-default. A profile record alone grants no workspace
or property access.

Narrow `security definer` functions resolve active role and property access
without recursively querying protected policies. RLS covers memberships,
invitations, assignments, activity, properties, bookings, property media, and
maintenance. Anonymous users receive no grants or policies.

Management RPCs always derive the actor from `auth.uid()`, scope targets by
workspace ID, apply role and final-owner safeguards, and use command receipts
to prevent duplicate mutations. UI visibility is never considered security.

Invitation tokens contain 256 bits of randomness. Only SHA-256 hashes are
stored. Resend rotates the token and expiry. Cancellation and acceptance replace
the hash; accepted, cancelled, expired, or mismatched-email invitations cannot
grant access. Email links require an explicit authenticated acceptance action,
protecting against link scanners.

Access activity records role/scope summaries and action metadata, never tokens
or authentication secrets. Security notifications use a bounded outbox and do
not depend on marketing notification preferences.

# Owner initialization

Owner creation is an explicit first-use action. Reading Workspace never creates
database state.

Only authenticated `owner` and `admin` profiles may initialize an owner. The
`initialize_workspace_owner()` database function derives the profile from
`auth.uid()`; callers cannot supply another profile ID. A partial unique index
on `owners.profile_id` enforces one owner per profile.

Initialization uses an upsert and returns the existing `owners.id` when called
again. Concurrent and repeated requests therefore resolve to the same owner
instead of creating duplicates.

The migration refuses to install the invariant if historical duplicates exist.
That deliberate failure prevents an arbitrary merge of ownership aggregates;
operators must inspect and reconcile affected property relationships first.

First-use presentation explains the operation and requires the customer to
choose **Set up workspace**. Permission failures receive a dedicated restricted
state. Unexpected database or runtime failures use the route error boundary.

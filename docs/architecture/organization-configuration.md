# Organization configuration

Organization is a bounded application projection rooted in the canonical
`owners` record. It is not a second organization table.

`WorkspaceIdentity.profileId → owners.profile_id`

`WorkspaceIdentity.ownerId/workspaceId → owners.id`

The repository requires both relationships on reads. Updates execute through
`update_workspace_organization`, which derives the actor from `auth.uid()`,
checks owner/admin authorization, locks the resolved owner row, applies an
expected revision, and records an idempotency receipt.

Existing `company_name`, `mailing_address`, `preferred_contact_method`, and
`notes` remain intact. `display_name` is backfilled from `company_name` only
when empty. The new structured `organization_address` supports downstream
localization without converting or deleting the legacy mailing value.

`OrganizationProfile` and `OrganizationDefaults` are the only downstream
contracts. Products do not query `owners` directly. Organization defaults,
property overrides, and user preferences are separate configuration layers.

Activity stores workspace, actor, changed field names, and time. It deliberately
does not store broad before-and-after contact values.

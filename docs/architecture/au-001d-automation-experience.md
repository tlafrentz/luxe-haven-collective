# AU-001D Automation Experience

AU-001D adds a feature-flagged, server-authoritative Automation workspace over AU-001A through AU-001C. It introduces no automation persistence and no migration.

## Authority boundaries

- Initial state is rendered from authenticated, RLS-filtered Supabase queries.
- Presentation DTOs omit resources outside the actor's authorized property scope.
- Counts, attention state, ordering, and `validCommands` are produced by server projections.
- React renders command contracts and never derives lifecycle, approval validity, retry safety, or reconciliation policy.
- Definition mutations call the canonical AU-001A application service with expected versions and idempotency identities.
- Approval and run-control interaction remain fail-closed until AU-001E composes the owning-capability adapters required by AU-001C. Their independent feature flags do not create authority.
- Templates are immutable, versioned starting points. Creating from a template creates a customer-owned canonical draft.

## Routes

The canonical route root is `/dashboard/automations`, with Overview, Automations, Approvals, Runs, and Templates destinations plus definition, version, approval, run, and template details.

## Rollout controls

All controls are evaluated server-side. Workspace visibility additionally requires an approved tenant or internal cohort. Read-only, authoring, approval interaction, run control, and template catalog flags are independent and fail closed. AU-001F remains the production rollout owner.

## Experience safety

Uncertain outcomes never expose blind retry. Approval copy distinguishes automation authority from business approval. Partial projections disclose unavailable sources instead of displaying fabricated zeroes. Detail routes use safe not-found behavior for inaccessible identifiers. Consequential controls disclose target, expected version, consequence, reversibility context, and reason requirements.

## Performance budgets

- Initial projection: one authorized definition list and one bounded query each for runs, steps, and approvals.
- List page size: 10–100 records, default 25.
- Search input: bounded to 100 characters.
- Detail resources reuse the authorized projection in v1; AU-001E may introduce dedicated bounded detail queries without changing presentation contracts.

No AU-001D migration is introduced. Production deployment and enablement remain blocked by AU-001E, AU-001F, and HPM-001F release approval.

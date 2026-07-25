# Placeholder Guidelines

Status: Required for production UI

Unimplemented capabilities must look intentionally unavailable, never broken or production-ready.

## Required treatment

- `Preview`, `Coming Soon`, `Not Connected`, or `Requires Provider` badge.
- One-sentence explanation of what is unavailable and why.
- Optional roadmap context without promising a date.
- Disabled primary action with an accessible reason (`title`, description, or associated help text).
- Illustrative records explicitly labeled as example data.

Do not expose enabled primary buttons, links, menus, cards, or modal completion actions when no successful outcome exists.

## Labels

- `Preview`: an interactive or visual concept using illustrative data.
- `Coming Soon`: planned but absent.
- `Not Connected`: implemented capability lacking its runtime service.
- `Requires Provider`: depends on an external integration.

Preview pages may allow local exploration when that helps explain the concept, but create, send, save, generate, publish, share, and route actions remain disabled unless they complete.

## Release review

Every production release audits all buttons, links, menus, cards, and modals. Each affordance must either complete successfully, fail with actionable guidance, or use the placeholder treatment above.


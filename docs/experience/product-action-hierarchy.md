# Product Action Hierarchy

## Principle

Action prominence reflects business importance and current state. A page has one dominant forward action—not a row of equally loud controls.

## Levels

### Primary

The most important outcome for the current page state: Generate Report, Start Analysis, Create Guidebook, Invite Team Member, or Reply to Guest.

- One per page state
- Product header placement where broadly applicable
- Outcome-specific label
- Stable through routine filtering

### Secondary

Supports the primary workflow: Use Template, Import, Preview, Schedule, or Export.

- Adjacent to primary when product-wide
- Visually subordinate
- No more than one immediately visible in the header

### Tertiary

Low-emphasis utility: Duplicate, View history, Copy link, or Download.

- Text, ghost, icon, row, or overflow treatment
- Placed near the affected record
- Accessible name required for icon-only controls

### Destructive

Archive, Disconnect, Revoke access, or Delete draft.

- Separated from routine actions
- Names the affected object and consequence
- Confirmation proportional to reversibility
- Never the default focused action

## Label rules

Use verb + object or explicit outcome. Prefer “Publish new version” to “Submit,” “Reconnect Hospitable” to “Fix,” and “Continue to review” to an ambiguous “Continue.”

## Disabled and unavailable actions

A disabled action explains what is missing through nearby text, accessible description, or tooltip. Do not render a control that looks enabled but performs no action. Future capability is visually distinguished from insufficient permissions.

## Long-running and duplicate-safe actions

- Change to visible progress state.
- Prevent repeat submission using an idempotency boundary.
- Preserve navigation safety or warn before leaving.
- Resolve to success, partial success, or recovery—not indefinite loading.
- Publishing, sending, execution, and AI application always require explicit human initiation unless a separately approved workflow owns automation.

## Context placement

| Scope | Placement |
|---|---|
| Product-wide creation | Product header |
| Current workflow completion | Primary workspace |
| Record-level | Record row/detail |
| Supporting recommendation | Supporting region |
| Version/history | Activity region |
| Destructive | Overflow or dedicated danger area |

On mobile, a bottom action area is allowed only when DOM order remains logical and content is not obscured.

## Review questions

- Is there one obvious next action?
- Does the label describe an outcome?
- Is secondary emphasis actually secondary?
- Can users explain why a disabled action is unavailable?
- Are repeat and destructive actions safely handled?
- Does keyboard focus follow the visible hierarchy?

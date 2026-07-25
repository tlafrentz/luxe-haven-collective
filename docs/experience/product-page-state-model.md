# Product Page State Model

## Principle

State communicates the customer’s situation and available recovery—not merely a technical condition. Every product specification defines all nine states even when some are rare.

## Canonical states

| State | Meaning | Required communication | Primary behavior |
|---|---|---|---|
| First use | Nothing is configured or created | Product purpose, value, how to begin | One setup/create action |
| Healthy | Product is functioning normally | Current status and meaningful next work | Dominant workflow |
| Attention | Action is required | Problem, consequence, recommended resolution | Resolution action |
| Degraded | Partial data or capability unavailable | What works, what does not, impact, recovery | Continue safely or repair |
| Empty result | Configured product has no filter/search matches | Applied scope and how to broaden it | Clear filters/change search |
| Loading | State is being resolved | Preserved hierarchy and progress semantics | Prevent duplicate actions |
| Error | Requested outcome failed | Plain-language failure and recovery | Retry or safe return |
| Permission | User lacks required access | Restricted capability and escalation path | Request access or return |
| Archived | Work is retained outside active flow | Historical status and restoration semantics | Restore where supported |

## State boundaries

- First use and empty result are never interchangeable.
- Attention is actionable live state; degraded means some trusted capability is absent.
- Error is a failed request; degraded may be an ongoing condition with safe partial use.
- Archived records remain addressable and are not described as deleted.
- Permission denial is not “coming soon.”
- Loading never erases established page identity or context.

## Anatomy

### First use

```text
What this product does
Why it improves the business
One concrete first action
```

### Attention

```text
Problem
Evidence
Business consequence
Recommended resolution
Resolution action
```

### Degraded

```text
Available capability
Unavailable capability
Confidence or operational impact
Recovery path
```

### Error

```text
Outcome that failed
Customer-safe explanation
Retry or alternative
Optional disclosed technical reference
```

### Permission

Never reveal protected record existence through details. Explain the capability boundary and who can grant access. Preserve access to safe surrounding product context.

## Page and regional state

A whole product may be first-use, permission-blocked, or failed. Individual regions may load, degrade, or return empty results independently. Regional state should preserve healthy regions and must not escalate a partial failure into a blank full-page error.

## Async behavior

- Preserve final geometry with skeletons.
- Use `aria-busy` on the changing region.
- Announce meaningful completion once; do not narrate every skeleton.
- Disable duplicate submission during long-running actions.
- Show progress and final status for generation, publishing, sending, or execution.
- Retain entered data when retry is safe.

## Implementation mapping

- ALS: `WorkspaceEmptyState`, `WorkspaceSkeleton`, `WorkspaceErrorState`
- PPB: `ProductState`, `AttentionState`, `DegradedState`, `PermissionState`, `ArchivedState`

Feature code supplies customer language, evidence, consequence, permissions, and commands.

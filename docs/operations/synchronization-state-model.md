# Synchronization State Model

## Run statuses

| Status | Meaning |
| --- | --- |
| Succeeded | The intended scope completed without record failures |
| Partially Succeeded | Some records or capabilities succeeded and others failed |
| Failed | The intended scope did not refresh usable records |
| Skipped | The run intentionally performed no work |
| In Progress | Work is currently running |
| Never Run | No completed attempt exists |

Nine successful imports and one failure is Partially Succeeded, never Succeeded.

## Record states

Current, Pending Update, Failed Update, Orphaned, Disconnected Source, and Unknown describe individual canonical records. Provider failure never deletes last-known-good data.

## Summary anatomy

Workspace, provider connection, run ID, start/completion, discovered, created, updated, unchanged, skipped, failed, warnings, affected capabilities, and status are stored separately. Attempted, succeeded, observed, ingested, and evaluated timestamps are not collapsed.

## Failure behavior

Partial failure states what succeeded, what failed, affected records or capabilities, whether prior data remains usable, and a retry action. Disconnection preserves history, degrades freshness, blocks live-provider actions, and routes recovery to Workspace → Connected Systems.

Retry and reconnect operations require server-side workspace ownership and role authorization.

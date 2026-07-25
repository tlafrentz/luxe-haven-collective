# Connected Systems Operations

## Recovery

- `Attention needed`: review unlinked or conflicted property references.
- `Degraded`: preserve last-known data, inspect the latest synchronization result, and retry only the supported scope.
- `Authorization expired`: use the secure reconnect flow; retry cannot repair revoked credentials.
- `Disconnected`: reconnect when live updates should resume. Existing canonical properties and history remain.

Disconnect pauses future synchronization, preserves mappings, and marks linked references disconnected. Reconnect restores the existing connection record and mappings; credentials continue to be managed only by the server-side adapter.

Every configuration command includes an idempotency key and produces one bounded activity entry. Entries contain workspace, actor, target, action, result, and timestamp—never credentials, invitation tokens, provider payloads, or guest data.

## Verification

Verify owner, administrator, property-scoped member, suspended member, other-workspace, and anonymous access. Confirm that excluded properties are omitted from operational summaries while historical records remain. Confirm that repeated commands and synchronizations do not duplicate canonical properties or provider references.

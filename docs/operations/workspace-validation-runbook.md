# Workspace Validation Runbook

For identity failure, verify Profile → Owner → active Membership without substituting IDs. For ownership mismatch, locate orphan active properties and cross-workspace provider references; never invent linkage. For permission failures, verify table grants before RLS policies, then evaluate active role and property scope.

For authorization expiry, preserve last-known data, reconnect through the secure adapter, verify mappings, synchronize, and re-evaluate health. For stale or partial sync, inspect bounded run counts and affected capabilities before retrying. For notification degradation, retain in-app records and inspect bounded delivery failure codes.

Escalate when integrity cannot be repaired without changing canonical IDs, ownership, or access. Never log provider credentials, guest data, invitation tokens, or preference payloads.

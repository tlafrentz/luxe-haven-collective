# Notification Policy and Preference Resolution

```text
Domain event
  -> active membership and property relevance
  -> required platform policy
  -> workspace default
  -> allowed user override
  -> quiet hours / digest decision
  -> in-app record and delivery outbox
```

Required policy wins over defaults and overrides. Workspace defaults initialize future choices but never overwrite an existing personal record. Recipient authorization happens before generation; the target route re-authorizes again when opened.

Preference resolution is `user -> organization -> platform`, except property-specific operational timestamps retain property-timezone semantics. Default routes and property context fall back safely when access changes.

The database uses recipient-scoped RLS, active-membership checks, property-access helpers, unique preference records, and notification deduplication keys. Delivery history contains bounded failure codes, not raw provider responses or credentials.

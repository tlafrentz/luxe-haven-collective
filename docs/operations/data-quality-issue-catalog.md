# Data Quality Issue Catalog

Issue codes are stable contracts for policy, persistence, testing, telemetry, and UI mapping.

| Code | Default severity | Meaning |
| --- | --- | --- |
| `BOOKING_MISSING_PROPERTY` | Critical | No safe operating location |
| `BOOKING_INVALID_DATE_RANGE` | Critical | Arrival does not precede departure |
| `BOOKING_STATUS_DATE_CONFLICT` | Warning | Commercial state conflicts with timing |
| `BOOKING_DUPLICATE_PROVIDER_REFERENCE` | Critical | Strong provider identity is duplicated |
| `BOOKING_POTENTIAL_DUPLICATE` | Warning | Similarity requires review |
| `BOOKING_STALE` | Warning | Booking observation is overdue |
| `RESERVATION_GUEST_MISSING` | Critical | No usable primary guest |
| `RESERVATION_GUEST_PROVISIONAL` | Information | Identity is intentionally provisional |
| `RESERVATION_CONTACT_UNAVAILABLE` | Warning | No usable communication channel |
| `RESERVATION_PARTY_INCONSISTENT` | Warning | Party components conflict with total |
| `PROPERTY_TIMEZONE_MISSING` | Warning | Timing uses a fallback |
| `PROPERTY_WORKSPACE_MISMATCH` | Critical | Ownership relationship conflicts |
| `PROVIDER_REFERENCE_MISSING` | Warning | Reconciliation reference is absent |
| `PROVIDER_RECORD_CONFLICT` | Critical | Trusted material observations disagree |
| `SYNC_NEVER_COMPLETED` | Warning | No successful synchronization |
| `SYNC_STALE` | Warning | Synchronization is overdue |
| `SYNC_PARTIAL_FAILURE` | Warning | Only part of the scope refreshed |
| `SYNC_FAILED` | Critical | Latest attempt refreshed no usable scope |
| `SOURCE_DISCONNECTED` | Critical | Live provider access is unavailable |
| `PROVENANCE_INCOMPLETE` | Warning | Origin or transformation is incomplete |

## Lifecycle

Issues begin Open, may become Acknowledged, and are automatically Resolved when a later versioned evaluation no longer produces the same issue identity. Superseded and Ignored by Policy preserve history without representing active defects.

Issue identity is workspace, record type, record ID, code, and affected field. Re-evaluation is idempotent.

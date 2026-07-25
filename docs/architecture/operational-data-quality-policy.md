# Operational Data Quality Policy

**Policy ID:** `luxe-haven-operational-data-quality`  
**Version:** `1.0.0`

## Evaluation architecture

Quality describes a canonical record; it does not own or mutate it. Policies are application-level and reusable across providers.

### Dimensions

- **Freshness:** semantic time band for the consumer and operational urgency
- **Completeness:** named profile requirements, not universal percentages
- **Consistency:** deterministic relationship and value checks
- **Uniqueness:** confirmed identity versus reviewable similarity
- **Provenance:** source, external reference, observation, and transformation traceability

## Completeness profiles

`booking-list`, `booking-detail`, `guest-communication`, `guidebook-delivery`, `operational-report`, and `revenue-analysis` each declare mandatory, recommended, and irrelevant fields. Missing mandatory data is blocking; missing recommended data produces a usable gap.

`KnownValue<T>` distinguishes known—including known zero—from unknown, unavailable, not applicable, and not synchronized.

## Freshness

Thresholds vary by record and use. Arriving-today reservations use a two-hour current interval; in-stay reservations use four hours; standard bookings use six hours. Aging remains usable, stale is degraded, expired is unusable, and missing observation time is unknown. Historical reports use snapshot-appropriate thresholds.

## Consistency and identity

Policies validate dates, status/date alignment, workspace/property ownership, guest state, party totals, and source provenance. Same workspace/provider/external reservation is a confirmed duplicate. Similar property/date/name/source is only a possible duplicate and never auto-merges.

Conflict precedence is explicit user override, then source authority, then recency. Every result retains rejected observations, policy, and reason; “latest wins” is not universal.

## Versioning

Every evaluation stores policy ID, version, and evaluation time. Policy upgrades require deliberate re-evaluation. Stored historical evaluations are not silently reinterpreted.

# Live Operational Surfaces

**ID:** OP-004  
**Version:** 1.0  
**Owner:** Engineering OS  
**Status:** Implemented

## Mission

Home, Properties, Bookings, Workspace, and Executive Intelligence present one owner-scoped operational reality. No operational surface queries a provider, derives stay stage, or recalculates quality.

```text
Canonical Booking + Reservation Context + Operational Data Quality
  → OperationalSurfaceProjection
  → Home / Properties / Bookings / Workspace / Executive context
```

## Shared projection

`OperationalSurfaceProjection` composes:

- owner-scoped reservation contexts
- bounded property records
- booking quality evaluations
- latest synchronization health
- Home operational counts
- per-property reservation summaries
- canonical activity events
- reusable selector options

Provider DTOs and raw payloads remain outside the projection. Context freshness, stay stage, and quality are consumed from their canonical capabilities.

## Surface responsibilities

- **Home:** arrivals today, guests in stay, departures, open issues, synchronization, operational alerts, and recent canonical activity
- **Properties:** property status, reservations, occupancy context, connection state, last synchronization, and bounded quality
- **Bookings:** booking, guest and reservation context, synchronization, record quality, and shared Workspace/Property/Date context
- **Workspace:** real connected property, synchronization, quality, and activity summaries instead of operational sample counts
- **Executive Intelligence:** retains business interpretation while displaying the same operational evidence-quality status as Home

## Activity policy

Activity entries are projected deterministically from reservation observations, property update timestamps, and persisted synchronization summaries. They are ordered newest-first and are never static timeline fixtures.

## Security and consistency

All sources retain existing RLS and explicit owner predicates. Property connection state is derived from the owner-scoped synchronization summary and canonical booking observations, avoiding direct customer access to integration tables or raw payloads.

## Shared components

`OperationalContextBar`, `OperationalHealthSummary`, `OperationalPropertyCard`, `OperationalQualityIndicator`, `OperationalActivityTimeline`, and `OperationalDegradedState` provide consistent presentation and accessible status language.

## Boundaries

OP-004 does not implement messaging, report generation, guidebook authoring, calendar editing, revenue calculation, investment analysis, or learning changes.

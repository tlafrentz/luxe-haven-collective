# Guest and Reservation Context

**ID:** OP-002  
**Version:** 1.0  
**Owner:** Engineering OS  
**Status:** Implemented

## Mission

Reservation Context is the canonical operational projection answering: **Who is staying, where are they in the guest journey, and what context does the operator need to serve them well?**

It composes—but does not replace—the Booking, Guest, and Property ownership boundaries.

```text
Provider reservation
  → canonical Booking + lightweight Guest identity
  → owner-scoped ReservationContext projection
  → Bookings, Guest Communications, Guidebook Studio,
    Action Center, Reports, and Learning Intelligence
```

## Domain decisions

- Platform UUIDs are canonical guest identity. Provider IDs are bounded references.
- One primary guest is associated with each booking in OP-002.
- A missing provider identity creates a stable provisional or unidentified guest.
- Names alone never merge identities.
- Provider reference, exact normalized email, and exact normalized phone are strong evidence; conflicting strong evidence produces an ambiguous state.
- Party values remain nullable. Unknown is never silently converted to zero.
- Reservation status and Stay Stage remain separate concepts.

## Stay-stage policy

The canonical stages are Inquiry, Confirmed, Pre-arrival, Arriving Today, In Stay, Departing Today, Post-stay, Closed, Cancelled, No Show, and Unknown.

The policy evaluates the current instant in this order:

1. Property timezone
2. Workspace timezone
3. `America/Chicago` documented platform fallback

Fallback timing is marked as reduced confidence. The arrival day changes from Arriving Today to In Stay at the property check-in threshold. Departure remains Departing Today for the local departure date. The default post-stay window is seven days.

## Privacy and access

The application exposes three projections:

- `operational-summary`: guest and stay context without direct contact values
- `operational-contact`: direct contact points for authorized owner/admin workflows
- `privacy-reduced`: no direct contacts or provider identity references

Anonymous access and restricted contact access return the same generic unavailable error. Repository errors never include guest PII or confirm inaccessible record existence. Raw provider payloads remain in server-side integration persistence and never enter the projection.

RLS scopes `guests` and `provider_guest_references` to their profile-valued `owner_id = auth.uid()`. Booking context resolves `properties.owner_id → owners.profile_id`, and every repository query applies that same explicit authenticated-profile constraint.

## Synchronization and compatibility

The forward migration enriches existing bookings in place:

- External guest references produce deterministic, stable guest IDs.
- Records without provider guest identity receive a stable booking-derived provisional ID.
- Unique `(owner_id, provider, external_guest_id)` references make synchronization idempotent.
- Existing booking and financial identifiers are not replaced.
- Property timezone is backfilled from existing provider metadata when available.

Hospitable mapping persists party composition, language, guest freshness, and bounded identity references. Duplicate reservation protection remains the canonical booking constraint on provider and external reservation ID.

## Consumer contract

Application entry points include:

- `getReservationContext`
- `getReservationContexts`
- `searchReservationContexts`
- `getUpcomingGuestContexts`
- `getArrivingGuestContexts`
- `getInStayGuestContexts`
- `getDepartingGuestContexts`
- `buildReservationContext`
- `resolveGuestIdentity`
- `resolveStayStage`

Consumers must select the minimum projection needed and must not reconstruct stay stage, contact availability, context freshness, or identity state.

## Explicit boundaries

OP-002 does not implement a CRM, loyalty, marketing, automated messaging, identity verification, manual merging, payment profiles, or cross-workspace identity.

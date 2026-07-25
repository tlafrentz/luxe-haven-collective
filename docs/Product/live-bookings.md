# Live Bookings

**ID:** OP-001  
**Version:** 1.0  
**Owner:** Engineering OS  
**Status:** Implemented

## Mission

Bookings is the owner-scoped operational view of reservations synchronized from connected hospitality providers. It answers: **What reservations am I currently responsible for operating?**

## Architecture

```text
Provider DTO
  → provider mapper and synchronization
  → canonical booking persistence
  → owner-scoped BookingReadRepository
  → provider-neutral Booking view model
  → Bookings and downstream consumers
```

Provider APIs and raw payloads remain in integration infrastructure. Application consumers use `BookingReadRepository`, `getBookings`, `getBooking`, `searchBookings`, `getUpcomingBookings`, `getArrivalsToday`, and `getDeparturesToday`.

## Ownership and security

Booking owns reservation identity, stay, operational lifecycle, guest and financial summaries, source, property reference, and synchronization provenance. Property, owner, workspace, guest, and provider remain references.

Database RLS restricts owner access through `bookings.property_id → properties.owner_id → owners.profile_id`. The Supabase read repository requires the authenticated profile ID and applies the same canonical join to list and detail queries. Detail lookup therefore cannot retrieve a booking outside the authenticated owner scope.

## Lifecycle

Stored and provider statuses normalize to Upcoming, Arriving Today, Checked In, In Stay, Checking Out Today, Completed, or Cancelled. Dates and canonical stored status determine operational lifecycle; presentation contains no provider enum or lifecycle logic.

## Synchronization

Every view model includes a customer-facing provider label, normalized booking source, last synchronization time, and synchronization status. Supported status semantics are Current, Sync In Progress, Failed, Never Synchronized, and Stale.

## Product states

- First use or disconnected: actionable connection guidance
- Healthy: operational summary, filters, bookings, detail, recent sync
- Degraded: data age, impact, and connection recovery
- Empty result: filter guidance, distinct from first-use copy
- Loading: hierarchy-preserving skeleton
- Error: preserved-data explanation and retry

## Boundaries

Messaging, calendar editing, reservation mutation, manual creation, payments, pricing, and availability are outside OP-001.

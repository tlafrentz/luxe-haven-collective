import { describe, expect, it } from "vitest";

import { mapReservationContextRow } from "./supabase-reservation-context-repository";

describe("reservation context persistence mapping", () => {
  it("enriches existing bookings while preserving canonical and provider identity", () => {
    const source = mapReservationContextRow({
      id: "booking-1",
      property_id: "property-1",
      status: "confirmed",
      source: "Airbnb",
      external_provider: "hospitable",
      external_reservation_id: "reservation-external",
      external_guest_id: "guest-external",
      booking_code: "HM100",
      guest_full_name: "Legacy Guest",
      guest_email: null,
      guest_phone: null,
      guest_language: null,
      guests: 3,
      party_adults: 2,
      party_children: 1,
      party_infants: null,
      party_pets: 0,
      check_in: "2026-07-24",
      check_out: "2026-07-27",
      last_synced_at: "2026-07-24T14:00:00.000Z",
      guest_context_synced_at: "2026-07-24T14:00:00.000Z",
      primary_guest_id: "guest-1",
      canonical_guest: {
        id: "guest-1",
        identity_status: "resolved",
        display_name: "Canonical Guest",
        email: "guest@example.com",
        phone: null,
        language: "en",
        last_observed_at: "2026-07-24T14:00:00.000Z",
      },
      property: {
        id: "property-1",
        owner_id: "owner-1",
        name: "River District Loft",
        city: "Chicago",
        state: "IL",
        timezone: "America/Chicago",
        check_in_time: "4:00 PM",
        check_out_time: "10:00 AM",
        status: "active",
        guidebook_available: true,
        featured_image: null,
        updated_at: "2026-07-24T13:00:00.000Z",
      },
    }, "profile-1");

    expect(source).toMatchObject({
      ownerId: "profile-1",
      guestId: "guest-1",
      guestDisplayName: "Canonical Guest",
      externalGuestId: "guest-external",
      partyChildren: 1,
      propertyTimezone: "America/Chicago",
    });
  });

  it("supports partially enriched bookings as provisional context", () => {
    const source = mapReservationContextRow({
      id: "booking-2",
      property_id: "property-1",
      status: "confirmed",
      source: null,
      external_provider: null,
      external_reservation_id: null,
      external_guest_id: null,
      booking_code: null,
      guest_full_name: null,
      guest_email: null,
      guest_phone: null,
      guest_language: null,
      guests: null,
      party_adults: null,
      party_children: null,
      party_infants: null,
      party_pets: null,
      check_in: "2026-07-24",
      check_out: "2026-07-27",
      last_synced_at: null,
      guest_context_synced_at: null,
      primary_guest_id: null,
      canonical_guest: null,
      property: {
        id: "property-1",
        owner_id: "owner-1",
        name: "River District Loft",
        city: "Chicago",
        state: "IL",
        timezone: null,
        check_in_time: "4:00 PM",
        check_out_time: "10:00 AM",
        status: "active",
        guidebook_available: false,
        featured_image: null,
        updated_at: "2026-07-24T13:00:00.000Z",
      },
    }, "profile-1");

    expect(source.guestId).toBeNull();
    expect(source.partyAdults).toBeNull();
    expect(source.providerAvailable).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import type { HospitableReservation } from "../types";
import { mapHospitableReservation } from "./reservation-mapper";

function reservation(
  overrides: Partial<HospitableReservation> = {},
): HospitableReservation {
  return {
    id: "reservation-1",
    code: "HM100",
    platform: "airbnb",
    platform_id: "platform-1",
    booking_date: "2026-07-01",
    arrival_date: "2026-07-24",
    departure_date: "2026-07-27",
    check_in: null,
    check_out: null,
    nights: 3,
    stay_type: null,
    owner_stay: null,
    reservation_status: {
      current: { category: "accepted", sub_category: null },
      history: [],
    },
    conversation_id: "conversation-1",
    conversation_language: "en",
    last_message_at: null,
    notes: null,
    guests: {
      total: 3,
      adult_count: 2,
      child_count: 1,
      infant_count: 0,
      pet_count: 1,
    },
    properties: [{ id: "external-property" }] as HospitableReservation["properties"],
    listings: [],
    guest: {
      id: "external-guest",
      location: null,
      profile_picture: null,
      email: "guest@example.com",
      phone_numbers: [],
      first_name: "Avery",
      last_name: "Guest",
      language: "fr",
    },
    issue_alert: null,
    status: "accepted",
    status_history: [],
    ...overrides,
  };
}

describe("Hospitable guest context mapping", () => {
  it("retains party composition and bounded guest provenance", () => {
    const result = mapHospitableReservation({
      reservation: reservation(),
      localPropertyId: "property-1",
      syncedAt: "2026-07-24T14:00:00.000Z",
    });

    expect(result.booking).toMatchObject({
      external_guest_id: "external-guest",
      guest_language: "fr",
      party_adults: 2,
      party_children: 1,
      party_infants: 0,
      party_pets: 1,
      guest_context_synced_at: "2026-07-24T14:00:00.000Z",
    });
  });

  it("preserves unavailable party values when the provider payload is partial", () => {
    const partial = reservation();
    partial.guests = {
      ...partial.guests,
      adult_count: undefined as unknown as number,
    };
    partial.guest = null;
    const result = mapHospitableReservation({
      reservation: partial,
      localPropertyId: "property-1",
    });

    expect(result.booking.party_adults).toBeNull();
    expect(result.booking.external_guest_id).toBeNull();
  });
});

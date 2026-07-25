import { describe, expect, it } from "vitest";

import { mapBookingRow } from "./supabase-booking-read-repository";

describe("Supabase booking read mapping", () => {
  it("removes provider fields from the canonical read model", () => {
    const mapped = mapBookingRow(
      {
        id: "booking-1",
        property_id: "property-1",
        guest_full_name: "Taylor Guest",
        guest_email: "guest@example.com",
        guest_phone: null,
        guests: 3,
        check_in: "2026-07-24",
        check_out: "2026-07-27",
        total_amount: "1250.50",
        currency: "USD",
        status: "confirmed",
        source: "Airbnb",
        external_provider: "hospitable",
        booking_code: "HM123",
        last_synced_at: "2026-07-24T15:00:00.000Z",
        properties: {
          id: "property-1",
          name: "River District Loft",
          owner_id: "owner-1",
          owner: { profile_id: "profile-1" },
        },
      },
      new Date("2026-07-24T16:00:00.000Z"),
    );

    expect(mapped.status).toBe("arriving-today");
    expect(mapped.stay.nights).toBe(3);
    expect(mapped.financial.total).toBe(1250.5);
    expect(mapped.provider).toEqual({
      provider: "Connected hospitality platform",
      source: "Airbnb",
      lastSynchronizedAt: "2026-07-24T15:00:00.000Z",
      synchronizationStatus: "current",
    });
    expect(mapped).not.toHaveProperty("external_provider");
  });
});

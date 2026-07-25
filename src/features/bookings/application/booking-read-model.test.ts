import { describe, expect, it } from "vitest";

import type { Booking } from "../domain";
import {
  getBooking,
  getBookings,
  type BookingReadRepository,
} from "./booking-read-model";

function booking(
  id: string,
  status: Booking["status"],
  propertyId = "property-1",
): Booking {
  return {
    id,
    confirmationCode: `CONF-${id}`,
    property: { id: propertyId, name: `Property ${propertyId}` },
    guest: {
      name: id === "b-1" ? "Avery Guest" : "Jordan Guest",
      email: null,
      phone: null,
      partySize: 2,
    },
    stay: {
      arrival: id === "b-1" ? "2026-07-24" : "2026-08-01",
      departure: id === "b-1" ? "2026-07-27" : "2026-08-04",
      nights: 3,
    },
    status,
    financial: { total: 900, currency: "USD" },
    provider: {
      provider: "Connected hospitality platform",
      source: id === "b-1" ? "Airbnb" : "Direct",
      lastSynchronizedAt: "2026-07-24T15:00:00.000Z",
      synchronizationStatus: "current",
    },
  };
}

class OwnerScopedRepository implements BookingReadRepository {
  readonly calls: string[] = [];

  async list(ownerId: string) {
    this.calls.push(ownerId);
    return ownerId === "owner-1"
      ? [booking("b-1", "arriving-today"), booking("b-2", "upcoming", "p-2")]
      : [];
  }

  async get(ownerId: string, bookingId: string) {
    this.calls.push(ownerId);
    return ownerId === "owner-1" && bookingId === "b-1"
      ? booking("b-1", "arriving-today")
      : null;
  }
}

describe("booking read model", () => {
  it("passes owner scope to every repository query", async () => {
    const repository = new OwnerScopedRepository();

    await getBookings(repository, "owner-1");
    await getBooking(repository, "owner-1", "b-1");

    expect(repository.calls).toEqual(["owner-1", "owner-1"]);
    await expect(getBooking(repository, "owner-2", "b-1")).resolves.toBeNull();
  });

  it("filters by search, property, status, source, and stay dates", async () => {
    const repository = new OwnerScopedRepository();
    const result = await getBookings(repository, "owner-1", {
      query: "Avery",
      propertyId: "property-1",
      status: "arriving-today",
      source: "Airbnb",
      arrivalFrom: "2026-07-20",
      departureTo: "2026-07-30",
    });

    expect(result.bookings.map(({ id }) => id)).toEqual(["b-1"]);
    expect(result.health).toMatchObject({
      upcoming: 1,
      arrivingToday: 1,
      synchronizationStatus: "current",
    });
  });
});

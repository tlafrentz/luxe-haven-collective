import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BookingReadModel } from "../application";
import type { Booking } from "../domain";
import {
  buildReservationContext,
  type ReservationContextSource,
} from "@/features/reservation-context";
import {
  buildWorkspaceOperationalDataHealth,
  evaluateBookingQuality,
} from "@/platform/operational-data-quality";
import { BookingWorkspace } from "./booking-workspace";

const emptyModel: BookingReadModel = {
  bookings: [],
  properties: [],
  sources: [],
  health: {
    upcoming: 0,
    arrivingToday: 0,
    inStay: 0,
    checkingOutToday: 0,
    synchronizationStatus: "never-synchronized",
    lastSuccessfulSync: null,
  },
};

describe("BookingWorkspace", () => {
  it("renders an actionable disconnected empty state without sample data", () => {
    const html = renderToStaticMarkup(
      <BookingWorkspace
        model={emptyModel}
        filters={{}}
        selectedBooking={null}
        selectedContext={null}
      />,
    );

    expect(html).toContain("Guest reservations will appear here");
    expect(html).toContain("Manage connections");
    expect(html).not.toContain("Mesa Downtown Retreat");
  });

  it("explains degraded freshness with evidence and recovery", () => {
    const html = renderToStaticMarkup(
      <BookingWorkspace
        model={{
          ...emptyModel,
          health: {
            ...emptyModel.health,
            synchronizationStatus: "stale",
            lastSuccessfulSync: "2026-07-22T20:14:00.000Z",
          },
        }}
        filters={{}}
        selectedBooking={null}
        selectedContext={null}
      />,
    );

    expect(html).toContain("Bookings may be incomplete");
    expect(html).toContain("Review connection");
  });

  it("renders enriched guest context without exposing direct contact values", () => {
    const booking: Booking = {
      id: "booking-1",
      confirmationCode: "LH100",
      property: { id: "property-1", name: "River District Loft" },
      guest: {
        name: "Avery Guest",
        email: "avery@example.com",
        phone: "+15551234567",
        partySize: 2,
      },
      stay: {
        arrival: "2026-07-24",
        departure: "2026-07-27",
        nights: 3,
      },
      status: "arriving-today",
      financial: { total: 900, currency: "USD" },
      provider: {
        provider: "Connected hospitality platform",
        source: "Airbnb",
        lastSynchronizedAt: "2026-07-24T14:00:00.000Z",
        synchronizationStatus: "current",
      },
    };
    const context = buildReservationContext(
      contextSource(),
      new Date("2026-07-24T15:00:00.000Z"),
    );
    const quality = evaluateBookingQuality(
      {
        workspaceId: "owner-1",
        bookingId: "booking-1",
        propertyId: "property-1",
        propertyWorkspaceId: "owner-1",
        arrival: "2026-07-24",
        departure: "2026-07-27",
        status: "confirmed",
        stayStage: "arriving-today",
        observedAt: "2026-07-24T14:00:00.000Z",
        provider: "hospitable",
        externalReservationId: "external-reservation",
        guestId: "guest-1",
        guestIdentityStatus: "resolved",
        contactAvailable: true,
        partyTotal: { state: "known", value: 2 },
        providerConnected: true,
        mappingVersion: "hospitable-reservation-v1",
        profile: "booking-list",
      },
      new Date("2026-07-24T15:00:00.000Z"),
    );
    const html = renderToStaticMarkup(
      <BookingWorkspace
        model={{
          ...emptyModel,
          bookings: [booking],
          properties: [booking.property],
          sources: ["Airbnb"],
          health: {
            ...emptyModel.health,
            arrivingToday: 1,
            synchronizationStatus: "current",
            lastSuccessfulSync: "2026-07-24T14:00:00.000Z",
          },
        }}
        filters={{}}
        selectedBooking={booking}
        selectedContext={context}
        qualityByBookingId={{ "booking-1": quality }}
        qualitySummary={buildWorkspaceOperationalDataHealth([
          { product: "bookings", quality },
        ])}
      />,
    );

    expect(html).toContain("Stay stage");
    expect(html).toContain("Arriving Today");
    expect(html).toContain("2 adults");
    expect(html).toContain("Email available");
    expect(html).toContain("Source and data quality");
    expect(html).toContain("Data quality: Trusted");
    expect(html).not.toContain("avery@example.com");
    expect(html).not.toContain("+15551234567");
  });
});

function contextSource(): ReservationContextSource {
  return {
    bookingId: "booking-1",
    reservationId: "LH100",
    ownerId: "owner-1",
    bookingStatus: "confirmed",
    bookingSource: "Airbnb",
    provider: "hospitable",
    externalReservationId: "external-reservation",
    externalGuestId: "external-guest",
    guestId: "guest-1",
    guestIdentityStatus: "resolved",
    guestDisplayName: "Avery Guest",
    guestEmail: "avery@example.com",
    guestPhone: "+15551234567",
    guestLanguage: "en",
    partyAdults: 2,
    partyChildren: 0,
    partyInfants: 0,
    partyPets: 0,
    partyTotal: 2,
    propertyId: "property-1",
    propertyName: "River District Loft",
    propertyMarketLabel: "Chicago, IL",
    propertyTimezone: "America/Chicago",
    workspaceTimezone: null,
    checkInTime: "4:00 PM",
    checkoutTime: "10:00 AM",
    propertyStatus: "active",
    guidebookAvailable: true,
    primaryImage: null,
    arrivalDate: "2026-07-24",
    departureDate: "2026-07-27",
    platformMessagingAvailable: true,
    bookingObservedAt: "2026-07-24T14:00:00.000Z",
    guestObservedAt: "2026-07-24T14:00:00.000Z",
    propertyObservedAt: "2026-07-24T14:00:00.000Z",
    providerAvailable: true,
  };
}

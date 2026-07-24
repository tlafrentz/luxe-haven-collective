import { describe, expect, it } from "vitest";

import type { ReservationContext } from "@/features/reservation-context";
import {
  buildOperationalSurfaceProjection,
  filterOperationalProjection,
} from "./operational-surface-projection";

function context(
  id: string,
  stage: ReservationContext["stay"]["stage"],
  propertyId = "property-1",
  observedAt = "2026-07-24T14:00:00.000Z",
): ReservationContext {
  return {
    reservationId: `reservation-${id}`,
    bookingId: id,
    workspaceId: "owner-1",
    guest: {
      identity: {
        guestId: `guest-${id}`,
        status: "resolved",
        providerReferences: [],
      },
      name: {
        display: `Guest ${id}`,
        given: "Guest",
        family: id,
        complete: true,
      },
      language: "en",
      contactPoints: [],
    },
    party: {
      adults: 2,
      children: 0,
      infants: 0,
      pets: 0,
      totalGuests: 2,
      inconsistent: false,
    },
    property: {
      id: propertyId,
      name: `Property ${propertyId}`,
      marketLabel: "Chicago, IL",
      timezone: "America/Chicago",
      checkInTime: "4:00 PM",
      checkoutTime: "10:00 AM",
      operationalStatus: "active",
      guidebookAvailable: false,
      primaryImage: null,
    },
    stay: {
      stage,
      window: {
        arrivalDate: "2026-07-24",
        departureDate: "2026-07-27",
        checkInTime: "4:00 PM",
        checkoutTime: "10:00 AM",
        timezone: "America/Chicago",
        timezoneSource: "property",
        timingConfidence: "high",
      },
    },
    contactAvailability: {
      platformMessaging: true,
      email: false,
      sms: false,
      phone: false,
      preferredChannel: "platform-messaging",
      state: "available",
    },
    source: {
      bookingSource: "Airbnb",
      providerLabel: "Connected hospitality platform",
    },
    provenance: {
      provider: "hospitable",
      externalReservationId: `external-${id}`,
      externalGuestId: `external-guest-${id}`,
      lastObservedAt: observedAt,
    },
    freshness: {
      bookingObservedAt: observedAt,
      guestObservedAt: observedAt,
      propertyObservedAt: observedAt,
      providerAvailable: true,
      status: "current",
    },
    operationalNeeds: [],
  };
}

const properties = [
  {
    id: "property-1",
    ownerId: "owner-1",
    name: "Property property-1",
    marketLabel: "Chicago, IL",
    status: "active",
    timezone: "America/Chicago",
    lastSynchronizedAt: "2026-07-24T14:00:00.000Z",
    connectionState: "connected" as const,
    guidebookAvailable: false,
    primaryImage: null,
    updatedAt: "2026-07-24T13:00:00.000Z",
  },
  {
    id: "property-2",
    ownerId: "owner-1",
    name: "Property property-2",
    marketLabel: "Austin, TX",
    status: "active",
    timezone: "America/Chicago",
    lastSynchronizedAt: "2026-07-24T14:00:00.000Z",
    connectionState: "connected" as const,
    guidebookAvailable: false,
    primaryImage: null,
    updatedAt: "2026-07-23T13:00:00.000Z",
  },
];

const sync = {
  status: "succeeded" as const,
  providerLabel: "Connected hospitality platform",
  created: 1,
  updated: 2,
  unchanged: 0,
  failed: 0,
  warnings: [],
  affectedCapabilities: [],
  lastSuccessfulAt: "2026-07-24T14:00:00.000Z",
  providerConnected: true,
};

describe("operational surface projection", () => {
  it("tells one consistent story across Home and Properties", () => {
    const projection = buildOperationalSurfaceProjection({
      workspaceId: "owner-1",
      workspaceLabel: "Owner Workspace",
      contexts: [
        context("booking-1", "arriving-today"),
        context("booking-2", "in-stay"),
        context("booking-3", "departing-today"),
      ],
      properties,
      sync,
      now: new Date("2026-07-24T15:00:00.000Z"),
    });

    expect(projection.home).toMatchObject({
      arrivalsToday: 1,
      guestsInStay: 1,
      departuresToday: 1,
    });
    expect(projection.properties[0]).toMatchObject({
      upcomingArrivals: 1,
      currentGuests: 1,
      upcomingDepartures: 2,
    });
    expect(projection.qualityByBookingId["booking-1"]).toBeDefined();
  });

  it("orders canonical activity newest-first", () => {
    const projection = buildOperationalSurfaceProjection({
      workspaceId: "owner-1",
      workspaceLabel: "Owner Workspace",
      contexts: [
        context("older", "in-stay", "property-1", "2026-07-24T10:00:00.000Z"),
        context("newer", "arriving-today", "property-1", "2026-07-24T15:00:00.000Z"),
      ],
      properties,
      sync,
    });
    expect(projection.activity[0].occurredAt).toBe(
      "2026-07-24T15:00:00.000Z",
    );
    expect(projection.activity.map(({ id }) => id)).not.toContain("fake");
  });

  it("applies property and date context centrally", () => {
    const projection = buildOperationalSurfaceProjection({
      workspaceId: "owner-1",
      workspaceLabel: "Owner Workspace",
      contexts: [
        context("booking-1", "arriving-today"),
        context("booking-2", "in-stay", "property-2"),
      ],
      properties,
      sync,
    });
    const filtered = filterOperationalProjection(projection, {
      propertyId: "property-2",
      startDate: "2026-07-23",
      endDate: "2026-07-28",
    });
    expect(filtered.contexts.map(({ bookingId }) => bookingId)).toEqual([
      "booking-2",
    ]);
    expect(filtered.properties).toHaveLength(1);
  });
});

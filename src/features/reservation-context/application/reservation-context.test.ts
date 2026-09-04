import { describe, expect, it } from "vitest";

import {
  buildReservationContext,
  getReservationContext,
  getReservationContexts,
  projectReservationContext,
  ReservationContextAuthorizationError,
  resolveGuestIdentity,
  type ReservationContextPrincipal,
  type ReservationContextRepository,
  type ReservationContextSource,
} from "./reservation-context";

const now = new Date("2026-07-24T15:00:00.000Z");

function source(
  overrides: Partial<ReservationContextSource> = {},
): ReservationContextSource {
  return {
    bookingId: "booking-1",
    reservationId: "LH-100",
    ownerId: "owner-1",
    bookingStatus: "confirmed",
    bookingSource: "Airbnb",
    provider: "hospitable",
    externalReservationId: "provider-reservation",
    externalGuestId: "provider-guest",
    guestId: "guest-1",
    guestIdentityStatus: "resolved",
    guestDisplayName: "Avery Guest",
    guestEmail: "avery@example.com",
    guestPhone: "+15551234567",
    guestLanguage: "en",
    partyAdults: 2,
    partyChildren: null,
    partyInfants: 0,
    partyPets: 1,
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
    ...overrides,
  };
}

class Repository implements ReservationContextRepository {
  calls: string[] = [];
  constructor(private readonly records: readonly ReservationContextSource[]) {}
  async list(ownerId: string) {
    this.calls.push(ownerId);
    return this.records.filter((record) => record.ownerId === ownerId);
  }
  async get(ownerId: string, bookingId: string) {
    this.calls.push(ownerId);
    return (
      this.records.find(
        (record) =>
          record.ownerId === ownerId && record.bookingId === bookingId,
      ) ?? null
    );
  }
}

const owner: ReservationContextPrincipal = {
  userId: "owner-1",
  workspaceId: "owner-1",
  role: "owner",
};

describe("reservation context application", () => {
  it("builds guest, party, property, stay, contact, and freshness once", () => {
    const context = buildReservationContext(source(), now);
    expect(context).toMatchObject({
      workspaceId: "owner-1",
      guest: { identity: { guestId: "guest-1", status: "resolved" } },
      property: { id: "property-1", timezone: "America/Chicago" },
      stay: { stage: "arriving-today" },
      contactAvailability: { state: "available" },
      freshness: { status: "current" },
    });
    expect(context.party.children).toBeNull();
  });

  it("creates an explicit provisional guest and timing attention", () => {
    const context = buildReservationContext(
      source({
        guestId: null,
        guestIdentityStatus: null,
        externalGuestId: null,
        propertyTimezone: null,
        workspaceTimezone: null,
      }),
      now,
    );
    expect(context.guest.identity).toMatchObject({
      guestId: "provisional:booking-1",
      status: "provisional",
    });
    expect(context.operationalNeeds).toContain("timing-confidence-reduced");
  });

  it("passes owner scope to list and detail and hides cross-owner records", async () => {
    const repository = new Repository([
      source(),
      source({ bookingId: "booking-2", ownerId: "owner-2" }),
    ]);
    await expect(getReservationContexts(repository, owner, {}, undefined, now))
      .resolves.toHaveLength(1);
    await expect(
      getReservationContext(repository, owner, "booking-2", undefined, now),
    ).resolves.toBeNull();
    expect(repository.calls).toEqual(["owner-1", "owner-1"]);
  });

  it("passes the caller's profile id to the repository, not the workspace id (regression: these previously matched by coincidence in fixtures)", async () => {
    const principal: ReservationContextPrincipal = { userId: "profile-9", workspaceId: "workspace-9", role: "owner" };
    const repository = new Repository([source({ ownerId: "profile-9" })]);
    await getReservationContexts(repository, principal, {}, undefined, now);
    await getReservationContext(repository, principal, "booking-1", undefined, now);
    expect(repository.calls).toEqual(["profile-9", "profile-9"]);
  });

  it("denies anonymous and restricted contact access without confirming records", async () => {
    const repository = new Repository([source()]);
    await expect(
      getReservationContext(
        repository,
        { ...owner, userId: null },
        "booking-1",
      ),
    ).rejects.toBeInstanceOf(ReservationContextAuthorizationError);
    await expect(
      getReservationContext(
        repository,
        { ...owner, role: "cleaner" },
        "booking-1",
        "operational-contact",
      ),
    ).rejects.toThrow("Reservation context is unavailable");
  });

  it("removes contact and provider identity from privacy-reduced reports", () => {
    const projected = projectReservationContext(
      buildReservationContext(source(), now),
      "privacy-reduced",
    );
    expect(projected.guest.contactPoints).toEqual([]);
    expect(projected.guest.identity.providerReferences).toEqual([]);
    expect(projected.provenance.externalGuestId).toBeNull();
    expect(JSON.stringify(projected)).not.toContain("avery@example.com");
  });

  it("resolves only strong unambiguous identity evidence", () => {
    expect(
      resolveGuestIdentity({
        providerReferenceMatches: ["guest-1"],
        exactEmailMatches: ["guest-1"],
        exactPhoneMatches: [],
      }),
    ).toEqual({ status: "resolved", guestId: "guest-1" });
    expect(
      resolveGuestIdentity({
        providerReferenceMatches: ["guest-1"],
        exactEmailMatches: ["guest-2"],
        exactPhoneMatches: [],
      }).status,
    ).toBe("ambiguous");
    expect(
      resolveGuestIdentity({
        providerReferenceMatches: [],
        exactEmailMatches: [],
        exactPhoneMatches: [],
      }).status,
    ).toBe("provisional");
  });
});

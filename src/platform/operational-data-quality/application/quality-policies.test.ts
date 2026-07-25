import { describe, expect, it } from "vitest";

import {
  detectConflicts,
  detectPotentialDuplicates,
  evaluateBookingQuality,
  evaluateCompleteness,
  evaluateFreshness,
  mapSynchronizationRun,
} from "./quality-policies";

const now = new Date("2026-07-24T12:00:00.000Z");

describe("operational quality policies", () => {
  it.each([
    ["2026-07-24T10:00:00.000Z", "current"],
    ["2026-07-24T05:00:00.000Z", "aging"],
    ["2026-07-23T00:00:00.000Z", "stale"],
    ["2026-07-20T00:00:00.000Z", "expired"],
    [null, "unknown"],
  ] as const)("maps freshness %s to %s", (observedAt, band) => {
    expect(evaluateFreshness(observedAt, now).band).toBe(band);
  });

  it("uses more demanding arrival freshness", () => {
    const observedAt = "2026-07-24T09:00:00.000Z";
    expect(evaluateFreshness(observedAt, now).band).toBe("current");
    expect(
      evaluateFreshness(observedAt, now, "booking:arriving-today").band,
    ).toBe("aging");
  });

  it("preserves a known zero while identifying unknown mandatory data", () => {
    const complete = evaluateCompleteness(
      {
        bookingId: { state: "known", value: "b-1" },
        workspaceId: { state: "known", value: "w-1" },
        propertyId: { state: "known", value: "p-1" },
        arrival: { state: "known", value: "2026-07-24" },
        departure: { state: "known", value: "2026-07-25" },
        status: { state: "known", value: "confirmed" },
        providerReference: { state: "known", value: "r-1" },
        guestId: { state: "known", value: "g-1" },
        partyTotal: { state: "known", value: 0 },
      },
      "booking-list",
    );
    expect(complete.status).toBe("trusted");
    expect(
      evaluateCompleteness(
        {
          bookingId: { state: "known", value: "b-1" },
          workspaceId: { state: "unknown" },
        },
        "booking-list",
      ).mandatoryGaps,
    ).toContain("workspaceId");
  });

  it("evaluates dates, ownership, guest, contact, party and provenance deterministically", () => {
    const quality = evaluateBookingQuality(
      {
        workspaceId: "owner-1",
        bookingId: "booking-1",
        propertyId: "property-1",
        propertyWorkspaceId: "owner-2",
        arrival: "2026-07-27",
        departure: "2026-07-24",
        status: "completed",
        stayStage: "in-stay",
        observedAt: null,
        provider: null,
        externalReservationId: null,
        guestIdentityStatus: "unidentified",
        contactAvailable: false,
        partyInconsistent: true,
        propertyTimezoneConfidence: "reduced",
        providerConnected: false,
        mappingVersion: null,
      },
      now,
    );
    expect(quality.status).toBe("unusable");
    expect(quality.policyVersion).toBe("1.0.0");
    expect(quality.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "BOOKING_INVALID_DATE_RANGE",
        "PROPERTY_WORKSPACE_MISMATCH",
        "RESERVATION_GUEST_MISSING",
        "RESERVATION_CONTACT_UNAVAILABLE",
        "RESERVATION_PARTY_INCONSISTENT",
        "PROPERTY_TIMEZONE_MISSING",
        "SOURCE_DISCONNECTED",
      ]),
    );
  });

  it("keeps optional guest gaps usable for a booking list", () => {
    const quality = evaluateBookingQuality(
      {
        workspaceId: "owner-1",
        bookingId: "booking-1",
        propertyId: "property-1",
        propertyWorkspaceId: "owner-1",
        arrival: "2026-07-25",
        departure: "2026-07-27",
        status: "confirmed",
        observedAt: "2026-07-24T11:00:00.000Z",
        provider: "hospitable",
        externalReservationId: "reservation-1",
        guestId: null,
        guestIdentityStatus: "provisional",
        contactAvailable: true,
        providerConnected: true,
        mappingVersion: "hospitable-reservation-v1",
        profile: "booking-list",
      },
      now,
    );
    expect(quality.status).toBe("usable-with-gaps");
    expect(quality.issues).toContainEqual(
      expect.objectContaining({ code: "RESERVATION_GUEST_PROVISIONAL" }),
    );
  });
});

describe("duplicates and conflicts", () => {
  const base = {
    workspaceId: "owner-1",
    provider: "hospitable",
    propertyId: "property-1",
    arrival: "2026-07-24",
    departure: "2026-07-27",
    normalizedGuestName: "avery guest",
    source: "Airbnb",
  };

  it("separates confirmed provider identity from possible similarity", () => {
    const result = detectPotentialDuplicates([
      { ...base, bookingId: "b-1", externalReservationId: "r-1" },
      { ...base, bookingId: "b-2", externalReservationId: "r-1" },
      { ...base, bookingId: "b-3", externalReservationId: "r-2" },
    ]);
    expect(result.confirmed).toContainEqual(["b-1", "b-2"]);
    expect(result.possible).toContainEqual(["b-1", "b-3"]);
  });

  it("uses user override then authority and retains rejected observations", () => {
    const result = detectConflicts([
      {
        value: "2026-07-27",
        sourceType: "provider",
        authority: 10,
        observedAt: "2026-07-24T10:00:00.000Z",
        reference: "provider-1",
      },
      {
        value: "2026-07-28",
        sourceType: "user",
        authority: 1,
        observedAt: "2026-07-23T10:00:00.000Z",
        reference: "override-1",
      },
    ]);
    expect(result.conflicted).toBe(true);
    expect(result.chosen?.value).toBe("2026-07-28");
    expect(result.policy).toBe("explicit-user-override");
    expect(result.rejected).toHaveLength(1);
  });
});

describe("synchronization result policy", () => {
  it.each([
    [{ status: null, processed: 0, failed: 0 }, "never-run"],
    [{ status: "running", processed: 0, failed: 0 }, "in-progress"],
    [{ status: "completed", processed: 9, failed: 1 }, "partially-succeeded"],
    [{ status: "failed", processed: 0, failed: 1 }, "failed"],
    [{ status: "completed", processed: 10, failed: 0 }, "succeeded"],
  ] as const)("maps %o to %s", (input, expected) => {
    expect(mapSynchronizationRun(input)).toBe(expected);
  });
});

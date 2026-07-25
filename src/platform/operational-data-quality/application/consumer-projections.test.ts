import { describe, expect, it } from "vitest";

import {
  buildExecutiveInputQuality,
  buildReportSourceQuality,
  buildRevenueEvidenceQuality,
  evaluateCommunicationChannelSupport,
} from "./consumer-projections";
import { evaluateBookingQuality } from "./quality-policies";

function degradedQuality() {
  return evaluateBookingQuality(
    {
      workspaceId: "owner-1",
      bookingId: "booking-1",
      propertyId: "property-1",
      propertyWorkspaceId: "owner-1",
      arrival: "2026-07-25",
      departure: "2026-07-27",
      status: "confirmed",
      observedAt: "2026-07-20T00:00:00.000Z",
      provider: "hospitable",
      externalReservationId: "reservation-1",
      guestId: "guest-1",
      guestIdentityStatus: "resolved",
      contactAvailable: false,
      partyTotal: { state: "known", value: 2 },
      providerConnected: true,
      mappingVersion: "v1",
      profile: "booking-list",
    },
    new Date("2026-07-24T12:00:00.000Z"),
  );
}

describe("quality-aware downstream projections", () => {
  it("marks revenue evidence insufficient without changing measured facts", () => {
    expect(buildRevenueEvidenceQuality(degradedQuality())).toMatchObject({
      sufficient: false,
      qualityStatus: "unusable",
    });
  });

  it("distinguishes executive input degradation from business performance", () => {
    expect(
      buildExecutiveInputQuality(degradedQuality())
        .distinguishFromBusinessPerformance,
    ).toBe(true);
  });

  it("publishes report limitations without guest contact data", () => {
    const projection = buildReportSourceQuality(degradedQuality());
    expect(projection.incomplete).toBe(false);
    expect(JSON.stringify(projection)).not.toMatch(/email|phone/i);
  });

  it("prevents unsupported guest communication actions", () => {
    expect(
      evaluateCommunicationChannelSupport(degradedQuality(), false),
    ).toEqual({
      supported: false,
      reason: "No supported guest contact channel is available.",
    });
  });
});

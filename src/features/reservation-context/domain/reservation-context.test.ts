import { describe, expect, it } from "vitest";

import {
  evaluateContactAvailability,
  evaluateContextFreshness,
  normalizeGuestName,
  normalizeReservationParty,
  resolvePropertyTimezone,
  resolveStayStage,
  type StayWindow,
} from "./reservation-context";

const window: StayWindow = {
  arrivalDate: "2026-07-24",
  departureDate: "2026-07-27",
  checkInTime: "4:00 PM",
  checkoutTime: "10:00 AM",
  timezone: "America/Chicago",
  timezoneSource: "property",
  timingConfidence: "high",
};

describe("stay-stage policy", () => {
  it.each([
    ["2026-07-24T19:00:00.000Z", "arriving-today"],
    ["2026-07-24T22:00:00.000Z", "in-stay"],
    ["2026-07-26T16:00:00.000Z", "in-stay"],
    ["2026-07-27T16:00:00.000Z", "departing-today"],
    ["2026-07-29T16:00:00.000Z", "post-stay"],
    ["2026-08-10T16:00:00.000Z", "closed"],
  ] as const)("uses property-local boundaries at %s", (at, expected) => {
    expect(
      resolveStayStage({
        status: "confirmed",
        window,
        now: new Date(at),
      }),
    ).toBe(expected);
  });

  it("keeps exceptional commercial states separate", () => {
    expect(resolveStayStage({ status: "cancelled", window })).toBe("cancelled");
    expect(resolveStayStage({ status: "no-show", window })).toBe("no-show");
    expect(resolveStayStage({ status: "unknown", window })).toBe("unknown");
  });

  it("uses workspace then documented platform fallback with reduced confidence", () => {
    expect(
      resolvePropertyTimezone({
        propertyTimezone: "Invalid/Timezone",
        workspaceTimezone: "America/New_York",
      }),
    ).toEqual({
      timezone: "America/New_York",
      timezoneSource: "workspace",
      timingConfidence: "reduced",
    });
    expect(resolvePropertyTimezone({}).timezoneSource).toBe(
      "platform-fallback",
    );
  });
});

describe("guest operational policies", () => {
  it("normalizes names without treating the name as identity", () => {
    expect(normalizeGuestName({ given: "  Avery ", family: " Guest " })).toEqual({
      display: "Avery Guest",
      given: "Avery",
      family: "Guest",
      complete: true,
    });
    expect(normalizeGuestName({})).toMatchObject({
      display: "Guest",
      complete: false,
    });
  });

  it("preserves unknown party values and diagnoses inconsistent totals", () => {
    expect(
      normalizeReservationParty({
        adults: 2,
        children: null,
        totalGuests: 3,
      }).children,
    ).toBeNull();
    expect(
      normalizeReservationParty({
        adults: 2,
        children: 1,
        infants: 1,
        totalGuests: 3,
      }).inconsistent,
    ).toBe(true);
  });

  it("separates contact availability from contact values", () => {
    expect(
      evaluateContactAvailability({
        platformMessaging: true,
        email: null,
        phone: null,
      }),
    ).toMatchObject({
      state: "available",
      platformMessaging: true,
      email: false,
    });
  });

  it("evaluates freshness per context source", () => {
    expect(
      evaluateContextFreshness({
        bookingObservedAt: "2026-07-24T15:00:00.000Z",
        guestObservedAt: "2026-07-22T15:00:00.000Z",
        propertyObservedAt: "2026-07-24T15:00:00.000Z",
        providerAvailable: true,
        now: new Date("2026-07-24T16:00:00.000Z"),
      }).status,
    ).toBe("stale");
  });
});

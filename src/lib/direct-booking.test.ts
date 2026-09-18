import { describe, expect, it } from "vitest";
import { isDirectBookingEnabled } from "./direct-booking";

describe("isDirectBookingEnabled", () => {
  it("is false for a property with no metadata", () => {
    expect(isDirectBookingEnabled({ metadata: null })).toBe(false);
  });

  it("is false when the flag is absent or falsy", () => {
    expect(isDirectBookingEnabled({ metadata: {} })).toBe(false);
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: false } })).toBe(false);
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: "true" } })).toBe(false);
  });

  it("is true only for an exact boolean true flag", () => {
    expect(isDirectBookingEnabled({ metadata: { direct_booking_enabled: true } })).toBe(true);
  });
});

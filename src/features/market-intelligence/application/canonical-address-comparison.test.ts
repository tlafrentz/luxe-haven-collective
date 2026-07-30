import { describe, expect, it } from "vitest";
import { areCanonicalAddressesCompatible } from "./canonical-address-comparison";

describe("canonical address comparison", () => {
  it("accepts common suffix and directional variants", () => {
    expect(areCanonicalAddressesCompatible(
      "3108 North Bideker Avenue, Fort Worth, TX 76105",
      "3108 N Bideker Ave, Fort Worth, TX 76105",
    )).toBe(true);
  });

  it.each([
    "3108 bideker ave., FORT WORTH, tx 76105",
    "3108 BIDEKER AVENUE, Fort-Worth, TX 76105-1234",
    "3108 Bideker Ave, Fort Worth, TX, 76105",
  ])("accepts punctuation, casing, and ZIP+4 variation: %s", (candidate) => {
    expect(areCanonicalAddressesCompatible(
      "3108 Bideker Avenue, Fort Worth, TX 76105",
      candidate,
    )).toBe(true);
  });

  it.each([
    ["4108 Bideker Ave, Fort Worth, TX 76105", "house number"],
    ["3108 Bideker Ave, Dallas, TX 76105", "city"],
    ["3108 Bideker Ave, Fort Worth, AZ 76105", "state"],
    ["3108 Bideker Ave, Fort Worth, TX 76104", "postal code"],
    ["3108 Avenue H, Fort Worth, TX 76105", "street"],
  ])("rejects an incompatible %s", (candidate) => {
    expect(areCanonicalAddressesCompatible(
      "3108 Bideker Avenue, Fort Worth, TX 76105",
      candidate,
    )).toBe(false);
  });
});

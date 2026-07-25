import { describe, expect, it } from "vitest";

import {
  OrganizationValidationError,
  evaluateOrganizationCompleteness,
} from "../domain";
import { isIanaTimezone, normalizeOrganizationInput } from "./organization-input";

const valid = {
  displayName: "  Luxe Haven Collective  ",
  legalName: " Luxe Haven LLC ",
  description: " Hospitality management ",
  website: "luxehaven.example/about",
  logoUrl: "https://cdn.example/logo.png",
  businessEmail: "hello@example.com",
  businessPhone: "+1 (480) 555-0100",
  preferredContactMethod: "email",
  address: {
    line1: " 100 Main St ",
    line2: "",
    city: " Phoenix ",
    region: " AZ ",
    postalCode: " 85001 ",
    country: "us",
  },
  timezone: "America/Phoenix",
  currency: "usd",
  language: "en-US",
  country: "us",
};

describe("Organization input", () => {
  it("trims text, structures the address, and normalizes standards", () => {
    expect(normalizeOrganizationInput(valid)).toEqual({
      displayName: "Luxe Haven Collective",
      legalName: "Luxe Haven LLC",
      description: "Hospitality management",
      website: "https://luxehaven.example/about",
      logoUrl: "https://cdn.example/logo.png",
      businessEmail: "hello@example.com",
      businessPhone: "+1 (480) 555-0100",
      preferredContactMethod: "email",
      address: {
        line1: "100 Main St",
        line2: undefined,
        city: "Phoenix",
        region: "AZ",
        postalCode: "85001",
        country: "US",
      },
      timezone: "America/Phoenix",
      currency: "USD",
      language: "en-US",
      country: "US",
    });
  });

  it("normalizes missing URL schemes and rejects unsafe schemes", () => {
    expect(normalizeOrganizationInput(valid).website).toBe(
      "https://luxehaven.example/about",
    );
    expect(() =>
      normalizeOrganizationInput({ ...valid, website: "javascript:alert(1)" }),
    ).toThrow(OrganizationValidationError);
  });

  it("validates IANA timezones rather than numeric offsets", () => {
    expect(isIanaTimezone("America/Chicago")).toBe(true);
    expect(isIanaTimezone("-0700")).toBe(false);
    expect(() =>
      normalizeOrganizationInput({ ...valid, timezone: "-0700" }),
    ).toThrow(OrganizationValidationError);
  });

  it.each([
    ["currency", "US"],
    ["language", "english"],
    ["country", "USA"],
  ])("rejects invalid %s codes", (field, value) => {
    expect(() =>
      normalizeOrganizationInput({ ...valid, [field]: value }),
    ).toThrow(OrganizationValidationError);
  });
});

describe("Organization completeness", () => {
  const base = {
    workspaceId: "owner-1",
    ownerId: "owner-1",
    profileId: "profile-1",
    displayName: "Luxe Haven",
    timezone: "America/Phoenix",
    currency: "USD",
    language: "en-US",
    country: "US",
    revision: 0,
    updatedAt: "2026-07-25T09:00:00Z",
  };

  it("distinguishes defaulted required values from confirmed values", () => {
    const completeness = evaluateOrganizationCompleteness({
      profile: { ...base, confirmedFields: [] },
    });
    expect(completeness.status).toBe("incomplete");
    expect(completeness.missingRequired).toContain("Timezone");
  });

  it("marks required confirmed values complete while recommendations remain attention", () => {
    const completeness = evaluateOrganizationCompleteness({
      profile: {
        ...base,
        confirmedFields: ["displayName", "timezone", "currency", "language", "country"],
      },
    });
    expect(completeness.status).toBe("needs-attention");
    expect(completeness.missingRequired).toEqual([]);
    expect(completeness.missingRecommended).toContain("Business email");
  });
});

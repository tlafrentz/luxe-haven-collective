import { describe, expect, it } from "vitest";
import type { MarketProperty } from "../domain/property-resolution";
import { ProviderType } from "../domain/enums/provider-type";
import { buildMarketComparableSearchCriteria } from "./build-market-comparable-search-criteria";

const date = new Date("2026-07-21T12:00:00.000Z");
const subject: MarketProperty = { id: "subject-1", providerReferences: [{ provider: ProviderType.RentCast, externalId: "provider-subject" }], address: { formatted: "123 Main St, Mesa, AZ 85201", addressLine1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201" }, characteristics: { propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1800 }, financialFacts: {} };

describe("buildMarketComparableSearchCriteria", () => {
  it("materializes stable subject-derived and system defaults", () => {
    expect(buildMarketComparableSearchCriteria(subject, "sale-valuation", {}, date)).toEqual({ radiusMiles: 5, limit: 15, propertyTypes: ["Single Family"], bedroomRange: { minimum: 2, maximum: 4 }, bathroomRange: { minimum: 1, maximum: 3 }, squareFeetRange: { minimum: 1440, maximum: 2160 }, occurredAfter: new Date("2025-07-21T00:00:00.000Z"), listingStatuses: ["active", "inactive", "sold"] });
  });

  it("uses active listings by default for long-term rent", () => expect(buildMarketComparableSearchCriteria(subject, "long-term-rent", {}, date).listingStatuses).toEqual(["active"]));
  it("gives explicit criteria precedence", () => expect(buildMarketComparableSearchCriteria(subject, "sale-valuation", { radiusMiles: 2, limit: 7, bedroomRange: { minimum: 1, maximum: 5 }, propertyTypes: ["Condo"] }, date)).toMatchObject({ radiusMiles: 2, limit: 7, bedroomRange: { minimum: 1, maximum: 5 }, propertyTypes: ["Condo"] }));
  it.each([0, -1, 26, Number.NaN])("rejects invalid radius %s", (radiusMiles) => expect(() => buildMarketComparableSearchCriteria(subject, "sale-valuation", { radiusMiles }, date)).toThrow("radius"));
  it.each([0, 26, 1.5])("rejects invalid limit %s", (limit) => expect(() => buildMarketComparableSearchCriteria(subject, "sale-valuation", { limit }, date)).toThrow("limit"));
  it.each([["bedroomRange", { minimum: 3, maximum: 2 }], ["bathroomRange", { minimum: -1, maximum: 2 }], ["squareFeetRange", { minimum: 0, maximum: 1000 }]] as const)("rejects invalid %s", (key, range) => expect(() => buildMarketComparableSearchCriteria(subject, "sale-valuation", { [key]: range }, date)).toThrow("range"));
  it("rejects future cutoff", () => expect(() => buildMarketComparableSearchCriteria(subject, "sale-valuation", { occurredAfter: new Date("2027-01-01") }, date)).toThrow("future"));
  it("does not mutate input and freezes output", () => { const input = { propertyTypes: ["Townhouse", "Condo"] }; const before = structuredClone(input); const result = buildMarketComparableSearchCriteria(subject, "sale-valuation", input, date); expect(input).toEqual(before); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.propertyTypes)).toBe(true); });
});

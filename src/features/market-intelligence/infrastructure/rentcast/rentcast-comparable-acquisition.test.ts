import { describe, expect, it, vi } from "vitest";
import type { MarketComparableSearchCriteria, MarketPropertyProviderSubject } from "../../domain/comparable-acquisition";
import { ProviderType } from "../../domain/enums/provider-type";
import { ProviderErrorCode } from "../../application/providers/provider-error";
import { RentCastClient } from "./rentcast-client";
import { RentCastComparableProvider } from "./rentcast-comparable-provider";

const subject: MarketPropertyProviderSubject = { id: "subject", providerReferences: [{ provider: ProviderType.RentCast, externalId: "subject-external" }], address: { formatted: "123 Main St, Mesa, AZ 85201" }, characteristics: { propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1800 }, coordinates: { latitude: 33.4, longitude: -111.8 } };
const criteria: MarketComparableSearchCriteria = { radiusMiles: 5, limit: 10, propertyTypes: ["Single Family"], bedroomRange: { minimum: 2, maximum: 4 }, bathroomRange: { minimum: 1, maximum: 3 }, squareFeetRange: { minimum: 1400, maximum: 2200 }, occurredAfter: new Date("2025-07-21"), listingStatuses: ["active"] };
const record = { id: "comp-1", formattedAddress: "125 Main St, Mesa, AZ 85201", addressLine1: "125 Main St", city: "Mesa", state: "AZ", zipCode: "85201", propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFootage: 1750, latitude: 33.41, longitude: -111.8, price: 425000, status: "Active", listedDate: "2026-06-01T00:00:00.000Z", distance: 0.2 };

function createProvider(body: unknown, status = 200, capture?: (url: string) => void): RentCastComparableProvider {
  const fetchImplementation = vi.fn(async (input: string | URL | Request) => { capture?.(String(input)); return new Response(JSON.stringify(body), { status }); }) as typeof fetch;
  return new RentCastComparableProvider({ client: new RentCastClient({ apiKey: "test", fetchImplementation }) });
}

describe("RentCast comparable acquisition", () => {
  it("maps all sale AVM comparable records", async () => { let url = ""; const result = await createProvider({ comparables: [record, { ...record, id: "comp-2" }] }, 200, (value) => { url = value; }).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result.ok).toBe(true); if (!result.ok) throw result.error; expect(result.data.candidates).toHaveLength(2); expect(result.data.candidates[0]).toMatchObject({ externalId: "comp-1", price: 425000, sourceRank: 1 }); expect(url).toContain("/avm/value"); expect(url).toContain("compCount=10"); });
  it("maps long-term rental AVM prices as neutral price facts", async () => { let url = ""; const result = await createProvider({ rent: 2500, comparables: [{ ...record, price: 2450 }] }, 200, (value) => { url = value; }).acquireComparables({ subject, purpose: "long-term-rent", criteria }); expect(result.ok).toBe(true); if (!result.ok) throw result.error; expect(result.data.candidates[0]?.price).toBe(2450); expect(url).toContain("/avm/rent/long-term"); expect(result.data.candidates[0]).not.toHaveProperty("averageDailyRate"); });
  it("treats an empty comparable array as success", async () => { const result = await createProvider({ comparables: [] }).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result).toMatchObject({ ok: true, data: { candidates: [] } }); });
  it("preserves partial records rather than silently filtering them", async () => { const result = await createProvider({ comparables: [{ id: "partial", formattedAddress: "9 Oak Rd, Mesa, AZ 85201" }] }).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result.ok).toBe(true); if (!result.ok) throw result.error; expect(result.data.candidates).toHaveLength(1); expect(result.data.candidates[0]?.bedrooms).toBeUndefined(); });
  it("rejects malformed collections", async () => { const result = await createProvider({ comparables: {} }).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected failure"); expect(result.error.code).toBe(ProviderErrorCode.InvalidResponse); });
  it("rejects unrepresentable records rather than dropping them", async () => { const result = await createProvider({ comparables: [{ formattedAddress: "No id" }] }).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected failure"); expect(result.error.code).toBe(ProviderErrorCode.InvalidResponse); });
  it.each([[401, ProviderErrorCode.AuthenticationFailed], [429, ProviderErrorCode.RateLimited], [503, ProviderErrorCode.Unavailable]] as const)("normalizes HTTP %s", async (status, code) => { const result = await createProvider({}, status).acquireComparables({ subject, purpose: "sale-valuation", criteria }); expect(result.ok).toBe(false); if (result.ok) throw new Error("Expected failure"); expect(result.error.code).toBe(code); });
});

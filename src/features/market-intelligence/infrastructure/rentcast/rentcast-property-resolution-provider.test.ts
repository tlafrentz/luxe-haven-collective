import { describe, expect, it, vi } from "vitest";
import { ProviderErrorCode } from "../../application/providers/provider-error";
import { RentCastClient } from "./rentcast-client";
import { RentCastPropertyProvider } from "./rentcast-property-provider";

const lookup = { address: { streetAddress: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201" } } as const;

function response(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

function provider(body: unknown, status = 200): RentCastPropertyProvider {
  return new RentCastPropertyProvider({ client: new RentCastClient({ apiKey: "test-key", fetchImplementation: response(body, status) }) });
}

describe("RentCastPropertyProvider property resolution", () => {
  it("maps every returned record to neutral candidates and preserves external ids", async () => {
    const result = await provider([
      { id: "rentcast-1", formattedAddress: "123 Main St, Mesa, AZ 85201", addressLine1: "123 Main St", city: "Mesa", state: "AZ", zipCode: "85201", propertyType: "Single Family" },
      { id: "rentcast-2", formattedAddress: "123 Main St Unit 2, Mesa, AZ 85201", addressLine1: "123 Main St Unit 2", city: "Mesa", state: "AZ", zipCode: "85201", propertyType: "Condo" },
    ]).lookupPropertyCandidates(lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.data.candidates.map((item) => item.externalId)).toEqual(["rentcast-1", "rentcast-2"]);
    expect(result.data.candidates[0]?.property.address.city).toBe("Mesa");
    expect(result.data.retrievedAt).toBeInstanceOf(Date);
  });

  it("returns a successful empty candidate collection for a legitimate empty response", async () => {
    const result = await provider([]).lookupPropertyCandidates(lookup);
    expect(result).toMatchObject({ ok: true, data: { candidates: [] } });
  });

  it("returns invalid-response when a record lacks required identity", async () => {
    const result = await provider([{ formattedAddress: "123 Main St, Mesa, AZ" }]).lookupPropertyCandidates(lookup);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error.code).toBe(ProviderErrorCode.InvalidResponse);
  });

  it("returns invalid-response when the provider payload is not a collection", async () => {
    const result = await provider({ property: "unexpected" }).lookupPropertyCandidates(lookup);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error.code).toBe(ProviderErrorCode.InvalidResponse);
  });

  it.each([[401, ProviderErrorCode.AuthenticationFailed], [429, ProviderErrorCode.RateLimited], [503, ProviderErrorCode.Unavailable]] as const)("normalizes HTTP %s", async (status, code) => {
    const result = await provider({}, status).lookupPropertyCandidates(lookup);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error.code).toBe(code);
  });
});

import { describe, expect, it, vi } from "vitest";
import { PropertyRecord } from "../domain/entities/property-record";
import { ProviderType } from "../domain/enums/provider-type";
import { ConfidenceScore } from "../domain/value-objects/confidence-score";
import { DataProvenance } from "../domain/value-objects/data-provenance";
import type { MarketPropertyLookupAddress } from "../domain/property-resolution";
import { ProviderError, ProviderErrorCode } from "./providers/provider-error";
import { providerFailure, providerSuccess } from "./providers/provider-result";
import type { MarketPropertyResolutionProvider } from "./providers/market-property-resolution-provider";
import { normalizeMarketAddress } from "./normalize-market-address";
import { resolveMarketProperty } from "./resolve-market-property";

const requestedAt = new Date("2026-07-21T15:00:00.000Z");
const retrievedAt = new Date("2026-07-21T14:59:00.000Z");
const address: MarketPropertyLookupAddress = { streetAddress: "123 Main Street", city: "Mesa", state: "Arizona", postalCode: "85201-1234" };

function property(id = "provider-1", overrides: Partial<ConstructorParameters<typeof PropertyRecord>[2]> = {}, addressOverrides: Partial<ConstructorParameters<typeof PropertyRecord>[1]> = {}): PropertyRecord {
  return new PropertyRecord(id, { formatted: "123 Main St, Mesa, AZ 85201", addressLine1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201", country: "US", ...addressOverrides }, { propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1700, yearBuilt: 2001, ...overrides }, {}, new DataProvenance(ProviderType.RentCast, retrievedAt, new ConfidenceScore(90), 1, "provider fact", "v1"), { latitude: 33.4, longitude: -111.8 });
}

function provider(records: readonly PropertyRecord[]): MarketPropertyResolutionProvider {
  return { lookupPropertyCandidates: vi.fn(async () => providerSuccess({ provider: ProviderType.RentCast, retrievedAt, candidates: records.map((item) => ({ externalId: item.id, property: item })) })) };
}

function command(inputAddress = address) {
  return { address: inputAddress, context: { resolutionId: "resolution-1", requestedAt, requestedBy: "operator-1" } } as const;
}

describe("normalizeMarketAddress", () => {
  it("normalizes state, postal code, whitespace, and street suffix", () => {
    const normalized = normalizeMarketAddress({ streetAddress: " 123   Main Street ", city: " Mesa ", state: "arizona", postalCode: "85201-1234" });
    expect(normalized.comparisonKey).toBe("123 main st|mesa|AZ|85201|");
    expect(normalized.display.addressLine1).toBe("123   Main Street");
  });

  it("preserves unit identity", () => {
    expect(normalizeMarketAddress({ ...address, streetAddress: "123 Main St Unit 4B" }).unit).toBe("4b");
  });

  it.each([["streetAddress", "Street address"], ["city", "City"], ["state", "State"], ["postalCode", "Postal code"]] as const)("requires %s", (key, label) => {
    expect(() => normalizeMarketAddress({ ...address, [key]: " " })).toThrow(`${label} is required.`);
  });
});

describe("resolveMarketProperty", () => {
  it("resolves an exact provider-independent property with generic provider reference", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property()]) });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error("Expected resolution");
    expect(result.property.id).toBe("market-property:resolution-1");
    expect(result.property.providerReferences).toEqual([{ provider: ProviderType.RentCast, externalId: "provider-1" }]);
    expect(result.confidence).toMatchObject({ score: 100, level: "high" });
  });

  it("accepts a safely normalized street suffix", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property()]) });
    expect(result.status).toBe("resolved");
  });

  it("returns not-found for an empty candidate set", async () => {
    expect((await resolveMarketProperty(command(), { provider: provider([]) })).status).toBe("not-found");
  });

  it("returns not-found for a city mismatch", async () => {
    expect((await resolveMarketProperty(command(), { provider: provider([property("x", {}, { city: "Phoenix" })]) })).status).toBe("not-found");
  });

  it("returns not-found for a postal-code mismatch", async () => {
    expect((await resolveMarketProperty(command(), { provider: provider([property("x", {}, { postalCode: "85001" })]) })).status).toBe("not-found");
  });

  it("does not resolve a different unit", async () => {
    const unitAddress = { ...address, streetAddress: "123 Main St Unit 4B" };
    const result = await resolveMarketProperty(command(unitAddress), { provider: provider([property("x", {}, { addressLine1: "123 Main St Unit 5B", formatted: "123 Main St Unit 5B, Mesa, AZ 85201" })]) });
    expect(result.status).toBe("not-found");
  });

  it("returns ambiguous for equivalent candidates instead of selecting the first", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property("b"), property("a")]) });
    expect(result.status).toBe("ambiguous");
    expect(result.alternatives.map((item) => item.property.providerReferences[0]?.externalId)).toEqual(["a", "b"]);
  });

  it("is independent of provider candidate ordering", async () => {
    const first = await resolveMarketProperty(command(), { provider: provider([property("b"), property("a")]) });
    const second = await resolveMarketProperty(command(), { provider: provider([property("a"), property("b")]) });
    expect(second).toEqual(first);
  });

  it("returns unsupported for a resolved commercial property", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property("x", { propertyType: "Commercial" })]) });
    expect(result.status).toBe("unsupported");
  });

  it("creates explicit gaps for incomplete provider facts", async () => {
    const incomplete = new PropertyRecord("x", { formatted: "123 Main St, Mesa, AZ 85201", addressLine1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201" }, {}, {}, new DataProvenance(ProviderType.RentCast, retrievedAt, new ConfidenceScore(60)));
    const result = await resolveMarketProperty(command(), { provider: provider([incomplete]) });
    expect(result.dataGaps.map((item) => item.code)).toEqual(["PROPERTY_TYPE_MISSING", "BEDROOM_COUNT_MISSING", "BATHROOM_COUNT_MISSING", "SQUARE_FOOTAGE_MISSING", "YEAR_BUILT_MISSING", "COORDINATES_MISSING"]);
  });

  it("preserves deterministic provenance and time", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property()]) });
    expect(result.provenance[0]).toMatchObject({ provider: ProviderType.RentCast, externalId: "provider-1", normalizationVersion: "v1" });
    expect(result.resolvedAt).toEqual(requestedAt);
  });

  it("propagates provider failures rather than calling them not-found", async () => {
    const error = new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.Unavailable, message: "Unavailable" });
    const failing: MarketPropertyResolutionProvider = { lookupPropertyCandidates: async () => providerFailure(error) };
    await expect(resolveMarketProperty(command(), { provider: failing })).rejects.toBe(error);
  });

  it("does not mutate the command or provider property", async () => {
    const input = command();
    const source = property();
    const before = structuredClone({ address: input.address, characteristics: source.characteristics });
    await resolveMarketProperty(input, { provider: provider([source]) });
    expect({ address: input.address, characteristics: source.characteristics }).toEqual(before);
  });

  it("returns a deeply frozen result", async () => {
    const result = await resolveMarketProperty(command(), { provider: provider([property()]) });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.normalizedAddress.display)).toBe(true);
    expect(Object.isFrozen(result.provenance)).toBe(true);
    if (result.status === "resolved") expect(Object.isFrozen(result.property.characteristics)).toBe(true);
  });

  it("validates deterministic context", async () => {
    await expect(resolveMarketProperty({ ...command(), context: { resolutionId: " ", requestedAt } }, { provider: provider([]) })).rejects.toThrow("Market property resolution id is required.");
  });
});

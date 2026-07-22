import type {
  MarketProperty, MarketPropertyDataGap, MarketPropertyLookupAddress,
  MarketPropertyObservationProvenance, MarketPropertyResolutionConfidence,
  MarketPropertyResolutionResult,
} from "../domain/property-resolution";
import type { MarketPropertyProviderCandidate, MarketPropertyResolutionProvider } from "./providers/market-property-resolution-provider";
import { normalizeMarketAddress } from "./normalize-market-address";
import { resolveMarketPropertyCandidates } from "./resolve-market-property-candidates";

export interface MarketPropertyResolutionContext {
  readonly resolutionId: string;
  readonly requestedAt: Date;
  readonly requestedBy?: string;
}

export interface ResolveMarketPropertyCommand {
  readonly address: MarketPropertyLookupAddress;
  readonly context: MarketPropertyResolutionContext;
}

export interface ResolveMarketPropertyDependencies {
  readonly provider: MarketPropertyResolutionProvider;
}

export async function resolveMarketProperty(
  command: ResolveMarketPropertyCommand,
  dependencies: ResolveMarketPropertyDependencies,
): Promise<MarketPropertyResolutionResult> {
  validateCommand(command);
  const requestedAddress = cloneAddress(command.address);
  const normalizedAddress = normalizeMarketAddress(requestedAddress);
  const providerResult = await dependencies.provider.lookupPropertyCandidates({ address: requestedAddress });
  if (!providerResult.ok) throw providerResult.error;

  const canonical = (candidate: MarketPropertyProviderCandidate): MarketProperty => toMarketProperty(command.context.resolutionId, candidate);
  const resolution = resolveMarketPropertyCandidates(normalizedAddress, providerResult.data.candidates, canonical);
  const provenance = buildProvenance(providerResult.data.candidates, providerResult.data.provider, providerResult.data.retrievedAt);
  const base = {
    resolutionId: command.context.resolutionId,
    requestedAddress,
    normalizedAddress,
    alternatives: resolution.status === "resolved" ? resolution.alternatives : resolution.alternatives,
    confidence: confidenceFor(resolution.status, resolution.status === "resolved" ? resolution.candidate.matchScore : resolution.alternatives[0]?.matchScore),
    dataGaps: Object.freeze([]) as readonly MarketPropertyDataGap[],
    provenance,
    resolvedAt: new Date(command.context.requestedAt.getTime()),
  };

  if (resolution.status !== "resolved") {
    const gaps = normalizedAddress.unit
      ? [gap("UNIT_UNRESOLVED", "The supplied unit could not be resolved to one property.", "blocking", "address.unit")]
      : [];
    return deepFreeze({ ...base, status: resolution.status, dataGaps: gaps });
  }

  if (!isSupportedPropertyType(resolution.candidate.property.characteristics.propertyType)) {
    return deepFreeze({ ...base, status: "unsupported" as const, alternatives: [resolution.candidate, ...resolution.alternatives], dataGaps: buildDataGaps(resolution.candidate.property, providerResult.data.retrievedAt) });
  }

  return deepFreeze({
    ...base,
    status: "resolved" as const,
    property: resolution.candidate.property,
    dataGaps: buildDataGaps(resolution.candidate.property, providerResult.data.retrievedAt),
  });
}

function validateCommand(command: ResolveMarketPropertyCommand): void {
  if (!command.context.resolutionId.trim()) throw new Error("Market property resolution id is required.");
  if (Number.isNaN(command.context.requestedAt.getTime())) throw new Error("Market property resolution time must be valid.");
}

function cloneAddress(address: MarketPropertyLookupAddress): MarketPropertyLookupAddress {
  return Object.freeze({ streetAddress: address.streetAddress, city: address.city, state: address.state, postalCode: address.postalCode, ...(address.countryCode === undefined ? {} : { countryCode: address.countryCode }) });
}

function toMarketProperty(resolutionId: string, candidate: MarketPropertyProviderCandidate): MarketProperty {
  const source = candidate.property;
  return {
    id: `market-property:${resolutionId}`,
    providerReferences: [{ provider: source.provenance.provider, externalId: candidate.externalId }],
    address: { ...source.address }, characteristics: { ...source.characteristics },
    financialFacts: { ...source.financialFacts, ...(source.financialFacts.lastSaleDate ? { lastSaleDate: new Date(source.financialFacts.lastSaleDate.getTime()) } : {}) },
    ...(source.coordinates ? { coordinates: { ...source.coordinates } } : {}),
  };
}

function buildProvenance(candidates: readonly MarketPropertyProviderCandidate[], provider: MarketPropertyObservationProvenance["provider"], retrievedAt?: Date): readonly MarketPropertyObservationProvenance[] {
  return Object.freeze([...candidates].sort((a, b) => a.externalId.localeCompare(b.externalId)).map((candidate) => ({
    provider, externalId: candidate.externalId,
    retrievedAt: retrievedAt ? new Date(retrievedAt.getTime()) : undefined,
    sampleSize: candidate.property.provenance.sampleSize,
    notes: candidate.property.provenance.notes,
    normalizationVersion: candidate.property.provenance.version,
  })));
}

function buildDataGaps(property: MarketProperty, retrievedAt?: Date): readonly MarketPropertyDataGap[] {
  const gaps: MarketPropertyDataGap[] = [];
  if (!property.characteristics.propertyType) gaps.push(gap("PROPERTY_TYPE_MISSING", "Property type was not supplied by the provider.", "material", "propertyType"));
  if (property.characteristics.bedrooms === undefined) gaps.push(gap("BEDROOM_COUNT_MISSING", "Bedroom count was not supplied by the provider.", "material", "bedrooms"));
  if (property.characteristics.bathrooms === undefined) gaps.push(gap("BATHROOM_COUNT_MISSING", "Bathroom count was not supplied by the provider.", "material", "bathrooms"));
  if (property.characteristics.squareFeet === undefined) gaps.push(gap("SQUARE_FOOTAGE_MISSING", "Square footage was not supplied by the provider.", "material", "squareFeet"));
  if (property.characteristics.yearBuilt === undefined) gaps.push(gap("YEAR_BUILT_MISSING", "Year built was not supplied by the provider.", "informational", "yearBuilt"));
  if (!property.coordinates) gaps.push(gap("COORDINATES_MISSING", "Coordinates were not supplied by the provider.", "material", "coordinates"));
  if (!retrievedAt) gaps.push(gap("PROVIDER_TIMESTAMP_MISSING", "The provider retrieval timestamp is unavailable.", "informational", "retrievedAt"));
  return Object.freeze(gaps);
}

function gap(code: MarketPropertyDataGap["code"], description: string, severity: MarketPropertyDataGap["severity"], sourceField: string): MarketPropertyDataGap {
  return Object.freeze({ code, description, severity, sourceField });
}

function confidenceFor(status: "resolved" | "ambiguous" | "not-found", score = 0): MarketPropertyResolutionConfidence {
  const level = status === "resolved" ? (score >= 95 ? "high" : score >= 80 ? "medium" : "low") : status === "ambiguous" ? "low" : "none";
  return Object.freeze({ score: status === "not-found" ? 0 : score, level, reasons: Object.freeze([status === "resolved" ? "One candidate met the deterministic address policy." : status === "ambiguous" ? "Multiple candidates had equivalent match quality." : "No candidate met the minimum address threshold."]) });
}

function isSupportedPropertyType(value?: string): boolean {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return !["land", "commercial", "industrial", "office", "agricultural"].some((type) => normalized.includes(type));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

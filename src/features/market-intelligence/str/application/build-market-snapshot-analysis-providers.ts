import type { MarketComparableProvider } from "../../application/providers/market-comparable-provider";
import type { MarketPropertyResolutionProvider } from "../../application/providers/market-property-resolution-provider";
import { providerSuccess } from "../../application/providers/provider-result";
import { PropertyRecord } from "../../domain/entities/property-record";
import { ProviderType } from "../../domain/enums/provider-type";
import type { SubjectProperty } from "../../domain/subject-property";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { DataProvenance } from "../../domain/value-objects/data-provenance";
import type { StrMarketSnapshot } from "../domain";

export function buildMarketSnapshotAnalysisProviders(input: {
  readonly subjectProperty: SubjectProperty;
  readonly marketSnapshot?: StrMarketSnapshot;
}): Readonly<{
  propertyProvider: MarketPropertyResolutionProvider;
  comparableProvider: MarketComparableProvider;
}> {
  const subject = input.subjectProperty;
  const retrievedAt = input.marketSnapshot ? new Date(input.marketSnapshot.createdAt) : subject.retrievedAt;
  const property = new PropertyRecord(
    subject.id,
    {
      formatted: value(subject.address.formatted) ?? "Canonical subject property",
      addressLine1: value(subject.address.street),
      city: value(subject.address.city),
      state: value(subject.address.state),
      postalCode: value(subject.address.postalCode),
      country: "US",
    },
    {
      propertyType: value(subject.physical.propertyType),
      bedrooms: value(subject.physical.bedrooms),
      bathrooms: value(subject.physical.bathrooms),
      squareFeet: value(subject.physical.livingAreaSquareFeet),
      lotSquareFeet: value(subject.physical.lotSizeSquareFeet),
      yearBuilt: value(subject.physical.yearBuilt),
    },
    {
      estimatedValue: value(subject.listing.listPrice),
      lastSalePrice: value(subject.listing.lastSalePrice),
      ...(value(subject.listing.lastSaleDate) ? { lastSaleDate: new Date(value(subject.listing.lastSaleDate)!) } : {}),
    },
    new DataProvenance(
      ProviderType.RealtyApi,
      subject.retrievedAt,
      new ConfidenceScore(Math.round(subject.confidence.score)),
      1,
      "Canonical RealtyAPI subject property snapshot.",
      subject.providerVersion,
    ),
    value(subject.address.latitude) !== undefined && value(subject.address.longitude) !== undefined
      ? { latitude: value(subject.address.latitude)!, longitude: value(subject.address.longitude)! }
      : undefined,
  );

  return {
    propertyProvider: {
      lookupPropertyCandidates: async () => providerSuccess({
        provider: ProviderType.RealtyApi,
        retrievedAt: subject.retrievedAt,
        candidates: [{ externalId: subject.providerPropertyId, property }],
      }),
    },
    comparableProvider: {
      acquireComparables: async (request) => providerSuccess({
        provider: ProviderType.Internal,
        purpose: request.purpose,
        retrievedAt,
        // The legacy analysis contract models sale/LTR comparables. STR evidence
        // remains canonical on the snapshot and is never recast as a provider DTO.
        candidates: [],
      }),
    },
  };
}

function value<T>(field: { readonly value: T | null }): T | undefined {
  return field.value ?? undefined;
}

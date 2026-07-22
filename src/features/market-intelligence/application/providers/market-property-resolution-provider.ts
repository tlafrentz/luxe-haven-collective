import type { PropertyRecord } from "../../domain/entities/property-record";
import type { MarketPropertyLookupAddress } from "../../domain/property-resolution";
import type { ProviderType } from "../../domain/enums/provider-type";
import type { ProviderResult } from "./provider-result";

export interface MarketPropertyProviderCandidate {
  readonly externalId: string;
  readonly property: PropertyRecord;
}

export interface MarketPropertyProviderResult {
  readonly provider: ProviderType;
  readonly candidates: readonly MarketPropertyProviderCandidate[];
  readonly retrievedAt?: Date;
}

export interface MarketPropertyResolutionProvider {
  lookupPropertyCandidates(
    request: Readonly<{ address: MarketPropertyLookupAddress }>,
  ): Promise<ProviderResult<MarketPropertyProviderResult>>;
}

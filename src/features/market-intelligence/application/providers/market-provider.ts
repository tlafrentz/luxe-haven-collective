import type {
  DataProvenance,
} from "../../domain/value-objects/data-provenance";

export interface MarketObservationResult<T> {
  readonly value: T;
  readonly provenance: DataProvenance;
}

export interface MarketSearchRequest {
  readonly address: string;
}

export interface ComparableSearchRequest {
  readonly latitude: number;

  readonly longitude: number;

  readonly radiusMiles?: number;
}

export interface MarketProvider {
  searchMarket(
    request: MarketSearchRequest,
  ): Promise<void>;

  getMarketProfile(
    request: MarketSearchRequest,
  ): Promise<void>;

  getComparables(
    request: ComparableSearchRequest,
  ): Promise<void>;

  getObservations(
    request: MarketSearchRequest,
  ): Promise<
    readonly MarketObservationResult<unknown>[]
  >;
}

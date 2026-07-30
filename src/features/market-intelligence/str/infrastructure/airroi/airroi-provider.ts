import type { StrMarketIntelligenceProvider, StrProviderResult } from "../../domain";
import { AirRoiClient } from "./airroi-client";
import type { AirRoiComparableDto, AirRoiRevenueDto } from "./airroi-types";
import { mapAirRoiRequest } from "./airroi-request-mapper";
import { mapAirRoiComparables, mapAirRoiRevenue } from "./airroi-response-mapper";
import type { AirRoiConfig } from "./airroi-config";

export class AirRoiProvider implements StrMarketIntelligenceProvider {
  constructor(private readonly client: AirRoiClient, private readonly config: AirRoiConfig, private readonly now: () => Date = () => new Date()) {}
  async retrieve(query: Parameters<StrMarketIntelligenceProvider["retrieve"]>[0], context: Parameters<StrMarketIntelligenceProvider["retrieve"]>[1]): Promise<StrProviderResult> {
    const parameters = mapAirRoiRequest(query, query.filters?.radiusMiles ?? this.config.defaultRadiusMiles);
    const revenueResult: PromiseSettledResult<Awaited<ReturnType<AirRoiClient["get"]>>> = await Promise.resolve(
      this.client.get<AirRoiRevenueDto>("revenue-estimate", "/calculator/estimate", calculatorParameters(parameters), context.correlationId),
    ).then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason }));
    const envelope = await this.client.get<readonly AirRoiComparableDto[] | { listings?: readonly AirRoiComparableDto[]; comparables?: readonly AirRoiComparableDto[] }>("comparables", "/listings/comparables", comparableParameters(parameters), context.correlationId);
    const payload = envelope.data;
    const collection = payload && !Array.isArray(payload)
      ? payload as { listings?: readonly AirRoiComparableDto[]; comparables?: readonly AirRoiComparableDto[] }
      : undefined;
    const comparableEnvelope = {
      ...envelope,
      data: (Array.isArray(payload) ? payload : collection?.listings ?? collection?.comparables ?? []).map(normalizeComparable),
    };
    const retrievedAt = this.now().toISOString(); const evidence = []; const warnings: string[] = [];
    let revenueEstimate;
    if (revenueResult.status === "fulfilled" && revenueResult.value.data) {
      const mapped = mapAirRoiRevenue(revenueResult.value.data, { snapshotId: context.snapshotId, retrievedAt, requestId: revenueResult.value.request_id });
      revenueEstimate = mapped.value; evidence.push(...mapped.evidence);
    } else warnings.push("Revenue estimate is unavailable.");
    warnings.push("Aggregated market metrics are unavailable; property estimates and comparable listings were synced.");
    const comparableMapping = mapAirRoiComparables(comparableEnvelope.data, { snapshotId: context.snapshotId, retrievedAt, requestId: comparableEnvelope.request_id, currency: revenueEstimate?.currency });
    evidence.push(...comparableMapping.evidence);
    if (!comparableMapping.values.length) warnings.push("No comparable listings were returned.");
    return {
      providerVersion: "airroi-api.v1", providerSnapshotReferences: [revenueResult.status === "fulfilled" ? revenueResult.value.request_id : undefined,
        comparableEnvelope.request_id].filter((value): value is string => Boolean(value)),
      revenueEstimate, comparables: comparableMapping.values, evidence, warnings,
      appliedFilters: [`providerRankedComparables:true`, `entirePlaceOnly:${query.filters?.entirePlaceOnly ?? false}`, `maximumComparableCount:${query.filters?.maximumComparableCount ?? this.config.maxComparables}`],
    };
  }
}

function calculatorParameters(parameters: ReturnType<typeof mapAirRoiRequest>) {
  return { lat: parameters.lat, lng: parameters.lng, bedrooms: parameters.bedrooms, baths: parameters.baths, guests: parameters.guests, currency: parameters.currency };
}

function comparableParameters(parameters: ReturnType<typeof mapAirRoiRequest>) {
  return { latitude: parameters.latitude, longitude: parameters.longitude, bedrooms: parameters.bedrooms, baths: parameters.baths, guests: parameters.guests, currency: parameters.currency };
}

function normalizeComparable(value: AirRoiComparableDto): AirRoiComparableDto {
  const row = value as Record<string, unknown>;
  const listing = object(row.listing_info) ?? object(row.listing) ?? {};
  const performance = object(row.performance) ?? object(row.metrics) ?? {};
  const location = object(row.location) ?? {};
  return {
    ...value,
    id: value.id ?? value.listing_id ?? listing.listing_id ?? listing.id,
    listing_url: value.listing_url ?? listing.listing_url ?? listing.url,
    latitude: value.latitude ?? location.latitude,
    longitude: value.longitude ?? location.longitude,
    property_type: value.property_type ?? listing.property_type ?? listing.listing_type,
    bedrooms: value.bedrooms ?? listing.bedrooms,
    bathrooms: value.bathrooms ?? listing.bathrooms ?? listing.baths,
    accommodates: value.accommodates ?? listing.accommodates ?? listing.guests,
    room_type: value.room_type ?? listing.room_type,
    amenities: value.amenities ?? listing.amenities,
    adr: value.adr ?? performance.adr ?? performance.average_daily_rate,
    occupancy: value.occupancy ?? value.occupancy_rate ?? performance.occupancy ?? performance.occupancy_rate,
    annual_revenue: value.annual_revenue ?? performance.annual_revenue ?? performance.revenue,
    active_days: value.active_days ?? performance.active_days,
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

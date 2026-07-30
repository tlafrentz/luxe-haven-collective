import type { StrMarketIntelligenceProvider, StrProviderResult } from "../../domain";
import { AirRoiClient } from "./airroi-client";
import type { AirRoiComparableDto, AirRoiMarketDto, AirRoiRevenueDto } from "./airroi-types";
import { mapAirRoiRequest } from "./airroi-request-mapper";
import { mapAirRoiComparables, mapAirRoiMarket, mapAirRoiRevenue } from "./airroi-response-mapper";
import type { AirRoiConfig } from "./airroi-config";

export class AirRoiProvider implements StrMarketIntelligenceProvider {
  constructor(private readonly client: AirRoiClient, private readonly config: AirRoiConfig, private readonly now: () => Date = () => new Date()) {}
  async retrieve(query: Parameters<StrMarketIntelligenceProvider["retrieve"]>[0], context: Parameters<StrMarketIntelligenceProvider["retrieve"]>[1]): Promise<StrProviderResult> {
    const parameters = mapAirRoiRequest(query, query.filters?.radiusMiles ?? this.config.defaultRadiusMiles);
    const [revenueResult, marketResult] = await Promise.allSettled([
      this.client.get<AirRoiRevenueDto>("revenue-estimate", "/v1/revenue-estimate", parameters, context.correlationId),
      this.client.get<AirRoiMarketDto>("market-metrics", "/v1/market-metrics", parameters, context.correlationId),
    ]);
    const comparableEnvelopes = []; let radius = parameters.radius_miles;
    while (true) {
      const envelope = await this.client.get<readonly AirRoiComparableDto[]>("comparables", "/v1/comparables", { ...parameters, radius_miles: radius }, context.correlationId);
      comparableEnvelopes.push(envelope);
      if ((envelope.data?.length ?? 0) >= this.config.minComparables || radius >= this.config.maxRadiusMiles) break;
      radius = Math.min(this.config.maxRadiusMiles, Math.max(radius + 2, radius * 2));
    }
    const retrievedAt = this.now().toISOString(); const evidence = []; const warnings: string[] = [];
    let revenueEstimate; let marketMetrics; let seasonality;
    if (revenueResult.status === "fulfilled" && revenueResult.value.data) {
      const mapped = mapAirRoiRevenue(revenueResult.value.data, { snapshotId: context.snapshotId, retrievedAt, requestId: revenueResult.value.request_id });
      revenueEstimate = mapped.value; evidence.push(...mapped.evidence);
    } else warnings.push("Revenue estimate is unavailable.");
    if (marketResult.status === "fulfilled" && marketResult.value.data) {
      const mapped = mapAirRoiMarket(marketResult.value.data, { snapshotId: context.snapshotId, retrievedAt, requestId: marketResult.value.request_id });
      marketMetrics = mapped.metrics; seasonality = mapped.seasonality; evidence.push(...mapped.evidence);
    } else warnings.push("Market metrics are unavailable.");
    const finalComparables = comparableEnvelopes.at(-1)!;
    const comparableMapping = mapAirRoiComparables(finalComparables.data ?? [], { snapshotId: context.snapshotId, retrievedAt, requestId: finalComparables.request_id, currency: revenueEstimate?.currency });
    evidence.push(...comparableMapping.evidence);
    if (!comparableMapping.values.length) warnings.push("No comparable listings were returned.");
    return {
      providerVersion: "airroi-api.v1", providerSnapshotReferences: [revenueResult.status === "fulfilled" ? revenueResult.value.request_id : undefined,
        marketResult.status === "fulfilled" ? marketResult.value.request_id : undefined, ...comparableEnvelopes.map((item) => item.request_id)].filter((value): value is string => Boolean(value)),
      revenueEstimate, marketMetrics, seasonality, comparables: comparableMapping.values, evidence, warnings,
      appliedFilters: [`radiusMiles:${radius}`, `entirePlaceOnly:${parameters.entire_place ?? false}`, `maximumComparableCount:${parameters.limit ?? this.config.maxComparables}`],
    };
  }
}

import { createHash } from "node:crypto";
import type { StrComparable, StrEvidence, StrMarketMetrics, StrRevenueEstimate, StrSeasonality } from "../../domain";
import { STR_DERIVATION_VERSION, STR_MAPPING_VERSION } from "../../domain";
import type { AirRoiComparableDto, AirRoiMarketDto, AirRoiRevenueDto } from "./airroi-types";
import { AirRoiError } from "./airroi-errors";

const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const occupancy = (value: unknown): number | undefined => {
  const parsed = number(value); if (parsed === undefined) return undefined;
  const normalized = parsed <= 1 ? parsed * 100 : parsed;
  return normalized >= 0 && normalized <= 100 ? normalized : undefined;
};
const money = (amount: number | undefined, currency: string) => amount === undefined ? undefined : { amount, currency };
const evidenceId = (snapshotId: string, operation: string, metric: string, reference = "") =>
  `stre_${createHash("sha256").update(`${snapshotId}:${operation}:${metric}:${reference}`).digest("hex").slice(0, 24)}`;

function evidence(input: { snapshotId: string; operation: string; retrievedAt: string; metric?: string; reference?: string; requestId?: string; derived?: boolean; sourceEvidenceIds?: readonly string[] }): StrEvidence {
  return {
    id: evidenceId(input.snapshotId, input.operation, input.metric ?? "response", input.reference), provider: "airroi",
    sourceOperation: input.operation, retrievedAt: input.retrievedAt, ...(input.requestId ? { providerRequestId: input.requestId } : {}),
    ...(input.reference ? { providerReferenceId: input.reference } : {}), ...(input.metric ? { rawMetricName: input.metric } : {}),
    mappingVersion: STR_MAPPING_VERSION, sourceSnapshotId: input.snapshotId,
    derivation: input.derived ? "luxe-haven-derived" : "provider-supplied",
    ...(input.sourceEvidenceIds ? { sourceEvidenceIds: input.sourceEvidenceIds, calculationVersion: STR_DERIVATION_VERSION } : {}),
  };
}

export function mapAirRoiRevenue(dto: AirRoiRevenueDto, context: { snapshotId: string; retrievedAt: string; requestId?: string }): { value: StrRevenueEstimate; evidence: readonly StrEvidence[] } {
  const currency = text(dto.currency) ?? "USD"; const adr = number(dto.adr); const occ = occupancy(dto.occupancy);
  let revPar = number(dto.revpar); let annual = number(dto.annual_revenue); let monthly = number(dto.monthly_revenue);
  const values = { adr, occupancy: occ, revPar, annualRevenue: annual, monthlyRevenue: monthly };
  if (Object.values(values).every((value) => value === undefined)) throw new AirRoiError({ code: "invalid-response", message: "STR revenue response contains no valid metrics." });
  const items: StrEvidence[] = []; const lineage: Record<string, { value: { amount: number; currency: string } | { value: number }; evidenceId: string; derivation: "provider-supplied" | "luxe-haven-derived" }> = {};
  for (const [key, raw] of Object.entries(values)) if (raw !== undefined) {
    const metric = key === "annualRevenue" ? "annual_revenue" : key === "monthlyRevenue" ? "monthly_revenue" : key === "revPar" ? "revpar" : key;
    const item = evidence({ ...context, operation: "revenue-estimate", metric }); items.push(item);
    lineage[key] = { value: key === "occupancy" ? { value: raw } : { amount: raw, currency }, evidenceId: item.id, derivation: "provider-supplied" };
  }
  if (revPar === undefined && adr !== undefined && occ !== undefined) {
    revPar = adr * occ / 100; const sources = [lineage.adr.evidenceId, lineage.occupancy.evidenceId];
    const item = evidence({ ...context, operation: "revenue-estimate", metric: "revpar", derived: true, sourceEvidenceIds: sources }); items.push(item);
    lineage.revPar = { value: { amount: revPar, currency }, evidenceId: item.id, derivation: "luxe-haven-derived" };
  }
  if (annual === undefined && adr !== undefined && occ !== undefined) {
    annual = adr * occ / 100 * 365; const sources = [lineage.adr.evidenceId, lineage.occupancy.evidenceId];
    const item = evidence({ ...context, operation: "revenue-estimate", metric: "annual_revenue", derived: true, sourceEvidenceIds: sources }); items.push(item);
    lineage.annualRevenue = { value: { amount: annual, currency }, evidenceId: item.id, derivation: "luxe-haven-derived" };
  }
  if (monthly === undefined && annual !== undefined) {
    monthly = annual / 12; const sourceId = lineage.annualRevenue.evidenceId;
    const item = evidence({ ...context, operation: "revenue-estimate", metric: "monthly_revenue", derived: true, sourceEvidenceIds: [sourceId] }); items.push(item);
    lineage.monthlyRevenue = { value: { amount: monthly, currency }, evidenceId: item.id, derivation: "luxe-haven-derived" };
  }
  const providerConfidence = number(dto.confidence); const score = providerConfidence === undefined ? 65 : providerConfidence <= 1 ? providerConfidence * 100 : providerConfidence;
  return { value: {
    projectedAnnualRevenue: money(annual, currency), projectedMonthlyRevenue: money(monthly, currency), projectedAdr: money(adr, currency),
    projectedOccupancy: occ === undefined ? undefined : { value: occ }, projectedRevPar: money(revPar, currency), currency,
    period: { ...(text(dto.period_start) ? { startDate: text(dto.period_start) } : {}), ...(text(dto.period_end) ? { endDate: text(dto.period_end) } : {}),
      basis: ["trailing", "forecast", "provider-estimate"].includes(text(dto.period_basis) ?? "") ? text(dto.period_basis) as "trailing" | "forecast" | "provider-estimate" : "unknown" },
    confidence: { score: Math.round(score), level: score >= 80 ? "high" : score >= 55 ? "moderate" : "low" },
    evidenceIds: items.map((item) => item.id), metricLineage: lineage,
  }, evidence: items };
}

export function mapAirRoiComparables(dtos: readonly AirRoiComparableDto[], context: { snapshotId: string; retrievedAt: string; requestId?: string; currency?: string }): { values: readonly StrComparable[]; evidence: readonly StrEvidence[] } {
  const allEvidence: StrEvidence[] = [];
  const values = dtos.flatMap((dto) => {
    const listingId = text(dto.id); if (!listingId) return [];
    const item = evidence({ ...context, operation: "comparables", reference: listingId }); allEvidence.push(item);
    const missingFields = ["latitude", "longitude", "property_type", "bedrooms", "bathrooms", "adr", "occupancy", "active_days"].filter((field) => dto[field as keyof AirRoiComparableDto] === undefined);
    const currency = context.currency ?? "USD"; const amenities = Array.isArray(dto.amenities) ? dto.amenities.filter((value): value is string => typeof value === "string") : [];
    return [{
      id: `strc_${createHash("sha256").update(`airroi:${listingId}`).digest("hex").slice(0, 24)}`,
      providerReference: { provider: "airroi", listingId, ...(text(dto.url) ? { listingUrl: text(dto.url) } : {}) },
      location: { ...(number(dto.latitude) !== undefined ? { latitude: number(dto.latitude) } : {}), ...(number(dto.longitude) !== undefined ? { longitude: number(dto.longitude) } : {}),
        ...(number(dto.distance_miles) !== undefined ? { distanceMiles: number(dto.distance_miles) } : {}), ...(text(dto.market) ? { marketLabel: text(dto.market) } : {}) },
      property: { ...(text(dto.property_type) ? { propertyType: text(dto.property_type) } : {}), ...(number(dto.bedrooms) !== undefined ? { bedrooms: number(dto.bedrooms) } : {}),
        ...(number(dto.bathrooms) !== undefined ? { bathrooms: number(dto.bathrooms) } : {}), ...(number(dto.accommodates) !== undefined ? { accommodates: number(dto.accommodates) } : {}),
        ...(text(dto.room_type) ? { roomType: text(dto.room_type) } : {}), amenities },
      performance: { adr: money(number(dto.adr), currency), ...(occupancy(dto.occupancy) !== undefined ? { occupancy: { value: occupancy(dto.occupancy)! } } : {}),
        revPar: money(number(dto.revpar), currency), annualRevenue: money(number(dto.annual_revenue), currency),
        ...(number(dto.length_of_stay) !== undefined ? { lengthOfStay: number(dto.length_of_stay) } : {}), ...(number(dto.active_days) !== undefined ? { activeDays: number(dto.active_days) } : {}),
        ...(number(dto.review_count) !== undefined ? { reviewCount: number(dto.review_count) } : {}), ...(number(dto.rating) !== undefined ? { rating: number(dto.rating) } : {}) },
      retrievedAt: context.retrievedAt, sourceOperation: "comparables", sourceSnapshotId: context.snapshotId, freshness: "fresh" as const,
      missingFields, evidenceIds: [item.id], eligibility: "eligible" as const, similarityScore: 0, evidenceQualityScore: 0, weight: 0, exclusionReasons: [],
    } satisfies StrComparable];
  });
  return { values, evidence: allEvidence };
}

export function mapAirRoiMarket(dto: AirRoiMarketDto, context: { snapshotId: string; retrievedAt: string; requestId?: string }): { metrics?: StrMarketMetrics; seasonality?: StrSeasonality; evidence: readonly StrEvidence[] } {
  const currency = text(dto.currency) ?? "USD"; const items: StrEvidence[] = [];
  const metricValues = { adr: number(dto.adr), occupancy: occupancy(dto.occupancy), revPar: number(dto.revpar), activeListingSupply: number(dto.active_listings), demandIndex: number(dto.demand_index), revenueGrowthPercentage: number(dto.revenue_growth) };
  for (const [metric, value] of Object.entries(metricValues)) if (value !== undefined) items.push(evidence({ ...context, operation: "market-metrics", metric }));
  const metrics = items.length ? { adr: money(metricValues.adr, currency), ...(metricValues.occupancy !== undefined ? { occupancy: { value: metricValues.occupancy } } : {}),
    revPar: money(metricValues.revPar, currency), activeListingSupply: metricValues.activeListingSupply, demandIndex: metricValues.demandIndex,
    ...(metricValues.revenueGrowthPercentage !== undefined ? { revenueGrowthPercentage: { value: metricValues.revenueGrowthPercentage } } : {}), evidenceIds: items.map((item) => item.id) } : undefined;
  const monthly = Array.isArray(dto.monthly) ? dto.monthly.flatMap((row) => {
    const month = number(row.month); if (!month || month < 1 || month > 12) return [];
    return [{ month, adr: money(number(row.adr), currency), ...(occupancy(row.occupancy) !== undefined ? { occupancy: { value: occupancy(row.occupancy)! } } : {}),
      revenue: money(number(row.revenue), currency), index: number(row.index) }];
  }) : [];
  let seasonality: StrSeasonality | undefined;
  if (monthly.length) {
    const seasonEvidence = evidence({ ...context, operation: "market-metrics", metric: "monthly_seasonality" }); items.push(seasonEvidence);
    const ranked = [...monthly].filter((item) => item.index !== undefined).sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
    seasonality = { monthly, peakMonths: ranked.slice(0, 3).map((item) => item.month), lowMonths: ranked.slice(-3).map((item) => item.month), evidenceIds: [seasonEvidence.id] };
  }
  return { metrics, seasonality, evidence: items };
}

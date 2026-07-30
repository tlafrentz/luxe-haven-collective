export const STR_MARKET_SNAPSHOT_SCHEMA_VERSION = "str-market-snapshot.v1";
export const STR_MAPPING_VERSION = "airroi.v1";
export const STR_COMPARABLE_POLICY_VERSION = "str-comparables.v1";
export const STR_DERIVATION_VERSION = "str-metrics.v1";

export interface Money { readonly amount: number; readonly currency: string }
export interface Percentage { readonly value: number }

export interface StrMarketQuery {
  readonly subjectPropertyId: string;
  readonly subjectPropertySnapshotId: string;
  readonly location: { readonly latitude: number; readonly longitude: number };
  readonly property: {
    readonly propertyType?: string;
    readonly bedrooms?: number;
    readonly bathrooms?: number;
    readonly accommodates?: number;
    readonly entirePlace?: boolean;
    readonly amenities?: readonly string[];
    readonly currency?: string;
  };
  readonly filters?: {
    readonly radiusMiles?: number;
    readonly minimumBedrooms?: number;
    readonly maximumBedrooms?: number;
    readonly entirePlaceOnly?: boolean;
    readonly maximumComparableCount?: number;
  };
  readonly requestedAt: string;
  readonly missingInputs: readonly string[];
}

export interface StrEvidence {
  readonly id: string;
  readonly provider: string;
  readonly sourceOperation: string;
  readonly retrievedAt: string;
  readonly providerRequestId?: string;
  readonly providerReferenceId?: string;
  readonly rawMetricName?: string;
  readonly mappingVersion: string;
  readonly sourceSnapshotId: string;
  readonly derivation: "provider-supplied" | "luxe-haven-derived";
  readonly sourceEvidenceIds?: readonly string[];
  readonly calculationVersion?: string;
}

export interface StrMetric<T> {
  readonly value: T;
  readonly evidenceId: string;
  readonly derivation: "provider-supplied" | "luxe-haven-derived";
}

export interface StrRevenueEstimate {
  readonly projectedAnnualRevenue?: Money;
  readonly projectedMonthlyRevenue?: Money;
  readonly projectedAdr?: Money;
  readonly projectedOccupancy?: Percentage;
  readonly projectedRevPar?: Money;
  readonly currency: string;
  readonly period: {
    readonly startDate?: string;
    readonly endDate?: string;
    readonly basis: "trailing" | "forecast" | "provider-estimate" | "unknown";
  };
  readonly confidence: { readonly score: number; readonly level: "low" | "moderate" | "high" };
  readonly evidenceIds: readonly string[];
  readonly metricLineage: Readonly<Partial<Record<"annualRevenue" | "monthlyRevenue" | "adr" | "occupancy" | "revPar", StrMetric<Money | Percentage>>>>;
}

export interface StrComparable {
  readonly id: string;
  readonly providerReference: { readonly provider: string; readonly listingId: string; readonly listingUrl?: string };
  readonly location: { readonly latitude?: number; readonly longitude?: number; readonly distanceMiles?: number; readonly marketLabel?: string };
  readonly property: {
    readonly propertyType?: string; readonly bedrooms?: number; readonly bathrooms?: number;
    readonly accommodates?: number; readonly roomType?: string; readonly amenities: readonly string[];
  };
  readonly performance: {
    readonly adr?: Money; readonly occupancy?: Percentage; readonly revPar?: Money;
    readonly annualRevenue?: Money; readonly lengthOfStay?: number; readonly activeDays?: number;
    readonly reviewCount?: number; readonly rating?: number;
  };
  readonly retrievedAt: string;
  readonly sourceOperation: string;
  readonly sourceSnapshotId: string;
  readonly freshness: "fresh" | "stale" | "unknown";
  readonly missingFields: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly eligibility: "eligible" | "excluded";
  readonly similarityScore: number;
  readonly evidenceQualityScore: number;
  readonly weight: number;
  readonly exclusionReasons: readonly string[];
}

export interface StrMarketMetrics {
  readonly adr?: Money;
  readonly occupancy?: Percentage;
  readonly revPar?: Money;
  readonly activeListingSupply?: number;
  readonly demandIndex?: number;
  readonly revenueGrowthPercentage?: Percentage;
  readonly evidenceIds: readonly string[];
}

export interface StrSeasonality {
  readonly monthly: readonly {
    readonly month: number; readonly adr?: Money; readonly occupancy?: Percentage;
    readonly revenue?: Money; readonly index?: number;
  }[];
  readonly peakMonths: readonly number[];
  readonly lowMonths: readonly number[];
  readonly evidenceIds: readonly string[];
}

export interface StrMarketConfidence {
  readonly score: number;
  readonly level: "low" | "moderate" | "high";
  readonly components: readonly { readonly name: string; readonly score: number; readonly rationale: string }[];
  readonly limitations: readonly string[];
}

export interface StrMarketSnapshot {
  readonly id: string;
  readonly ownerId: string;
  readonly workspaceId: string;
  readonly subjectPropertyId: string;
  readonly subjectPropertySnapshotId: string;
  readonly provider: string;
  readonly providerSnapshotReferences: readonly string[];
  readonly schemaVersion: typeof STR_MARKET_SNAPSHOT_SCHEMA_VERSION;
  readonly providerVersion: string;
  readonly queryPolicyVersion: string;
  readonly comparablePolicyVersion: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly query: StrMarketQuery;
  readonly revenueEstimate?: StrRevenueEstimate;
  readonly marketMetrics?: StrMarketMetrics;
  readonly seasonality?: StrSeasonality;
  readonly comparables: readonly StrComparable[];
  readonly confidence: StrMarketConfidence;
  readonly completeness: "complete" | "partial" | "insufficient";
  readonly evidence: readonly StrEvidence[];
  readonly evidenceIds: readonly string[];
  readonly warnings: readonly string[];
  readonly relaxedRules: readonly string[];
}

export interface StrProviderResult {
  readonly providerVersion: string;
  readonly providerSnapshotReferences: readonly string[];
  readonly revenueEstimate?: StrRevenueEstimate;
  readonly marketMetrics?: StrMarketMetrics;
  readonly seasonality?: StrSeasonality;
  readonly comparables: readonly StrComparable[];
  readonly evidence: readonly StrEvidence[];
  readonly warnings: readonly string[];
  readonly appliedFilters: readonly string[];
}

export interface StrMarketIntelligenceProvider {
  retrieve(query: StrMarketQuery, context: { readonly snapshotId: string; readonly correlationId: string }): Promise<StrProviderResult>;
}

export interface StrMarketSnapshotRepository {
  findCompatible(input: SnapshotCompatibilityInput): Promise<StrMarketSnapshot | null>;
  findById(id: string, scope: { readonly ownerId: string; readonly workspaceId: string }): Promise<StrMarketSnapshot | null>;
  save(snapshot: StrMarketSnapshot): Promise<void>;
}

export interface SnapshotCompatibilityInput {
  readonly ownerId: string; readonly workspaceId: string; readonly query: StrMarketQuery;
  readonly comparablePolicyVersion: string; readonly providerVersion: string; readonly now: Date;
}

export function freezeStrSnapshot<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeStrSnapshot(child);
  }
  return value;
}

import type { DataFreshness, PortfolioPeriod, PortfolioProjection, PortfolioScope } from "@/features/portfolio";
import type { ConfidenceLevel } from "@/platform/scoring";

export type CompositionDimensionType = "market" | "geography" | "property-type" | "bedrooms" | "operating-model" | "acquisition-strategy" | "booking-source" | "season";
export type ConcentrationBasis = "revenue" | "property-count" | "bookings";
export type ConcentrationStatus = "diversified" | "moderately-concentrated" | "highly-concentrated" | "critical-dependency" | "insufficient-evidence";
export type PortfolioCompositionInput = Readonly<{
  properties: Readonly<Record<string, Readonly<{
    city?: string | null; state?: string | null; country?: string | null; propertyType?: string | null;
    bedrooms?: number | null; acquisitionStrategy?: string | null;
  }>>>;
  bookingSources: readonly Readonly<{ propertyId: string; source: string; bookings: number; revenue: number }>[];
  seasonality: readonly Readonly<{ month: number; bookings: number; revenue: number; occupancy?: number | null }>[];
}>;
export type CompositionEntry = Readonly<{
  key: string; label: string; propertyIds: readonly string[]; propertyCount: number;
  propertyShare: number; revenue: number | null; revenueShare: number | null;
  bookings: number; bookingShare: number | null;
}>;
export type CompositionDimension = Readonly<{
  type: CompositionDimensionType; label: string; entries: readonly CompositionEntry[];
  coverage: number; freshness: DataFreshness; confidence: ConfidenceLevel;
  unavailableReason?: string;
}>;
export type PortfolioConcentration = Readonly<{
  id: string; dimension: CompositionDimensionType | "property"; label: string; basis: ConcentrationBasis;
  status: ConcentrationStatus; topShare: number | null; topTwoShare: number | null; topThreeShare: number | null;
  measuredItem: string | null; threshold: number | null; statement: string;
  evidenceIds: readonly string[]; confidence: ConfidenceLevel; freshness: DataFreshness;
}>;
export type DiversificationSummary = Readonly<{
  propertyCount: number; marketCount: number; geographyCount: number; propertyTypeCount: number;
  operatingModelCount: number; acquisitionStrategyCount: number; independentRevenueSources: number;
  statements: readonly string[]; limited: boolean;
}>;
export type CompositionHistoryChange = Readonly<{
  id: string; type: "new" | "removed" | "archived" | "shifted";
  dimension: CompositionDimensionType | "property"; label: string;
  previousShare?: number; currentShare?: number; propertyIds: readonly string[];
}>;
export type PortfolioDistribution = Readonly<{
  basis: "revenue" | "bookings"; byProperty: readonly CompositionEntry[];
  byMarket: readonly CompositionEntry[]; byPropertyType: readonly CompositionEntry[];
  byOperatingModel: readonly CompositionEntry[];
}>;
export type PortfolioSeasonality = Readonly<{
  months: readonly Readonly<{ month: number; label: string; revenue: number; revenueShare: number | null; bookings: number; bookingShare: number | null; occupancy: number | null }>[];
  peakWindowShare: number | null; peakWindowLabel: string | null; coverage: number;
}>;
export type PortfolioCompositionEvidence = Readonly<{
  propertyCoverage: number; revenueCoverage: number; bookingCoverage: number;
  propertyTypeCoverage: number; bedroomCoverage: number; operatingModelCoverage: number;
  acquisitionStrategyCoverage: number; bookingSourceCoverage: number;
  limitingDimensions: readonly CompositionDimensionType[];
}>;
export type PortfolioComposition = Readonly<{
  identity: PortfolioProjection["identity"]; scope: PortfolioScope; scopeLabel: string; period: PortfolioPeriod;
  dimensions: readonly CompositionDimension[]; markets: CompositionDimension; geography: CompositionDimension;
  propertyTypes: CompositionDimension; bedrooms: CompositionDimension; operatingModels: CompositionDimension;
  acquisitionStrategies: CompositionDimension; bookingSources: CompositionDimension;
  revenueDistribution: PortfolioDistribution; bookingDistribution: PortfolioDistribution;
  seasonality: PortfolioSeasonality; concentration: readonly PortfolioConcentration[];
  diversification: DiversificationSummary; history: readonly CompositionHistoryChange[];
  evidence: PortfolioCompositionEvidence; evaluatedAt: string; confidence: ConfidenceLevel; freshness: DataFreshness;
}>;
export type CompositionConcentrationPolicy = Readonly<{
  version: string; minimumEvidenceCoverage: number; moderateThreshold: number;
  highThreshold: number; criticalThreshold: number; seasonalWindowMonths: number;
}>;
export type BuildPortfolioCompositionQuery = Readonly<{
  projection: PortfolioProjection; input: PortfolioCompositionInput;
  comparison?: PortfolioProjection; comparisonInput?: PortfolioCompositionInput;
}>;

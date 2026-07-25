import type { DataFreshness, PortfolioPeriod, PortfolioProjection, PortfolioScope } from "@/features/portfolio";
import type { ConfidenceLevel } from "@/platform/scoring";

export type PropertyMetricFamily = "revenue" | "financial" | "operational" | "guest" | "evidence";
export type PropertyNormalization = "absolute" | "available-night" | "booked-night" | "property" | "bedroom";
export type PropertyGrouping = "none" | "market" | "property-type" | "operating-model" | "acquisition-strategy";
export type PropertyComparisonView = "table" | "contribution" | "momentum";
export type PropertyMomentum = "improving" | "stable" | "declining" | "mixed" | "new" | "insufficient-evidence";
export type PortfolioPropertyRole = "core-performer" | "growth-driver" | "cash-flow-anchor" | "emerging-property" | "turnaround-candidate" | "operational-burden" | "strategic-hold" | "evidence-limited";
export type PropertyComparisonCapabilities = Readonly<{ performance: boolean; financials: boolean; operations: boolean }>;

export type PortfolioPropertyOperatingContext = Readonly<{
  availableNights: number | null;
  bookedNights: number | null;
  activeDays: number;
  bedrooms: number | null;
  maximumGuests: number | null;
  propertyType: string | null;
  acquisitionStrategy: string | null;
  lifecycleStage: string | null;
  partialPeriod: boolean;
}>;
export type PortfolioPropertyPerformance = Readonly<{
  grossRevenue: number | null; occupancy: number | null; adr: number | null; revpar: number | null;
  bookings: number; bookedNights: number | null; availableNights: number | null;
  netOperatingIncome?: number | null; operatingMargin?: number | null; cashFlow?: number | null;
}>;
export type PortfolioPropertyChange = Readonly<{
  revenue: number | null; revenuePercent: number | null; occupancyPoints: number | null;
  adrPercent: number | null; revparPercent: number | null; bookingPercent: number | null;
  netOperatingIncome?: number | null; state: PropertyMomentum;
}>;
export type PortfolioPropertyContributionAnalysis = Readonly<{
  revenue: number | null; netOperatingIncome?: number | null; bookings: number | null;
  availableNights: number | null; operationalBurden: number | null; revenueChange: number | null;
}>;
export type PortfolioPropertyEfficiency = Readonly<{
  revenuePerAvailableNight: number | null; revenuePerBookedNight: number | null;
  revenuePerBooking: number | null; netOperatingIncomePerAvailableNight?: number | null;
  netOperatingMargin?: number | null; issuesPerBooking: number | null; actionsPerActiveStay: number | null;
}>;
export type PortfolioPropertyOperationalBurden = Readonly<{
  openActions: number; overdueActions: number | null; operationalIssues: number;
  dataQualityIssues: number; syncFailures: number | null; cancellations: number | null;
  contribution: number | null;
}>;
export type PortfolioPropertyEvidence = Readonly<{
  confidence: ConfidenceLevel; freshness: DataFreshness; historyLengthDays: number | null;
  revenueCoverage: boolean; expenseCoverage: boolean; bookingCoverage: boolean;
  operationalCoverage: boolean; marketCoverage: boolean; limitations: readonly string[];
}>;
export type PortfolioPropertyComparisonRow = Readonly<{
  property: Readonly<{ propertyId: string; name: string; market: string | null; operatingModel: string | null; status: "active" | "archived" }>;
  operatingContext: PortfolioPropertyOperatingContext;
  performance: PortfolioPropertyPerformance;
  change: PortfolioPropertyChange;
  contribution: PortfolioPropertyContributionAnalysis;
  efficiency: PortfolioPropertyEfficiency;
  operationalBurden: PortfolioPropertyOperationalBurden;
  evidence: PortfolioPropertyEvidence;
  role: PortfolioPropertyRole;
  roleExplanation: string;
  supportingDescriptors: readonly string[];
}>;
export type PortfolioPropertyRankingMetric = "revenue" | "noi" | "revenue-growth" | "occupancy-improvement" | "revpar" | "margin" | "largest-decline" | "operational-burden" | "evidence-confidence";
export type PortfolioPropertyRanking = Readonly<{
  id: string; title: string; metric: PortfolioPropertyRankingMetric; period: PortfolioPeriod;
  normalization: PropertyNormalization; eligiblePropertyCount: number; missingPropertyCount: number;
  missingReasons: readonly string[]; tieTolerance: number;
  entries: readonly Readonly<{ position: number; propertyId: string; name: string; value: number; tied: boolean }>[];
}>;
export type PortfolioPeerComparison = Readonly<{
  propertyId: string; dimension: "market" | "property-type" | "operating-model";
  label: string; eligiblePropertyIds: readonly string[]; medianRevenuePerAvailableNight: number | null;
  medianOccupancy: number | null; available: boolean; reason?: string;
}>;
export type PortfolioContributionAnalysis = Readonly<{
  portfolioRevenue: number | null; portfolioRevenueChange: number | null;
  revenueReconciles: boolean; revenueChangeReconciles: boolean;
  reportedScopeChanged: boolean;
}>;
export type PortfolioComparisonEvidence = Readonly<{
  currentProperties: number; staleProperties: number; degradedProperties: number;
  financialEligibleProperties: number; limitingPropertyIds: readonly string[];
}>;
export type PortfolioPropertyComparison = Readonly<{
  scope: PortfolioScope; scopeLabel: string; period: PortfolioPeriod;
  capabilities: PropertyComparisonCapabilities; properties: readonly PortfolioPropertyComparisonRow[];
  rankings: readonly PortfolioPropertyRanking[]; roles: readonly Readonly<{ role: PortfolioPropertyRole; count: number }>[];
  contribution: PortfolioContributionAnalysis; evidence: PortfolioComparisonEvidence;
  peerComparisons: readonly PortfolioPeerComparison[]; selectedProperty?: PortfolioPropertyComparisonRow;
  evaluatedAt: string; confidence: ConfidenceLevel; freshness: DataFreshness;
  metricFamily: PropertyMetricFamily; normalization: PropertyNormalization; grouping: PropertyGrouping; view: PropertyComparisonView;
}>;
export type PropertyComparisonPolicy = Readonly<{
  version: string; materialRevenuePercent: number; materialOccupancyPoints: number;
  materialAdrPercent: number; materialRevparPercent: number; materialBookingPercent: number;
  contributionThreshold: number; burdenThreshold: number; minimumPeerSize: number;
  minimumHistoryDays: number; tieTolerance: number;
}>;
export type BuildPortfolioPropertyComparisonQuery = Readonly<{
  projection: PortfolioProjection; comparison?: PortfolioProjection;
  capabilities: PropertyComparisonCapabilities; contexts?: Readonly<Record<string, Partial<PortfolioPropertyOperatingContext>>>;
  selectedPropertyId?: string; metricFamily?: PropertyMetricFamily; normalization?: PropertyNormalization;
  grouping?: PropertyGrouping; view?: PropertyComparisonView;
  sortBy?: "name" | "revenue" | "revenue-change" | "occupancy" | "revpar" | "burden" | "confidence";
  sortDirection?: "ascending" | "descending";
}>;

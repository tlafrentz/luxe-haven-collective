import type { ConfidenceLevel } from "@/platform/scoring";

export type DateRange = Readonly<{ from: string; to: string }>;
export type PortfolioComparison = "previous-period" | "previous-year" | "none";
export type PortfolioPeriod = Readonly<{
  current: DateRange;
  comparison?: DateRange;
  comparisonType: PortfolioComparison;
}>;

export type PortfolioAuthorizationScope =
  | Readonly<{ type: "workspace"; role: "owner" | "administrator" }>
  | Readonly<{ type: "assigned-properties"; role: "operator" | "contributor" | "viewer" }>
  | Readonly<{ type: "single-property"; role: "owner" | "administrator" | "operator" | "contributor" | "viewer" }>
  | Readonly<{ type: "filtered-portfolio"; role: "owner" | "administrator" | "operator" | "contributor" | "viewer" }>;

export type PortfolioScope = Readonly<{
  propertyIds: readonly string[];
  propertyCount: number;
  authorization: PortfolioAuthorizationScope;
}>;

export type DataFreshness = "current" | "stale" | "degraded" | "unknown";
export type PortfolioProjectionState = "no-portfolio" | "insufficient-evidence" | "ready";
export type PortfolioEvidenceKind = "revenue" | "market" | "bookings" | "operational" | "financial" | "data-quality" | "investment" | "workspace";

export type PortfolioMetrics = Readonly<{
  grossRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  revpar: number | null;
  netOperatingIncome: number | null;
  cashFlow: number | null;
  margin: number | null;
  bookingCount: number;
  activeStays: number;
  openActions: number;
  operationalIssues: number;
}>;

export type PortfolioReadObservation = Readonly<{
  id: string;
  propertyId?: string;
  kind: "revenue-increasing" | "revenue-decreasing" | "occupancy-stable" | "low-evidence" | "operational-data-stale" | "property-excluded" | "high-booking-volume";
  statement: string;
  observedAt: string;
  evidenceIds: readonly string[];
}>;

export type PortfolioEvidence = Readonly<{
  id: string;
  propertyId?: string;
  kind: PortfolioEvidenceKind;
  statement: string;
  observedAt: string;
  confidence: ConfidenceLevel;
}>;

export type PortfolioEvidenceSummary = Readonly<{
  items: readonly PortfolioEvidence[];
  counts: Readonly<Record<PortfolioEvidenceKind, number>>;
  propertyCoverage: number;
  evidenceThreshold: number;
}>;

export type PortfolioPropertyProjection = Readonly<{
  propertyId: string;
  name: string;
  status: "active" | "archived";
  market: string | null;
  operatingModel: string | null;
  metrics: PortfolioMetrics;
  contribution: Readonly<{
    revenue: number | null;
    netOperatingIncome: number | null;
    bookings: number;
    actions: number;
    operationalIssues: number;
    evidenceCount: number;
  }>;
  observations: readonly PortfolioReadObservation[];
  evidence: readonly PortfolioEvidence[];
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
}>;

export type PortfolioProjection = Readonly<{
  identity: Readonly<{ workspaceId: string; scope: PortfolioScope; evaluatedAt: string }>;
  scope: PortfolioScope;
  period: PortfolioPeriod;
  state: PortfolioProjectionState;
  summary: Readonly<{
    propertyCount: number;
    activeProperties: number;
    archivedProperties: number;
    includedProperties: number;
    marketsRepresented: readonly string[];
    operatingModels: readonly string[];
    freshness: DataFreshness;
    evidenceConfidence: ConfidenceLevel;
  }>;
  performance: PortfolioMetrics;
  properties: readonly PortfolioPropertyProjection[];
  observations: readonly PortfolioReadObservation[];
  evidence: PortfolioEvidenceSummary;
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
  generatedAt: string;
}>;

const freshnessRank: Record<DataFreshness, number> = { current: 0, stale: 1, unknown: 2, degraded: 3 };
const confidenceRank: Record<ConfidenceLevel, number> = {
  "very-high": 0, high: 1, moderate: 2, low: 3, "very-low": 4,
};

export function aggregatePortfolioFreshness(values: readonly DataFreshness[]): DataFreshness {
  if (!values.length) return "unknown";
  return values.reduce((worst, value) => freshnessRank[value] > freshnessRank[worst] ? value : worst);
}

export function aggregatePortfolioConfidence(values: readonly ConfidenceLevel[]): ConfidenceLevel {
  if (!values.length) return "very-low" as ConfidenceLevel;
  return values.reduce((lowest, value) => confidenceRank[value] > confidenceRank[lowest] ? value : lowest);
}

export function aggregatePortfolioMetrics(properties: readonly PortfolioPropertyProjection[]): PortfolioMetrics {
  const sumNullable = (select: (property: PortfolioPropertyProjection) => number | null) => {
    const values = properties.map(select).filter((value): value is number => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const revenue = sumNullable(({ metrics }) => metrics.grossRevenue);
  const noi = sumNullable(({ metrics }) => metrics.netOperatingIncome);
  const bookedNights = properties.reduce((total, property) => total + (property.metrics.adr && property.metrics.grossRevenue ? property.metrics.grossRevenue / property.metrics.adr : 0), 0);
  const availableNights = properties.reduce((total, property) => total + (property.metrics.revpar && property.metrics.grossRevenue ? property.metrics.grossRevenue / property.metrics.revpar : 0), 0);
  return Object.freeze({
    grossRevenue: revenue,
    adr: bookedNights > 0 && revenue !== null ? revenue / bookedNights : null,
    occupancy: availableNights > 0 ? bookedNights / availableNights : null,
    revpar: availableNights > 0 && revenue !== null ? revenue / availableNights : null,
    netOperatingIncome: noi,
    cashFlow: sumNullable(({ metrics }) => metrics.cashFlow),
    margin: revenue && noi !== null ? noi / revenue : null,
    bookingCount: properties.reduce((total, { metrics }) => total + metrics.bookingCount, 0),
    activeStays: properties.reduce((total, { metrics }) => total + metrics.activeStays, 0),
    openActions: properties.reduce((total, { metrics }) => total + metrics.openActions, 0),
    operationalIssues: properties.reduce((total, { metrics }) => total + metrics.operationalIssues, 0),
  });
}

export function assertPortfolioPeriod(period: PortfolioPeriod): void {
  const valid = (range: DateRange) => Boolean(Date.parse(range.from)) && Boolean(Date.parse(range.to)) && range.from <= range.to;
  if (!valid(period.current)) throw new Error("Portfolio current period must be a valid inclusive date range.");
  if (period.comparisonType === "none" && period.comparison) throw new Error("A comparison range requires a comparison type.");
  if (period.comparisonType !== "none" && (!period.comparison || !valid(period.comparison))) throw new Error("The selected comparison requires a valid comparison range.");
}

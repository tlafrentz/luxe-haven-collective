import type {
  DataFreshness,
  PortfolioEvidenceSummary,
  PortfolioPeriod,
  PortfolioProjection,
  PortfolioScope,
} from "@/features/portfolio";
import type { ConfidenceLevel } from "@/platform/scoring";

export type PortfolioConditionStatus = "strong" | "stable" | "attention-needed" | "at-risk" | "insufficient-evidence";
export type PortfolioMetric = "gross-revenue" | "occupancy" | "adr" | "revpar" | "bookings" | "noi" | "operating-margin" | "cash-flow";
export type MetricAvailability = "available" | "estimated" | "partially-available" | "unavailable";
export type PortfolioChangeDirection = "improved" | "declined" | "stable" | "new" | "removed" | "uncertain";
export type EvidenceReference = Readonly<{ id: string; statement: string }>;

export type MetricValueState = Readonly<{ state: "available"; value: number } | { state: "unavailable"; reason: string }>;
export type MetricChange = Readonly<{
  absolute: number;
  percentage: number | null;
  unit: "currency" | "percentage-points" | "count";
}>;
export type PortfolioMetricSummary = Readonly<{
  metric: PortfolioMetric;
  current: MetricValueState;
  comparison?: MetricValueState;
  change?: MetricChange;
  comparisonLabel: string;
  availability: MetricAvailability;
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
  provenance: readonly EvidenceReference[];
}>;
export type PortfolioCondition = Readonly<{
  status: PortfolioConditionStatus;
  explanation: string;
  primaryDriver: string;
  primaryLimitation: string | null;
  destination?: string;
}>;
export type PortfolioChangeSummary = Readonly<{
  id: string;
  category: "revenue" | "occupancy" | "adr" | "booking-volume" | "property-scope" | "data-quality";
  direction: PortfolioChangeDirection;
  title: string;
  description: string;
  magnitude?: MetricChange;
  affectedPropertyIds: readonly string[];
  confidence: ConfidenceLevel;
  evidence: readonly EvidenceReference[];
}>;
export type PortfolioContributionItem = Readonly<{
  propertyId: string;
  name: string;
  revenue: number | null;
  revenueShare: number | null;
  revenueChange: number | null;
  state: "leading" | "declining" | "new" | "limited-evidence" | "contributing";
  confidence: ConfidenceLevel;
}>;
export type PortfolioPropertyContributionPreview = Readonly<{
  items: readonly PortfolioContributionItem[];
  reconcilesToRevenue: number | null;
  destination?: string;
}>;
export type PortfolioAttentionItem = Readonly<{
  id: string;
  type: "performance-decline" | "data-limitation" | "operational-degradation" | "material-contribution" | "scope-change" | "unusual-movement";
  propertyId?: string;
  title: string;
  description: string;
  impact: string;
  confidence: ConfidenceLevel;
  evidence: readonly EvidenceReference[];
  destination?: string;
}>;
export type PortfolioCompositionSnapshot = Readonly<{
  markets: readonly Readonly<{ label: string; propertyCount: number; share: number }>[];
  propertyTypes: readonly Readonly<{ label: string; propertyCount: number; share: number }>[];
  operatingModels: readonly Readonly<{ label: string; propertyCount: number; share: number }>[];
  destination?: string;
}>;
export type PortfolioExecutionSummary = Readonly<{
  activeDecisions: number;
  openActions: number;
  outcomeReviewsDue: number;
  items: readonly Readonly<{ id: string; title: string; kind: "decision" | "action" | "outcome-review"; status: string; destination: string }>[];
}>;
export type PortfolioEvidenceOverview = PortfolioEvidenceSummary & Readonly<{
  bookingCoverage: number;
  revenueCoverage: number;
  financialCoverage: number;
  operationalCoverage: number;
  marketCoverage: number;
  historyLengthDays: number | null;
  limitingSource: string | null;
}>;
export type PortfolioOverview = Readonly<{
  identity: PortfolioProjection["identity"];
  scope: PortfolioScope;
  scopeLabel: "Full Workspace Portfolio" | "Your Assigned Portfolio" | "Filtered Portfolio" | "Single Property Portfolio";
  propertiesForControl: readonly (readonly [string, string])[];
  period: PortfolioPeriod;
  condition: PortfolioCondition;
  metrics: readonly PortfolioMetricSummary[];
  changes: readonly PortfolioChangeSummary[];
  propertyContribution: PortfolioPropertyContributionPreview;
  attention: readonly PortfolioAttentionItem[];
  composition: PortfolioCompositionSnapshot;
  execution: PortfolioExecutionSummary;
  evidence: PortfolioEvidenceOverview;
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
  evaluatedAt: string;
  comparisonAvailable: boolean;
  scopeChanged: boolean;
  permissionLimited: boolean;
}>;

export type PortfolioOverviewThresholdPolicy = Readonly<{
  version: string;
  materialRevenuePercent: number;
  materialAdrPercent: number;
  materialOccupancyPoints: number;
  materialBookingPercent: number;
  materialContributionShare: number;
  severeRevenueDeclinePercent: number;
  severeOccupancyDeclinePoints: number;
  minimumComparisonCoverage: number;
  maximumChanges: number;
}>;

export interface PortfolioExecutionSummaryReader {
  read(workspaceId: string, authorizedPropertyIds: readonly string[]): Promise<PortfolioExecutionSummary>;
}
export interface PortfolioOverviewObserver {
  record(input: Readonly<{ workspaceId: string; scopeType: string; authorizedPropertyCount: number; comparisonType: string; durationMilliseconds: number; outcome: "ready" | "partial" | "failure"; confidence?: string; freshness?: string; errorCode?: string }>): void;
}
export type GetPortfolioOverviewQuery = Readonly<{
  projection: PortfolioProjection;
  comparison?: PortfolioProjection;
  execution?: PortfolioExecutionSummary;
  propertyTypes?: Readonly<Record<string, string | null>>;
  historyLengthDays?: number | null;
}>;
export type PortfolioOverviewFailure =
  | Readonly<{ code: "permission"; message: string }>
  | Readonly<{ code: "configuration"; message: string }>
  | Readonly<{ code: "data_quality"; message: string }>
  | Readonly<{ code: "unavailable"; message: string }>
  | Readonly<{ code: "unexpected"; message: string }>;

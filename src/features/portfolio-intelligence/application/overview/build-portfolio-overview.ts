import type { PortfolioProjection, PortfolioPropertyProjection } from "@/features/portfolio";
import { PORTFOLIO_OVERVIEW_POLICY } from "./policies";
import { buildPortfolioPropertyComparison } from "../property-comparison";
import { buildPortfolioComposition } from "../composition";
import type {
  EvidenceReference, GetPortfolioOverviewQuery, MetricAvailability, MetricChange,
  MetricValueState, PortfolioAttentionItem, PortfolioChangeSummary, PortfolioCompositionSnapshot,
  PortfolioCondition, PortfolioContributionItem, PortfolioEvidenceOverview,
  PortfolioExecutionSummary, PortfolioMetric, PortfolioMetricSummary, PortfolioOverview,
  PortfolioOverviewThresholdPolicy,
} from "./contracts";
import { getPropertyIntelligenceHref } from "@/platform/experience";
import { canonicalComparison } from "@/platform/calculations";

const emptyExecution: PortfolioExecutionSummary = Object.freeze({ activeDecisions: 0, openActions: 0, outcomeReviewsDue: 0, items: [] });
const refs = (property: PortfolioPropertyProjection): readonly EvidenceReference[] => property.evidence.map(({ id, statement }) => ({ id, statement }));
const value = (input: number | null, reason: string): MetricValueState => input === null ? { state: "unavailable", reason } : { state: "available", value: input };
const percent = (current: number, comparison: number) => {
  const result = canonicalComparison(current, comparison);
  return result.status === "available" ? result.percentage / 100 : null;
};
const metricValue = (projection: PortfolioProjection, metric: PortfolioMetric): number | null => {
  const values = projection.performance;
  return metric === "gross-revenue" ? values.grossRevenue : metric === "occupancy" ? values.occupancy :
    metric === "adr" ? values.adr : metric === "revpar" ? values.revpar : metric === "bookings" ? values.bookingCount :
      metric === "noi" ? values.netOperatingIncome : metric === "operating-margin" ? values.margin : values.cashFlow;
};
const availability = (projection: PortfolioProjection, metric: PortfolioMetric): MetricAvailability => {
  const available = projection.properties.filter((property) => metricValue({ ...projection, performance: property.metrics }, metric) !== null).length;
  return available === 0 ? "unavailable" : available < projection.properties.length ? "partially-available" : "available";
};
const changeUnit = (metric: PortfolioMetric): MetricChange["unit"] =>
  metric === "occupancy" || metric === "operating-margin" ? "percentage-points" : metric === "bookings" ? "count" : "currency";

export function buildPortfolioMetricSummaries(current: PortfolioProjection, comparison?: PortfolioProjection): readonly PortfolioMetricSummary[] {
  const required: readonly PortfolioMetric[] = ["gross-revenue", "occupancy", "adr", "revpar", "bookings"];
  const optional: readonly PortfolioMetric[] = ["noi", "operating-margin", "cash-flow"];
  return [...required, ...optional]
    .filter((metric) => required.includes(metric) || availability(current, metric) !== "unavailable")
    .map((metric) => {
      const currentValue = metricValue(current, metric);
      const comparisonValue = comparison ? metricValue(comparison, metric) : null;
      const availableComparison = currentValue !== null && comparisonValue !== null;
      return Object.freeze({
        metric,
        current: value(currentValue, "This metric is unavailable for the current portfolio scope."),
        ...(comparison ? { comparison: value(comparisonValue, "The comparison period does not contain sufficient reliable data.") } : {}),
        ...(availableComparison ? { change: { absolute: currentValue - comparisonValue, percentage: changeUnit(metric) === "percentage-points" ? null : percent(currentValue, comparisonValue), unit: changeUnit(metric) } } : {}),
        comparisonLabel: comparison ? comparison.period.comparisonType === "previous-year" ? "versus previous year" : "versus previous period" : "Comparison unavailable",
        availability: availability(current, metric),
        confidence: current.confidence,
        freshness: current.freshness,
        provenance: current.properties.flatMap(refs),
      } satisfies PortfolioMetricSummary);
    });
}

function material(metric: PortfolioMetricSummary, policy: PortfolioOverviewThresholdPolicy) {
  if (!metric.change) return false;
  if (metric.metric === "occupancy") return Math.abs(metric.change.absolute) >= policy.materialOccupancyPoints;
  const threshold = metric.metric === "gross-revenue" ? policy.materialRevenuePercent : metric.metric === "adr" ? policy.materialAdrPercent : policy.materialBookingPercent;
  return metric.change.percentage !== null && Math.abs(metric.change.percentage) >= threshold;
}

export function identifyMaterialPortfolioChanges(current: PortfolioProjection, comparison: PortfolioProjection | undefined, metrics: readonly PortfolioMetricSummary[], policy = PORTFOLIO_OVERVIEW_POLICY): readonly PortfolioChangeSummary[] {
  const changes: PortfolioChangeSummary[] = [];
  for (const metric of metrics.filter((item) => ["gross-revenue", "occupancy", "adr", "bookings"].includes(item.metric) && material(item, policy))) {
    const direction = (metric.change?.absolute ?? 0) > 0 ? "improved" : "declined";
    changes.push({
      id: `change:${metric.metric}`, category: metric.metric === "gross-revenue" ? "revenue" : metric.metric === "bookings" ? "booking-volume" : metric.metric === "occupancy" ? "occupancy" : "adr",
      direction, title: `${label(metric.metric)} ${direction}`, description: describeChange(metric),
      magnitude: metric.change, affectedPropertyIds: current.scope.propertyIds, confidence: metric.confidence, evidence: metric.provenance,
    });
  }
  if (comparison) {
    const added = current.scope.propertyIds.filter((id) => !comparison.scope.propertyIds.includes(id));
    const removed = comparison.scope.propertyIds.filter((id) => !current.scope.propertyIds.includes(id));
    if (added.length || removed.length) changes.push({
      id: "change:scope", category: "property-scope", direction: added.length ? "new" : "removed",
      title: "Portfolio scope changed", description: `${added.length} added and ${removed.length} removed properties affect reported comparison.`,
      affectedPropertyIds: [...added, ...removed], confidence: current.confidence, evidence: [],
    });
  }
  if (current.freshness !== comparison?.freshness && current.freshness !== "current") changes.push({
    id: "change:data-quality", category: "data-quality", direction: "uncertain", title: "Data quality limits comparison",
    description: `Current portfolio freshness is ${current.freshness}.`, affectedPropertyIds: current.properties.filter(({ freshness }) => freshness !== "current").map(({ propertyId }) => propertyId),
    confidence: current.confidence, evidence: current.properties.flatMap(refs),
  });
  return changes
    .sort((left, right) => Math.abs(right.magnitude?.percentage ?? right.magnitude?.absolute ?? 0) - Math.abs(left.magnitude?.percentage ?? left.magnitude?.absolute ?? 0))
    .slice(0, policy.maximumChanges);
}

export function buildPropertyContributionPreview(current: PortfolioProjection, comparison?: PortfolioProjection, policy = PORTFOLIO_OVERVIEW_POLICY) {
  const comparisonModel = buildPortfolioPropertyComparison({
    projection: current,
    comparison,
    capabilities: { performance: true, financials: false, operations: true },
  });
  const items = comparisonModel.properties.map((row): PortfolioContributionItem => ({
    propertyId: row.property.propertyId,
    name: row.property.name,
    revenue: row.performance.grossRevenue,
    revenueShare: row.contribution.revenue,
    revenueChange: row.contribution.revenueChange,
    state: row.role === "evidence-limited" ? "limited-evidence" : row.change.state === "new" ? "new" : row.change.state === "declining" ? "declining" : (row.contribution.revenue ?? 0) >= policy.materialContributionShare ? "leading" : "contributing",
    confidence: row.evidence.confidence,
  })).sort((left, right) => (right.revenue ?? -Infinity) - (left.revenue ?? -Infinity)).slice(0, 5);
  return Object.freeze({ items: Object.freeze(items), reconcilesToRevenue: comparisonModel.contribution.portfolioRevenue, destination: "/dashboard/portfolio/properties" });
}

export function identifyPortfolioAttentionSignals(current: PortfolioProjection, contributions: readonly PortfolioContributionItem[], policy = PORTFOLIO_OVERVIEW_POLICY): readonly PortfolioAttentionItem[] {
  const items: PortfolioAttentionItem[] = [];
  for (const property of current.properties) {
    const evidence = refs(property);
    if (property.freshness !== "current") items.push({ id: `attention:freshness:${property.propertyId}`, type: "operational-degradation", propertyId: property.propertyId, title: property.name, description: `Operational data is ${property.freshness}.`, impact: "Portfolio totals may rely on last known data.", confidence: property.confidence, evidence, destination: getPropertyIntelligenceHref(property.propertyId) });
    if (!property.evidence.length) items.push({ id: `attention:evidence:${property.propertyId}`, type: "data-limitation", propertyId: property.propertyId, title: property.name, description: "This property has limited supporting evidence.", impact: "Change interpretation is limited.", confidence: property.confidence, evidence, destination: getPropertyIntelligenceHref(property.propertyId) });
  }
  for (const item of contributions.filter(({ revenueShare }) => revenueShare !== null && revenueShare >= policy.materialContributionShare)) {
    items.push({ id: `attention:contribution:${item.propertyId}`, type: "material-contribution", propertyId: item.propertyId, title: item.name, description: `${Math.round((item.revenueShare ?? 0) * 100)}% of portfolio revenue comes from this property.`, impact: "Its movement materially affects the portfolio rollup.", confidence: item.confidence, evidence: [], destination: getPropertyIntelligenceHref(item.propertyId) });
  }
  return items.slice(0, 5);
}

export function buildPortfolioCompositionSnapshot(current: PortfolioProjection, propertyTypes: Readonly<Record<string, string | null>> = {}): PortfolioCompositionSnapshot {
  const composition = buildPortfolioComposition({
    projection: current,
    input: {
      properties: Object.fromEntries(current.properties.map(({ propertyId }) => [propertyId, { propertyType: propertyTypes[propertyId] ?? null }])),
      bookingSources: [],
      seasonality: [],
    },
  });
  const dimension = (entries: typeof composition.markets.entries) => entries.map(({ label, propertyCount, propertyShare }) => ({ label, propertyCount, share: propertyShare }));
  return Object.freeze({
    markets: dimension(composition.markets.entries),
    propertyTypes: dimension(composition.propertyTypes.entries),
    operatingModels: dimension(composition.operatingModels.entries),
    destination: "/dashboard/portfolio/composition",
  });
}

export function buildPortfolioEvidenceOverview(current: PortfolioProjection, historyLengthDays: number | null = null): PortfolioEvidenceOverview {
  const count = (kind: string) => new Set(current.evidence.items.filter((item) => item.kind === kind && item.propertyId).map(({ propertyId }) => propertyId)).size;
  const total = current.properties.length;
  const coverage = (kind: string) => total ? count(kind) / total : 0;
  return Object.freeze({
    ...current.evidence,
    bookingCoverage: coverage("bookings"), revenueCoverage: coverage("revenue"), financialCoverage: coverage("financial"),
    operationalCoverage: coverage("operational"), marketCoverage: coverage("market"), historyLengthDays,
    limitingSource: current.properties.find(({ freshness }) => freshness !== "current")?.name ?? null,
  });
}

export function evaluatePortfolioCondition(current: PortfolioProjection, metrics: readonly PortfolioMetricSummary[], changes: readonly PortfolioChangeSummary[], policy = PORTFOLIO_OVERVIEW_POLICY): PortfolioCondition {
  if (current.state !== "ready") return { status: "insufficient-evidence", explanation: "Portfolio analysis is limited, but available facts remain visible.", primaryDriver: "Evidence coverage is below the configured threshold.", primaryLimitation: "Continue operating and synchronizing sources before relying on change interpretation." };
  const revenue = metrics.find(({ metric }) => metric === "gross-revenue")?.change?.percentage;
  const occupancy = metrics.find(({ metric }) => metric === "occupancy")?.change?.absolute;
  const degraded = current.freshness === "degraded";
  if (degraded && ((revenue ?? 0) <= -policy.severeRevenueDeclinePercent || (occupancy ?? 0) <= -policy.severeOccupancyDeclinePoints)) return { status: "at-risk", explanation: "Severe measured deterioration and degraded operational data affect the portfolio.", primaryDriver: describeMovement(revenue, occupancy), primaryLimitation: "Degraded sources limit certainty.", destination: "#attention" };
  if (degraded || changes.some(({ direction }) => direction === "declined")) return { status: "attention-needed", explanation: `${describeMovement(revenue, occupancy)} One or more measured signals need inspection.`, primaryDriver: describeMovement(revenue, occupancy), primaryLimitation: degraded ? "Operational data is degraded." : null, destination: "#attention" };
  if ((revenue ?? 0) >= policy.materialRevenuePercent || (occupancy ?? 0) >= policy.materialOccupancyPoints) return { status: "strong", explanation: `${describeMovement(revenue, occupancy)} No meaningful limiting condition dominates.`, primaryDriver: describeMovement(revenue, occupancy), primaryLimitation: null, destination: "#changes" };
  return { status: "stable", explanation: "Portfolio performance was broadly stable during this period.", primaryDriver: "No material positive or negative movement dominates.", primaryLimitation: current.freshness === "stale" ? "Some operational data is stale." : null };
}

export function buildPortfolioOverview(query: GetPortfolioOverviewQuery): PortfolioOverview {
  const metrics = buildPortfolioMetricSummaries(query.projection, query.comparison);
  const changes = identifyMaterialPortfolioChanges(query.projection, query.comparison, metrics);
  const propertyContribution = buildPropertyContributionPreview(query.projection, query.comparison);
  const scopeType = query.projection.scope.authorization.type;
  return Object.freeze({
    identity: query.projection.identity, scope: query.projection.scope,
    scopeLabel: scopeType === "workspace" ? "Full Workspace Portfolio" : scopeType === "assigned-properties" ? "Your Assigned Portfolio" : scopeType === "single-property" ? "Single Property Portfolio" : "Filtered Portfolio",
    propertiesForControl: query.projection.properties.map(({ propertyId, name }) => [propertyId, name] as const),
    period: query.projection.period, condition: evaluatePortfolioCondition(query.projection, metrics, changes),
    metrics, changes, propertyContribution,
    attention: identifyPortfolioAttentionSignals(query.projection, propertyContribution.items),
    composition: buildPortfolioCompositionSnapshot(query.projection, query.propertyTypes),
    execution: query.execution ?? emptyExecution,
    evidence: buildPortfolioEvidenceOverview(query.projection, query.historyLengthDays),
    confidence: query.projection.confidence, freshness: query.projection.freshness,
    evaluatedAt: query.projection.generatedAt, comparisonAvailable: Boolean(query.comparison),
    scopeChanged: Boolean(query.comparison && (query.projection.scope.propertyIds.join() !== query.comparison.scope.propertyIds.join())),
    permissionLimited: scopeType === "assigned-properties",
  });
}

function label(metric: PortfolioMetric) { return metric.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function describeChange(metric: PortfolioMetricSummary) {
  const change = metric.change!;
  const magnitude = change.unit === "percentage-points" ? `${Math.abs(change.absolute * 100).toFixed(1)} percentage points` : change.percentage !== null ? `${Math.abs(change.percentage * 100).toFixed(1)}%` : `${Math.abs(change.absolute)}`;
  return `${label(metric.metric)} ${change.absolute >= 0 ? "increased" : "decreased"} by ${magnitude}.`;
}
function describeMovement(revenue: number | null | undefined, occupancy: number | null | undefined) {
  const parts = [];
  if (revenue !== null && revenue !== undefined) parts.push(`Revenue ${revenue >= 0 ? "increased" : "decreased"} ${Math.abs(revenue * 100).toFixed(1)}%`);
  if (occupancy !== null && occupancy !== undefined) parts.push(`occupancy ${occupancy >= 0 ? "improved" : "declined"} ${Math.abs(occupancy * 100).toFixed(1)} percentage points`);
  return parts.length ? `${parts.join(" and ")}.` : "Comparison evidence is unavailable.";
}

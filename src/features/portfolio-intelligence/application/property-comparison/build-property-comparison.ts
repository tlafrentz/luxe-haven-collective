import { ConfidenceLevel } from "@/platform/scoring";
import type { PortfolioProjection, PortfolioPropertyProjection } from "@/features/portfolio";
import { PROPERTY_COMPARISON_POLICY } from "./policies";
import type {
  BuildPortfolioPropertyComparisonQuery, PortfolioPeerComparison, PortfolioPropertyComparison,
  PortfolioPropertyComparisonRow, PortfolioPropertyRanking, PortfolioPropertyRankingMetric,
  PortfolioPropertyRole, PropertyComparisonPolicy, PropertyMomentum,
} from "./contracts";
import { canonicalComparison } from "@/platform/calculations";

const ratio = (value: number, total: number | null) => total && total !== 0 ? value / total : null;
const percent = (current: number | null, prior: number | null | undefined) => {
  if (current === null || prior === null || prior === undefined) return null;
  const result = canonicalComparison(current, prior);
  return result.status === "available" ? result.percentage / 100 : null;
};
const difference = (current: number | null, prior: number | null | undefined) => current === null || prior === null || prior === undefined ? null : current - prior;
const inferredBookedNights = (property: PortfolioPropertyProjection) => property.metrics.grossRevenue !== null && property.metrics.adr ? property.metrics.grossRevenue / property.metrics.adr : null;
const inferredAvailableNights = (property: PortfolioPropertyProjection) => property.metrics.grossRevenue !== null && property.metrics.revpar ? property.metrics.grossRevenue / property.metrics.revpar : null;

export function evaluatePropertyMomentum(current: PortfolioPropertyProjection, prior: PortfolioPropertyProjection | undefined, historyDays: number | null, policy = PROPERTY_COMPARISON_POLICY): PropertyMomentum {
  if (!current.evidence.length || (historyDays !== null && historyDays < policy.minimumHistoryDays)) return "insufficient-evidence";
  if (!prior) return "new";
  const signals = [
    directional(percent(current.metrics.grossRevenue, prior.metrics.grossRevenue), policy.materialRevenuePercent),
    directional(difference(current.metrics.occupancy, prior.metrics.occupancy), policy.materialOccupancyPoints),
    directional(percent(current.metrics.adr, prior.metrics.adr), policy.materialAdrPercent),
    directional(percent(current.metrics.revpar, prior.metrics.revpar), policy.materialRevparPercent),
    directional(percent(current.metrics.bookingCount, prior.metrics.bookingCount), policy.materialBookingPercent),
  ].filter((value) => value !== 0);
  if (!signals.length) return "stable";
  if (signals.every((value) => value > 0)) return "improving";
  if (signals.every((value) => value < 0)) return "declining";
  return "mixed";
}

export function assignPortfolioPropertyRole(input: Readonly<{
  momentum: PropertyMomentum; revenueContribution: number | null; burdenContribution: number | null;
  netOperatingIncomeContribution?: number | null; financialEligible: boolean;
}>, policy = PROPERTY_COMPARISON_POLICY): Readonly<{ role: PortfolioPropertyRole; explanation: string; descriptors: readonly string[] }> {
  const descriptors = [
    input.revenueContribution !== null && input.revenueContribution >= policy.contributionThreshold ? "High revenue contribution" : null,
    input.burdenContribution !== null && input.burdenContribution >= policy.burdenThreshold ? "Material operational burden" : null,
  ].filter((value): value is string => Boolean(value));
  if (input.momentum === "insufficient-evidence") return { role: "evidence-limited", explanation: "Evidence does not support a stronger descriptive role.", descriptors };
  if (input.momentum === "new") return { role: "emerging-property", explanation: "The property is new to the comparable portfolio scope.", descriptors };
  if (input.burdenContribution !== null && input.burdenContribution >= policy.burdenThreshold && (input.revenueContribution ?? 0) < policy.contributionThreshold) return { role: "operational-burden", explanation: "Operational workload is disproportionate to current revenue contribution.", descriptors };
  if (input.momentum === "declining") return { role: "turnaround-candidate", explanation: "Material supported signals are declining and warrant deeper review.", descriptors };
  if (input.momentum === "improving") return { role: "growth-driver", explanation: "Material supported performance signals are improving.", descriptors };
  if (input.financialEligible && (input.netOperatingIncomeContribution ?? 0) >= policy.contributionThreshold) return { role: "cash-flow-anchor", explanation: "Reliable financial contribution is material to the portfolio.", descriptors };
  return { role: "core-performer", explanation: "Current contribution is supported without a dominant negative signal.", descriptors };
}

export function buildPropertyComparisonRows(query: BuildPortfolioPropertyComparisonQuery, policy = PROPERTY_COMPARISON_POLICY): readonly PortfolioPropertyComparisonRow[] {
  const projection = query.projection;
  const totalIssues = projection.performance.operationalIssues;
  const allNoiAvailable = query.capabilities.financials && projection.properties.length > 0 && projection.properties.every(({ metrics }) => metrics.netOperatingIncome !== null);
  return projection.properties.map((property) => {
    const prior = query.comparison?.properties.find(({ propertyId }) => propertyId === property.propertyId);
    const context = query.contexts?.[property.propertyId] ?? {};
    const bookedNights = context.bookedNights ?? inferredBookedNights(property);
    const availableNights = context.availableNights ?? inferredAvailableNights(property);
    const activeDays = context.activeDays ?? inclusiveDays(projection.period.current.from, projection.period.current.to);
    const historyLengthDays = activeDays;
    const momentum = evaluatePropertyMomentum(property, prior, historyLengthDays, policy);
    const revenueContribution = property.metrics.grossRevenue === null ? null : ratio(property.metrics.grossRevenue, projection.performance.grossRevenue);
    const burdenContribution = totalIssues ? property.metrics.operationalIssues / totalIssues : null;
    const noiContribution = allNoiAvailable && property.metrics.netOperatingIncome !== null ? ratio(property.metrics.netOperatingIncome, projection.performance.netOperatingIncome) : null;
    const role = assignPortfolioPropertyRole({ momentum, revenueContribution, burdenContribution, netOperatingIncomeContribution: noiContribution, financialEligible: allNoiAvailable }, policy);
    const financial = query.capabilities.financials;
    const limitations = [
      property.freshness !== "current" ? `Operational data is ${property.freshness}.` : null,
      property.metrics.grossRevenue === null ? "Revenue is unavailable." : null,
      property.metrics.netOperatingIncome === null ? "Expense data is incomplete." : null,
    ].filter((value): value is string => Boolean(value));
    const revenueChange = difference(property.metrics.grossRevenue, prior?.metrics.grossRevenue);
    return Object.freeze({
      property: { propertyId: property.propertyId, name: property.name, market: property.market, operatingModel: property.operatingModel, status: property.status },
      operatingContext: {
        availableNights, bookedNights, activeDays, bedrooms: context.bedrooms ?? null,
        maximumGuests: context.maximumGuests ?? null, propertyType: context.propertyType ?? null,
        acquisitionStrategy: context.acquisitionStrategy ?? null, lifecycleStage: context.lifecycleStage ?? null,
        partialPeriod: context.partialPeriod ?? false,
      },
      performance: {
        grossRevenue: property.metrics.grossRevenue, occupancy: property.metrics.occupancy, adr: property.metrics.adr,
        revpar: property.metrics.revpar, bookings: property.metrics.bookingCount, bookedNights, availableNights,
        ...(financial ? { netOperatingIncome: property.metrics.netOperatingIncome, operatingMargin: property.metrics.margin, cashFlow: property.metrics.cashFlow } : {}),
      },
      change: {
        revenue: revenueChange, revenuePercent: percent(property.metrics.grossRevenue, prior?.metrics.grossRevenue),
        occupancyPoints: difference(property.metrics.occupancy, prior?.metrics.occupancy),
        adrPercent: percent(property.metrics.adr, prior?.metrics.adr), revparPercent: percent(property.metrics.revpar, prior?.metrics.revpar),
        bookingPercent: percent(property.metrics.bookingCount, prior?.metrics.bookingCount),
        ...(financial ? { netOperatingIncome: difference(property.metrics.netOperatingIncome, prior?.metrics.netOperatingIncome) } : {}),
        state: momentum,
      },
      contribution: {
        revenue: revenueContribution, ...(financial ? { netOperatingIncome: noiContribution } : {}),
        bookings: ratio(property.metrics.bookingCount, projection.performance.bookingCount),
        availableNights: availableNights === null ? null : ratio(availableNights, projection.properties.reduce((sum, item) => sum + (inferredAvailableNights(item) ?? 0), 0)),
        operationalBurden: query.capabilities.operations ? burdenContribution : null, revenueChange,
      },
      efficiency: {
        revenuePerAvailableNight: property.metrics.grossRevenue !== null && availableNights ? property.metrics.grossRevenue / availableNights : null,
        revenuePerBookedNight: property.metrics.grossRevenue !== null && bookedNights ? property.metrics.grossRevenue / bookedNights : null,
        revenuePerBooking: property.metrics.grossRevenue !== null && property.metrics.bookingCount ? property.metrics.grossRevenue / property.metrics.bookingCount : null,
        ...(financial ? {
          netOperatingIncomePerAvailableNight: property.metrics.netOperatingIncome !== null && availableNights ? property.metrics.netOperatingIncome / availableNights : null,
          netOperatingMargin: property.metrics.margin,
        } : {}),
        issuesPerBooking: property.metrics.bookingCount ? property.metrics.operationalIssues / property.metrics.bookingCount : null,
        actionsPerActiveStay: property.metrics.activeStays ? property.metrics.openActions / property.metrics.activeStays : null,
      },
      operationalBurden: {
        openActions: query.capabilities.operations ? property.metrics.openActions : 0, overdueActions: null,
        operationalIssues: query.capabilities.operations ? property.metrics.operationalIssues : 0,
        dataQualityIssues: property.evidence.filter(({ kind }) => kind === "data-quality").length,
        syncFailures: null, cancellations: null, contribution: query.capabilities.operations ? burdenContribution : null,
      },
      evidence: {
        confidence: property.confidence, freshness: property.freshness, historyLengthDays,
        revenueCoverage: property.metrics.grossRevenue !== null, expenseCoverage: property.metrics.netOperatingIncome !== null,
        bookingCoverage: property.evidence.some(({ kind }) => kind === "bookings"),
        operationalCoverage: property.evidence.some(({ kind }) => kind === "operational"),
        marketCoverage: property.evidence.some(({ kind }) => kind === "market"), limitations,
      },
      role: role.role, roleExplanation: role.explanation, supportingDescriptors: role.descriptors,
    });
  });
}

export function buildDecisionSpecificRankings(rows: readonly PortfolioPropertyComparisonRow[], period: PortfolioProjection["period"], capabilities: BuildPortfolioPropertyComparisonQuery["capabilities"], policy = PROPERTY_COMPARISON_POLICY): readonly PortfolioPropertyRanking[] {
  const definitions: readonly Readonly<{ metric: PortfolioPropertyRankingMetric; title: string; value: (row: PortfolioPropertyComparisonRow) => number | null; descending: boolean; financial?: boolean; operational?: boolean }>[] = [
    { metric: "revenue", title: "Top Revenue Contributors", value: (row) => row.performance.grossRevenue, descending: true },
    { metric: "noi", title: "Top NOI Contributors", value: (row) => row.performance.netOperatingIncome ?? null, descending: true, financial: true },
    { metric: "revenue-growth", title: "Strongest Revenue Growth", value: (row) => row.change.revenuePercent, descending: true },
    { metric: "occupancy-improvement", title: "Strongest Occupancy Improvement", value: (row) => row.change.occupancyPoints, descending: true },
    { metric: "revpar", title: "Best RevPAR", value: (row) => row.performance.revpar, descending: true },
    { metric: "margin", title: "Best Margin", value: (row) => row.performance.operatingMargin ?? null, descending: true, financial: true },
    { metric: "largest-decline", title: "Largest Revenue Decline", value: (row) => row.change.revenuePercent, descending: false },
    { metric: "operational-burden", title: "Highest Operational Burden", value: (row) => row.operationalBurden.contribution, descending: true, operational: true },
    { metric: "evidence-confidence", title: "Lowest Evidence Confidence", value: (row) => confidenceRank(row.evidence.confidence), descending: true },
  ];
  return definitions
    .filter((definition) => (!definition.financial || capabilities.financials) && (!definition.operational || capabilities.operations))
    .map((definition) => ranking(definition, rows, period, policy));
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildPropertyPeerComparisons(rows: readonly PortfolioPropertyComparisonRow[], policy = PROPERTY_COMPARISON_POLICY): readonly PortfolioPeerComparison[] {
  return rows.map((row) => {
    const peers = rows.filter((candidate) => candidate.property.market && candidate.property.market === row.property.market);
    if (peers.length < policy.minimumPeerSize) return { propertyId: row.property.propertyId, dimension: "market", label: row.property.market ?? "Unspecified", eligiblePropertyIds: peers.map(({ property }) => property.propertyId), medianRevenuePerAvailableNight: null, medianOccupancy: null, available: false, reason: "A meaningful peer group requires at least two authorized comparable properties." };
    return {
      propertyId: row.property.propertyId, dimension: "market", label: row.property.market!,
      eligiblePropertyIds: peers.map(({ property }) => property.propertyId),
      medianRevenuePerAvailableNight: median(peers.flatMap(({ efficiency }) => efficiency.revenuePerAvailableNight === null ? [] : [efficiency.revenuePerAvailableNight])),
      medianOccupancy: median(peers.flatMap(({ performance }) => performance.occupancy === null ? [] : [performance.occupancy])),
      available: true,
    };
  });
}

export function buildPortfolioPropertyComparison(query: BuildPortfolioPropertyComparisonQuery): PortfolioPropertyComparison {
  const rows = sortRows(buildPropertyComparisonRows(query), query.sortBy ?? "revenue", query.sortDirection ?? "descending");
  const revenueChange = rows.reduce((sum, row) => sum + (row.contribution.revenueChange ?? 0), 0);
  const portfolioChange = query.comparison && query.projection.performance.grossRevenue !== null && query.comparison.performance.grossRevenue !== null ? query.projection.performance.grossRevenue - query.comparison.performance.grossRevenue : null;
  const roles = [...new Set(rows.map(({ role }) => role))].map((role) => ({ role, count: rows.filter((row) => row.role === role).length }));
  const scopeType = query.projection.scope.authorization.type;
  return Object.freeze({
    scope: query.projection.scope, scopeLabel: scopeType === "workspace" ? "Full Workspace Portfolio" : scopeType === "assigned-properties" ? "Your Assigned Portfolio" : scopeType === "single-property" ? "Single Property Portfolio" : "Filtered Portfolio",
    period: query.projection.period, capabilities: query.capabilities, properties: rows,
    rankings: buildDecisionSpecificRankings(rows, query.projection.period, query.capabilities), roles,
    contribution: {
      portfolioRevenue: query.projection.performance.grossRevenue, portfolioRevenueChange: portfolioChange,
      revenueReconciles: query.projection.performance.grossRevenue === null || nearlyEqual(rows.reduce((sum, row) => sum + (row.performance.grossRevenue ?? 0), 0), query.projection.performance.grossRevenue),
      revenueChangeReconciles: portfolioChange === null || nearlyEqual(revenueChange, portfolioChange),
      reportedScopeChanged: Boolean(query.comparison && query.projection.scope.propertyIds.join() !== query.comparison.scope.propertyIds.join()),
    },
    evidence: {
      currentProperties: rows.filter(({ evidence }) => evidence.freshness === "current").length,
      staleProperties: rows.filter(({ evidence }) => evidence.freshness === "stale").length,
      degradedProperties: rows.filter(({ evidence }) => evidence.freshness === "degraded").length,
      financialEligibleProperties: query.capabilities.financials ? rows.filter(({ evidence }) => evidence.expenseCoverage).length : 0,
      limitingPropertyIds: rows.filter(({ evidence }) => evidence.limitations.length).map(({ property }) => property.propertyId),
    },
    peerComparisons: buildPropertyPeerComparisons(rows),
    selectedProperty: rows.find(({ property }) => property.propertyId === query.selectedPropertyId),
    evaluatedAt: query.projection.generatedAt, confidence: query.projection.confidence, freshness: query.projection.freshness,
    metricFamily: query.metricFamily ?? "revenue", normalization: query.normalization ?? "absolute",
    grouping: query.grouping ?? "none", view: query.view ?? "table",
  });
}

export const getPortfolioPropertyComparison = buildPortfolioPropertyComparison;

function ranking(definition: { metric: PortfolioPropertyRankingMetric; title: string; value: (row: PortfolioPropertyComparisonRow) => number | null; descending: boolean }, rows: readonly PortfolioPropertyComparisonRow[], period: PortfolioProjection["period"], policy: PropertyComparisonPolicy): PortfolioPropertyRanking {
  const values = rows.flatMap((row) => {
    const value = definition.value(row);
    return value === null || row.evidence.freshness === "degraded" || row.operatingContext.partialPeriod ? [] : [{ row, value }];
  }).sort((left, right) => definition.descending ? right.value - left.value : left.value - right.value);
  let last: number | null = null;
  let position = 0;
  return {
    id: `ranking:${definition.metric}`, title: definition.title, metric: definition.metric, period,
    normalization: "absolute", eligiblePropertyCount: values.length, missingPropertyCount: rows.length - values.length,
    missingReasons: rows.length === values.length ? [] : ["Required metric unavailable, degraded, or partial-period."],
    tieTolerance: policy.tieTolerance,
    entries: values.map(({ row, value }, index) => {
      const tied = last !== null && Math.abs(value - last) <= Math.max(Math.abs(last), 1) * policy.tieTolerance;
      if (!tied) position = index + 1;
      last = value;
      return { position, propertyId: row.property.propertyId, name: row.property.name, value, tied };
    }),
  };
}
function directional(value: number | null, threshold: number) { return value === null || Math.abs(value) < threshold ? 0 : value > 0 ? 1 : -1; }
function confidenceRank(value: ConfidenceLevel) { return { [ConfidenceLevel.VERY_HIGH]: 0, [ConfidenceLevel.HIGH]: 1, [ConfidenceLevel.MODERATE]: 2, [ConfidenceLevel.LOW]: 3, [ConfidenceLevel.VERY_LOW]: 4 }[value]; }
function inclusiveDays(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1; }
function nearlyEqual(left: number, right: number) { return Math.abs(left - right) < 0.005; }
function sortRows(rows: readonly PortfolioPropertyComparisonRow[], sortBy: NonNullable<BuildPortfolioPropertyComparisonQuery["sortBy"]>, direction: NonNullable<BuildPortfolioPropertyComparisonQuery["sortDirection"]>) {
  const numeric = (row: PortfolioPropertyComparisonRow) => sortBy === "revenue" ? row.performance.grossRevenue : sortBy === "revenue-change" ? row.change.revenue : sortBy === "occupancy" ? row.performance.occupancy : sortBy === "revpar" ? row.performance.revpar : sortBy === "burden" ? row.operationalBurden.contribution : confidenceRank(row.evidence.confidence);
  return [...rows].sort((left, right) => {
    if (sortBy === "name") return (direction === "ascending" ? 1 : -1) * left.property.name.localeCompare(right.property.name);
    const leftValue = numeric(left); const rightValue = numeric(right);
    if (leftValue === null) return 1; if (rightValue === null) return -1;
    return (direction === "ascending" ? 1 : -1) * (leftValue - rightValue);
  });
}

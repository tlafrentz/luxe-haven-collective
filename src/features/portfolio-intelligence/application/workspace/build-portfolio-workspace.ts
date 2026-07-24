import type { PortfolioHealthFinding, PortfolioHealthDimensionResult } from "../../domain/health";
import type { CapitalAllocationCandidateAssessment } from "../../domain/allocation";
import {
  PORTFOLIO_WORKSPACE_LIMITS,
  type GetPortfolioIntelligenceWorkspaceQuery,
  type PortfolioAllocationCandidateWorkspace,
  type PortfolioAllocationWorkspaceState,
  type PortfolioCapitalWorkspaceState,
  type PortfolioCompositionWorkspaceSummary,
  type PortfolioHealthDimensionWorkspace,
  type PortfolioHealthWorkspaceState,
  type PortfolioIntelligenceWorkspace,
  type PortfolioIntelligenceWorkspaceState,
  type PortfolioWorkspaceDataGap,
  type PortfolioWorkspaceFreshness,
  type PortfolioWorkspaceLimitation,
  type PortfolioWorkspaceSource,
  type PortfolioWorkspaceSummary,
} from "./contracts";

export function buildPortfolioWorkspace(
  source: PortfolioWorkspaceSource,
  query: GetPortfolioIntelligenceWorkspaceQuery,
): PortfolioIntelligenceWorkspaceState {
  const limits = {
    attention: bound(query.attentionLimit, PORTFOLIO_WORKSPACE_LIMITS.attention),
    contributions: bound(query.propertyContributionLimit, PORTFOLIO_WORKSPACE_LIMITS.propertyContributions),
    candidates: bound(query.allocationCandidateLimit, PORTFOLIO_WORKSPACE_LIMITS.allocationCandidates),
  };
  const properties = source.properties.filter((item) => item.active);
  const opportunities = source.opportunities.filter((item) => item.active);
  const summary = portfolioSummary(source, properties.length, opportunities.length, query);
  const healthFreshness: PortfolioWorkspaceFreshness = !source.health
    ? "unavailable"
    : source.health.portfolioVersion === source.version ? "current" : "stale";
  const allocationFreshness: PortfolioWorkspaceFreshness = !source.allocation
    ? "unavailable"
    : source.allocation.portfolioVersion !== source.version
      ? "stale"
      : !source.health || source.allocation.healthPolicyVersion !== source.health.policyVersion
        ? "incompatible"
        : source.allocation.evaluatedAt < source.health.evaluatedAt ? "stale" : "current";
  const health = source.health ? mapHealth(source, healthFreshness) : null;
  const capital = mapCapital(source);
  const allocation = source.allocation ? mapAllocation(source, allocationFreshness, limits.candidates) : null;
  const limitations = limitationsFor(source, healthFreshness, allocationFreshness);

  if (properties.length === 0 && opportunities.length > 0) {
    return Object.freeze({
      status: "formation-stage",
      portfolio: summary,
      formation: Object.freeze({ activeOpportunities: opportunities.length, capital, allocation, limitations }),
    });
  }
  if (properties.length === 0) {
    return Object.freeze({
      status: "insufficient-data",
      portfolio: summary,
      gaps: Object.freeze([gap("PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES", "composition", "blocking", ["activeProperties"])]),
      availableSections: Object.freeze(capital ? ["capital", "composition"] as const : ["composition"] as const),
    });
  }
  if (!health) {
    return Object.freeze({ status: "health-unavailable", portfolio: summary, ...(capital ? { capital } : {}), limitations });
  }
  if (!allocation) {
    return Object.freeze({ status: "allocation-unavailable", portfolio: summary, health, ...(capital ? { capital } : {}), limitations });
  }

  const healthAssessment = source.health!;
  const allocationAssessment = source.allocation!;
  const workspace: PortfolioIntelligenceWorkspace = Object.freeze({
    portfolio: summary,
    health,
    capital,
    allocation,
    composition: mapComposition(source, limits.contributions),
    attention: Object.freeze({
      priorities: Object.freeze(healthAssessment.attentionPriorities.slice(0, limits.attention).map((item) => Object.freeze({
        rank: item.rank,
        dimension: item.dimension,
        severity: item.severity,
        findingCode: item.findingCode,
        subjectType: item.subjectType,
        ...(item.subjectId ? { subjectId: item.subjectId } : {}),
      }))),
    }),
    assessmentLineage: Object.freeze({
      portfolioVersion: source.version,
      healthPolicyVersion: healthAssessment.policyVersion,
      allocationPolicyVersion: allocationAssessment.allocationPolicyVersion,
      healthEvaluatedAt: cloneDate(healthAssessment.evaluatedAt),
      allocationEvaluatedAt: cloneDate(allocationAssessment.evaluatedAt),
      observationWindow: cloneWindow(healthAssessment.observationWindow),
      healthFreshness,
      allocationFreshness,
      compatible: allocationFreshness !== "incompatible",
    }),
    capabilities: capabilities(Boolean(source.health), Boolean(source.allocation)),
    limitations,
  });
  return Object.freeze({ status: "ready", workspace });
}

function portfolioSummary(source: PortfolioWorkspaceSource, propertyCount: number, opportunityCount: number, query: GetPortfolioIntelligenceWorkspaceQuery): PortfolioWorkspaceSummary {
  return Object.freeze({
    id: source.portfolioId.value,
    name: source.name,
    strategySummary: source.strategySummary?.trim() || null,
    activePropertyCount: propertyCount,
    activeOpportunityCount: opportunityCount,
    reportingCurrency: source.reportingCurrency,
    updatedAt: cloneDate(source.updatedAt),
    observationWindow: cloneWindow(source.health?.observationWindow ?? query.observationWindow),
  });
}

function mapHealth(source: PortfolioWorkspaceSource, freshness: PortfolioWorkspaceFreshness): PortfolioHealthWorkspaceState {
  const assessment = source.health!;
  return Object.freeze({
    status: "available",
    band: assessment.overall.band,
    score: assessment.overall.score.value,
    confidence: assessment.confidence.level,
    summaryCode: assessment.overall.summaryCode,
    limitingDimensions: Object.freeze([...assessment.overall.limitingDimensions]),
    dimensions: Object.freeze(assessment.dimensionResults.map(mapDimension)),
    strengths: Object.freeze(assessment.strengths.slice(0, PORTFOLIO_WORKSPACE_LIMITS.findings).map(mapFinding)),
    risks: Object.freeze(assessment.risks.slice(0, PORTFOLIO_WORKSPACE_LIMITS.findings).map(mapFinding)),
    warnings: Object.freeze(assessment.warnings.slice(0, PORTFOLIO_WORKSPACE_LIMITS.findings).map(mapFinding)),
    dataGaps: Object.freeze(assessment.dataGaps.map((item) => gap(item.code, "health", item.impact, item.missingFields))),
    evaluatedAt: cloneDate(assessment.evaluatedAt),
    freshness,
  });
}

function mapDimension(result: PortfolioHealthDimensionResult): PortfolioHealthDimensionWorkspace {
  if (result.status === "not-applicable") {
    return Object.freeze({ dimension: result.dimension, status: result.status, confidence: "unavailable", reasonCode: result.reasonCode, gaps: Object.freeze([]) });
  }
  if (result.status === "insufficient-data") {
    return Object.freeze({
      dimension: result.dimension,
      status: result.status,
      confidence: result.confidence.level,
      gaps: Object.freeze(result.dataGaps.map((item) => gap(item.code, "health", item.impact, item.missingFields))),
    });
  }
  const findings = result.assessment.findings;
  return Object.freeze({
    dimension: result.assessment.dimension,
    status: "evaluated",
    band: result.assessment.band,
    score: result.assessment.score.value,
    confidence: result.assessment.confidence.level,
    weightedContribution: result.assessment.weightedContribution,
    positiveFinding: findings.find((item) => item.severity === "positive") ? mapFinding(findings.find((item) => item.severity === "positive")!) : undefined,
    limitingFinding: findings.find((item) => ["warning", "high", "critical"].includes(item.severity)) ? mapFinding(findings.find((item) => ["warning", "high", "critical"].includes(item.severity))!) : undefined,
    gaps: Object.freeze(result.assessment.dataGaps.map((item) => gap(item.code, "health", item.impact, item.missingFields))),
  });
}

function mapFinding(item: PortfolioHealthFinding) {
  return Object.freeze({ code: item.code, severity: item.severity, subject: item.subject, ...(item.subjectId ? { subjectId: item.subjectId } : {}) });
}

function mapCapital(source: PortfolioWorkspaceSource): PortfolioCapitalWorkspaceState | null {
  const health = source.health;
  const allocation = source.allocation;
  if (!health && !allocation) return null;
  const h = health?.capitalAssessment;
  const a = allocation?.capitalPosition;
  const mandatory = allocation?.mandatoryCoverage;
  const deployable = a?.deployableCapital.amount ?? Math.max(0, (h?.available.amount ?? 0) - (h?.reserved.amount ?? 0) - (h?.committed.amount ?? 0));
  const unfunded = mandatory?.unfunded.amount ?? h?.unfundedCommitment.amount ?? 0;
  return Object.freeze({
    status: "available",
    reportingCurrency: source.reportingCurrency,
    available: h?.available.amount ?? a?.availableCapital.amount ?? 0,
    reserved: h?.reserved.amount ?? a?.requiredMinimumReserve.amount ?? 0,
    committed: h?.committed.amount ?? a?.committedCapital.amount ?? 0,
    allocated: h?.allocated.amount ?? 0,
    nearTermObligations: a?.nearTermObligations.amount ?? 0,
    requiredReserve: a?.requiredMinimumReserve.amount ?? h?.reserved.amount ?? 0,
    deployable,
    unfunded,
    mandatoryRequired: mandatory?.totalRequired.amount ?? 0,
    mandatoryFunded: mandatory?.funded.amount ?? 0,
    mandatoryCoverage: mandatory?.coverage?.value ?? null,
    capitalStatus: unfunded > 0 ? "overcommitted" : deployable <= 0 ? "constrained" : "protected",
  });
}

function mapAllocation(source: PortfolioWorkspaceSource, freshness: PortfolioWorkspaceFreshness, limit: number): PortfolioAllocationWorkspaceState {
  const assessment = source.allocation!;
  const mapped = assessment.candidates.map(mapCandidate);
  const primary = mapped.find((item) => item.id === assessment.primaryCandidateId?.value) ?? null;
  const alternateSet = new Set<string>(assessment.alternateCandidateIds.map((id) => id.value));
  return Object.freeze({
    status: "available",
    posture: assessment.recommendedPosture,
    confidence: assessment.confidence.level,
    evaluatedAt: cloneDate(assessment.evaluatedAt),
    freshness,
    primary,
    alternates: Object.freeze(mapped.filter((item) => alternateSet.has(item.id)).slice(0, Math.max(0, limit - Number(Boolean(primary))))),
    infeasible: Object.freeze(mapped.filter((item) => item.feasibility === "infeasible" || item.feasibility === "insufficient-data").slice(0, limit)),
    constraints: Object.freeze(assessment.constraints.map((item) => item.code).slice(0, PORTFOLIO_WORKSPACE_LIMITS.findings)),
    tradeOffs: Object.freeze(assessment.portfolioTradeOffs.map((item) => item.code).slice(0, PORTFOLIO_WORKSPACE_LIMITS.findings)),
    dataGaps: Object.freeze(assessment.dataGaps.map((item) => gap(item.code, "allocation", item.impact, item.missingFields))),
  });
}

function mapCandidate(item: CapitalAllocationCandidateAssessment): PortfolioAllocationCandidateWorkspace {
  const subjectId = "portfolioId" in item.candidate.subject ? item.candidate.subject.portfolioId.value
    : "propertyId" in item.candidate.subject ? item.candidate.subject.propertyId
      : "obligationId" in item.candidate.subject ? item.candidate.subject.obligationId
        : item.candidate.subject.opportunityId;
  const requiredCapital = item.candidate.requiredCapital.status === "known" ? item.candidate.requiredCapital.amount.amount : null;
  const liquidityAfter = item.feasibility.status === "feasible" ? item.feasibility.deployableCapitalAfter.amount : null;
  const blockers = item.feasibility.status === "infeasible" || item.feasibility.status === "conditionally-feasible"
    ? item.feasibility.blockers.map((blocker) => blocker.code)
    : [];
  return Object.freeze({
    id: item.candidate.id.value,
    purpose: item.candidate.purpose,
    subjectType: item.candidate.subject.type,
    subjectId,
    requiredCapital,
    feasibility: item.feasibility.status,
    rank: item.rank,
    posture: item.posture,
    confidence: item.confidence.level,
    healthDirection: item.candidate.expectedImpact.health.expectedDirection,
    strategicAlignment: item.candidate.expectedImpact.strategy.status,
    diversificationDirection: item.candidate.expectedImpact.diversification.direction,
    liquidityAfter,
    strengths: Object.freeze(item.strengths.map((finding) => finding.code).slice(0, 3)),
    weaknesses: Object.freeze(item.weaknesses.map((finding) => finding.code).slice(0, 3)),
    tradeOffs: Object.freeze(item.tradeOffs.map((tradeOff) => tradeOff.code).slice(0, 4)),
    blockers: Object.freeze(blockers),
    isPreserveCapital: item.candidate.purpose === "defer-deployment",
  });
}

function mapComposition(source: PortfolioWorkspaceSource, contributionLimit: number): PortfolioCompositionWorkspaceSummary {
  const activeProperties = source.properties.filter((item) => item.active);
  const activeOpportunities = source.opportunities.filter((item) => item.active);
  const contributions = source.health?.contributionSummary;
  const contributionRows = uniqueContributions(contributions ? [
    ...contributions.topRevenueContributors,
    ...contributions.topNoiContributors,
    ...contributions.negativeContributors,
    ...contributions.unknownContributors,
  ] : []).slice(0, contributionLimit);
  const propertyById = new Map(source.properties.map((item) => [item.propertyId, item]));
  return Object.freeze({
    activeProperties: activeProperties.length,
    activeOpportunities: activeOpportunities.length,
    lifecycle: activeProperties.length === 0 ? (activeOpportunities.length ? "formation-stage" : "empty") : activeProperties.length === 1 ? "single-property" : "operating",
    markets: countBy(activeProperties.map((item) => item.market ?? "Unknown")),
    propertyTypes: countBy(activeProperties.map((item) => item.propertyType ?? "Unknown")),
    opportunityStates: Object.freeze(countBy(activeOpportunities.map((item) => item.planningStatus)).map((item) => Object.freeze({ key: item.key, count: item.propertyCount }))),
    exposures: Object.freeze((source.health?.concentrationAssessments ?? []).slice(0, PORTFOLIO_WORKSPACE_LIMITS.exposures).map((item) => Object.freeze({
      type: item.type,
      basis: item.topExposure?.basis ?? "unavailable",
      band: item.band,
      topExposure: item.topExposure ? Object.freeze({ key: item.topExposure.key, share: item.topExposure.share.value }) : null,
      topThreeShare: item.topThreeShare.value,
      confidence: item.topExposure ? source.health!.confidence.level : "unavailable",
    }))),
    propertyContributions: Object.freeze(contributionRows.map((item) => {
      const property = propertyById.get(item.propertyId);
      return Object.freeze({
        propertyId: item.propertyId,
        name: property?.name ?? item.propertyId,
        market: property?.market ?? null,
        ...(item.revenueShare ? { revenueShare: item.revenueShare.value } : {}),
        ...(item.noiShare ? { noiShare: item.noiShare.value } : {}),
        ...(item.capitalShare ? { capitalShare: item.capitalShare.value } : {}),
        contribution: item.contribution,
        confidence: item.dataQuality.level,
        ...(item.healthDrivers[0] ? { primaryDriver: item.healthDrivers[0].code } : {}),
      });
    })),
  });
}

function limitationsFor(source: PortfolioWorkspaceSource, health: PortfolioWorkspaceFreshness, allocation: PortfolioWorkspaceFreshness): readonly PortfolioWorkspaceLimitation[] {
  const items: PortfolioWorkspaceLimitation[] = [];
  if (!source.health) items.push(limitation("PORTFOLIO_WORKSPACE_HEALTH_UNAVAILABLE", "health", "material", "Evaluate portfolio health when canonical performance and capital data are available."));
  if (!source.allocation) items.push(limitation("PORTFOLIO_WORKSPACE_ALLOCATION_UNAVAILABLE", "allocation", "material", "Evaluate capital allocation after a compatible health assessment is available."));
  if (health === "stale") items.push(limitation("PORTFOLIO_WORKSPACE_HEALTH_STALE", "health", "material", "Reevaluate health because the portfolio changed after this assessment."));
  if (allocation === "stale") items.push(limitation("PORTFOLIO_WORKSPACE_ALLOCATION_STALE", "allocation", "material", "Reevaluate allocation because its portfolio or health lineage is no longer current."));
  if (allocation === "incompatible") items.push(limitation("PORTFOLIO_WORKSPACE_POLICIES_INCOMPATIBLE", "allocation", "blocking", "Evaluate allocation with the current health policy."));
  return Object.freeze(items);
}

function capabilities(health: boolean, allocation: boolean) {
  const unavailable = (reasonCode: string) => Object.freeze({ available: false, reasonCode });
  return Object.freeze({
    viewHealth: health ? Object.freeze({ available: true }) : unavailable("HEALTH_UNAVAILABLE"),
    evaluateHealth: Object.freeze({ available: true }),
    viewAllocation: allocation ? Object.freeze({ available: true }) : unavailable("ALLOCATION_UNAVAILABLE"),
    evaluateAllocation: health ? Object.freeze({ available: true }) : unavailable("HEALTH_REQUIRED"),
    editPortfolio: unavailable("PI_004_READ_ONLY"),
    editCapital: unavailable("PI_004_READ_ONLY"),
    editStrategy: unavailable("PI_004_READ_ONLY"),
    executeAllocation: unavailable("PI_004_ASSESSMENT_ONLY"),
  });
}

function countBy(values: readonly string[]) {
  const counts = new Map<string, number>();
  values.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return Object.freeze([...counts].sort(([a], [b]) => a.localeCompare(b)).map(([key, propertyCount]) => Object.freeze({ key, propertyCount })));
}
function uniqueContributions<T extends { propertyId: string }>(values: readonly T[]): readonly T[] {
  return [...new Map(values.map((value) => [value.propertyId, value])).values()].sort((a, b) => a.propertyId.localeCompare(b.propertyId));
}
function gap(code: string, section: PortfolioWorkspaceDataGap["section"], impact: PortfolioWorkspaceDataGap["impact"], missingFields: readonly string[]): PortfolioWorkspaceDataGap {
  return Object.freeze({ code, section, impact, missingFields: Object.freeze([...missingFields]), confidenceReduced: true, rankingBlocked: impact === "blocking" && section === "allocation" });
}
function limitation(code: string, section: PortfolioWorkspaceLimitation["section"], impact: PortfolioWorkspaceLimitation["impact"], guidance: string): PortfolioWorkspaceLimitation {
  return Object.freeze({ code, section, impact, guidance });
}
function bound(value: number | undefined, maximum: number): number {
  if (value === undefined) return maximum;
  return Number.isInteger(value) ? Math.max(1, Math.min(value, maximum)) : maximum;
}
function cloneDate(value: Date): Date { return new Date(value.getTime()); }
function cloneWindow(value: import("../../domain/health").PortfolioObservationWindow) {
  return Object.freeze({
    start: cloneDate(value.start),
    end: cloneDate(value.end),
    ...(value.comparisonStart ? { comparisonStart: cloneDate(value.comparisonStart) } : {}),
    ...(value.comparisonEnd ? { comparisonEnd: cloneDate(value.comparisonEnd) } : {}),
  });
}

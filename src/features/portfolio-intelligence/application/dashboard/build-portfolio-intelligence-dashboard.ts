import { compareCapitalAllocation } from "../compare-capital-allocation";
import { comparePortfolioHealth } from "../compare-portfolio-health";
import { comparePortfolioRecommendations } from "../../domain/recommendations";
import type {
  CapitalAllocationAssessment,
  PortfolioHealthAssessment,
  PortfolioRecommendation,
  PortfolioRecommendationHistory,
} from "../../domain";
import {
  PORTFOLIO_DASHBOARD_LIMITS,
  type GetPortfolioIntelligenceDashboardQuery,
  type PortfolioDashboardAllocationSummary,
  type PortfolioDashboardAttentionItem,
  type PortfolioDashboardCapitalSummary,
  type PortfolioDashboardChange,
  type PortfolioDashboardDriver,
  type PortfolioDashboardFreshnessSummary,
  type PortfolioDashboardHealthMovement,
  type PortfolioDashboardHealthSummary,
  type PortfolioDashboardLimitation,
  type PortfolioDashboardPortfolioSummary,
  type PortfolioDashboardRecommendation,
  type PortfolioDashboardRecommendationSummary,
  type PortfolioDashboardSection,
  type PortfolioDashboardSource,
  type PortfolioDashboardSubjectReference,
  type PortfolioIntelligenceDashboard,
  type PortfolioIntelligenceDashboardState,
} from "./contracts";

export function buildPortfolioIntelligenceDashboard(
  source: PortfolioDashboardSource,
  query: GetPortfolioIntelligenceDashboardQuery,
): PortfolioIntelligenceDashboardState {
  const limits = {
    recommendations: bound(query.recommendationLimit, PORTFOLIO_DASHBOARD_LIMITS.recommendations),
    drivers: bound(query.driverLimit, PORTFOLIO_DASHBOARD_LIMITS.positiveDrivers),
    changes: bound(query.changeLimit, PORTFOLIO_DASHBOARD_LIMITS.changes),
    attention: bound(query.attentionLimit, PORTFOLIO_DASHBOARD_LIMITS.attention),
  };
  const properties = source.current.properties.filter((item) => item.active);
  const opportunities = source.current.opportunities.filter((item) => item.active);
  const lifecycle = properties.length === 0 ? (opportunities.length ? "formation-stage" : "empty") : properties.length === 1 ? "single-property" : "operating";
  const portfolio = portfolioSummary(source, query, lifecycle);
  const healthStatus = freshnessHealth(source, query);
  const allocationStatus = freshnessAllocation(source, query);
  const recommendationStatus = freshnessRecommendations(source, query);
  const limitations = limitationsFor(source, healthStatus, allocationStatus, recommendationStatus);
  const capital = capitalSummary(source);
  const allocation = allocationSummary(source);
  const recommendations = recommendationSummary(source, recommendationStatus, limits.recommendations);

  if (lifecycle === "empty") return Object.freeze({ status: "empty", dashboard: Object.freeze({ portfolio, capital, limitations }) });
  if (lifecycle === "formation-stage") return Object.freeze({ status: "formation-stage", dashboard: Object.freeze({ portfolio, capital, allocation, recommendations, limitations }) });

  const health = healthSummary(source);
  const changes = changeSummary(source, limits.changes);
  const drivers = driverSummary(source, limits.drivers);
  const attention = attentionSummary(source, healthStatus, allocationStatus, recommendationStatus, limits.attention);
  const freshness = freshnessSummary(source, healthStatus, allocationStatus, recommendationStatus);
  const dashboard: PortfolioIntelligenceDashboard = Object.freeze({
    portfolio,
    executiveSummary: Object.freeze({
      healthBand: health.band ?? null,
      ...(health.score !== undefined ? { healthScore: health.score } : {}),
      healthDirection: health.movement.status === "stable" ? "stable" : health.movement.status,
      primaryConstraint: primaryConstraint(source),
      capitalStatus: capital.status,
      allocationPosture: allocation.posture,
      topRecommendation: recommendations.topRecommendations[0] ? recommendationReference(recommendations.topRecommendations[0]) : null,
      confidence: recommendations.status === "available" ? source.recommendations!.confidence : source.current.health?.confidence ?? source.current.allocation?.confidence ?? null,
      intelligenceStatus: freshness.overall,
    }),
    health,
    capital,
    allocation,
    recommendations,
    changes,
    drivers,
    attention,
    freshness,
    capabilities: capabilities(Boolean(source.current.health), Boolean(source.current.allocation), Boolean(source.recommendations)),
    limitations,
  });
  const unavailableSections: PortfolioDashboardSection[] = [];
  if (healthStatus !== "current") unavailableSections.push("health");
  if (allocationStatus !== "current") unavailableSections.push("allocation");
  if (recommendationStatus !== "current") unavailableSections.push("recommendations");
  if (!source.previousHealth) unavailableSections.push("changes");
  return unavailableSections.length
    ? Object.freeze({ status: "degraded", dashboard, unavailableSections: Object.freeze(unavailableSections) })
    : Object.freeze({ status: "ready", dashboard });
}

function portfolioSummary(source: PortfolioDashboardSource, query: GetPortfolioIntelligenceDashboardQuery, lifecycle: PortfolioDashboardPortfolioSummary["lifecycle"]): PortfolioDashboardPortfolioSummary {
  return Object.freeze({
    id: source.current.portfolioId.value,
    name: source.current.name,
    activePropertyCount: source.current.properties.filter((item) => item.active).length,
    activeOpportunityCount: source.current.opportunities.filter((item) => item.active).length,
    reportingCurrency: source.current.reportingCurrency,
    updatedAt: new Date(source.current.updatedAt),
    observationWindow: cloneWindow(source.current.health?.observationWindow ?? query.observationWindow),
    lifecycle,
    workspaceDestination: workspacePath(source),
  });
}

function healthSummary(source: PortfolioDashboardSource): PortfolioDashboardHealthSummary {
  const current = source.current.health;
  if (!current) return Object.freeze({ status: "unavailable", movement: Object.freeze({ status: "not-comparable", reason: "coverage-insufficient" }), limitingDimensions: Object.freeze([]), dimensions: Object.freeze([]), destination: `${workspacePath(source)}#health` });
  const movement = healthMovement(source.previousHealth, current);
  const evaluated = new Map(current.dimensionResults.filter((item) => item.status === "evaluated").map((item) => [item.assessment.dimension, item.assessment]));
  return Object.freeze({
    status: "available",
    band: current.overall.band,
    score: current.overall.score.value,
    confidence: current.confidence,
    movement,
    evaluatedAt: new Date(current.evaluatedAt),
    limitingDimensions: Object.freeze(current.overall.limitingDimensions.slice(0, PORTFOLIO_DASHBOARD_LIMITS.limitingDimensions).map((dimension) => {
      const assessment = evaluated.get(dimension);
      const finding = assessment?.findings.find((item) => ["critical", "high", "warning"].includes(item.severity));
      return Object.freeze({
        dimension,
        band: assessment?.band ?? null,
        ...(finding ? { findingCode: finding.code } : {}),
        ...(finding?.subjectId ? { subject: subject(source, finding.subject === "market" ? "market" : finding.subject === "property" ? "property" : "portfolio", finding.subjectId) } : {}),
        destination: `${workspacePath(source)}#health`,
      });
    })),
    dimensions: Object.freeze(current.dimensionResults.map((item) => item.status === "evaluated"
      ? Object.freeze({
          dimension: item.assessment.dimension,
          status: item.status,
          band: item.assessment.band,
          score: item.assessment.score.value,
          confidence: item.assessment.confidence.level,
          ...(item.assessment.findings[0] ? { findingCode: item.assessment.findings[0].code } : {}),
        })
      : Object.freeze({ dimension: item.dimension, status: item.status, confidence: item.status === "insufficient-data" ? item.confidence.level : "unavailable" }))),
    destination: `${workspacePath(source)}#health`,
  });
}

function healthMovement(previous: PortfolioHealthAssessment | null, current: PortfolioHealthAssessment): PortfolioDashboardHealthMovement {
  if (!previous) return Object.freeze({ status: "not-comparable", reason: "no-previous-assessment" });
  if (previous.policyVersion !== current.policyVersion) return Object.freeze({ status: "not-comparable", reason: "policy-incompatible" });
  if (previous.observationWindow.start.getTime() !== current.observationWindow.start.getTime() || previous.observationWindow.end.getTime() !== current.observationWindow.end.getTime()) return Object.freeze({ status: "not-comparable", reason: "window-incompatible" });
  const change = comparePortfolioHealth(previous, current);
  if (!change.policyCompatible || change.overallChange === "not-comparable") return Object.freeze({ status: "not-comparable", reason: "coverage-insufficient" });
  const keyDrivers = change.dimensionChanges.filter((item) => item.change !== "unchanged" && item.change !== "not-comparable").sort((a, b) => Math.abs(b.scoreDelta ?? 0) - Math.abs(a.scoreDelta ?? 0) || a.dimension.localeCompare(b.dimension)).slice(0, 3).map((item) => `${item.dimension}:${item.change}`);
  return change.overallChange === "unchanged"
    ? Object.freeze({ status: "stable", ...(change.scoreDelta !== undefined ? { scoreDelta: change.scoreDelta } : {}), keyDrivers: Object.freeze(keyDrivers) })
    : Object.freeze({ status: change.overallChange, ...(change.scoreDelta !== undefined ? { scoreDelta: change.scoreDelta } : {}), bandChanged: Boolean(change.bandChange), keyDrivers: Object.freeze(keyDrivers) });
}

function capitalSummary(source: PortfolioDashboardSource): PortfolioDashboardCapitalSummary {
  const health = source.current.health;
  const allocation = source.current.allocation;
  if (!health && !allocation) return unavailableCapital(source);
  const healthCapital = health?.capitalAssessment;
  const position = allocation?.capitalPosition;
  const mandatory = allocation?.mandatoryCoverage;
  const urgent = mandatory?.obligations.slice().sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.candidateId.value.localeCompare(b.candidateId.value))[0] ?? null;
  const unfunded = mandatory?.unfunded.amount ?? healthCapital?.unfundedCommitment.amount ?? null;
  const deployable = position?.deployableCapital.amount ?? null;
  const status = unfunded !== null && unfunded > 0 ? "overcommitted" : deployable !== null && deployable <= 0 ? "constrained" : "protected";
  return Object.freeze({
    status,
    reportingCurrency: source.current.reportingCurrency,
    available: position?.availableCapital.amount ?? healthCapital?.available.amount ?? null,
    protected: position?.requiredMinimumReserve.amount ?? healthCapital?.reserved.amount ?? null,
    committed: position?.committedCapital.amount ?? healthCapital?.committed.amount ?? null,
    nearTermObligations: position?.nearTermObligations.amount ?? null,
    deployable,
    unfunded,
    reserveCoverage: healthCapital?.liquidityCoverage?.value ?? null,
    mandatoryRequired: mandatory?.totalRequired.amount ?? null,
    mandatoryFunded: mandatory?.funded.amount ?? null,
    mostUrgentObligation: urgent ? Object.freeze({ id: urgent.candidateId.value, amount: urgent.amount?.amount ?? null, urgency: urgent.urgency }) : null,
    confidence: allocation?.confidence ?? health?.confidence ?? null,
    ...(allocation?.evaluatedAt ? { evaluatedAt: new Date(allocation.evaluatedAt) } : health?.evaluatedAt ? { evaluatedAt: new Date(health.evaluatedAt) } : {}),
    destination: `${workspacePath(source)}#capital`,
  });
}

function unavailableCapital(source: PortfolioDashboardSource): PortfolioDashboardCapitalSummary {
  return Object.freeze({ status: "unavailable", reportingCurrency: source.current.reportingCurrency, available: null, protected: null, committed: null, nearTermObligations: null, deployable: null, unfunded: null, reserveCoverage: null, mandatoryRequired: null, mandatoryFunded: null, mostUrgentObligation: null, confidence: null, destination: `${workspacePath(source)}#capital` });
}

function allocationSummary(source: PortfolioDashboardSource): PortfolioDashboardAllocationSummary {
  const allocation = source.current.allocation;
  if (!allocation) return Object.freeze({ status: "unavailable", posture: null, confidence: null, primaryConstraint: null, primaryCandidate: null, destination: `${workspacePath(source)}#allocation` });
  const candidate = allocation.primaryCandidateId ? allocation.candidates.find((item) => item.candidate.id.equals(allocation.primaryCandidateId!)) : undefined;
  return Object.freeze({
    status: "available",
    posture: allocation.recommendedPosture,
    confidence: allocation.confidence,
    primaryConstraint: allocation.constraints[0]?.code ?? null,
    primaryCandidate: candidate ? Object.freeze({
      id: candidate.candidate.id.value,
      purpose: candidate.candidate.purpose,
      subject: allocationSubject(source, candidate),
      requiredCapital: candidate.candidate.requiredCapital.status === "known" ? candidate.candidate.requiredCapital.amount.amount : null,
      feasibility: candidate.feasibility.status,
      rank: candidate.rank,
      healthDirection: candidate.candidate.expectedImpact.health.expectedDirection,
      liquidityAfter: candidate.feasibility.status === "feasible" ? candidate.feasibility.deployableCapitalAfter.amount : null,
      strategicAlignment: candidate.candidate.expectedImpact.strategy.status,
      primaryTradeOff: candidate.tradeOffs[0]?.code ?? null,
    }) : null,
    evaluatedAt: new Date(allocation.evaluatedAt),
    destination: `${workspacePath(source)}#allocation`,
  });
}

function recommendationSummary(source: PortfolioDashboardSource, freshness: ReturnType<typeof freshnessRecommendations>, limit: number): PortfolioDashboardRecommendationSummary {
  const assessment = source.recommendations;
  if (!assessment) return Object.freeze({ status: "unavailable", posture: null, criticalCount: 0, highCount: 0, totalActiveCount: 0, topRecommendations: Object.freeze([]), conflictingRecommendations: Object.freeze([]), stale: false, destination: workspacePath(source) });
  const histories = new Map(source.recommendationHistories.map((history) => [history.recommendationId.value, history]));
  const inactive = new Set(["resolved", "dismissed", "superseded", "expired", "historical"]);
  const active = assessment.recommendations.filter((item) => !inactive.has(histories.get(item.id.value)?.currentStatus ?? "generated")).sort((a, b) => a.rank - b.rank || a.id.value.localeCompare(b.id.value));
  const activeIds = new Set(active.map((item) => item.id.value));
  return Object.freeze({
    status: "available",
    posture: assessment.posture,
    criticalCount: active.filter((item) => item.priority === "critical").length,
    highCount: active.filter((item) => item.priority === "high").length,
    totalActiveCount: active.length,
    topRecommendations: Object.freeze(active.slice(0, limit).map((item) => mapRecommendation(source, item, histories.get(item.id.value)))),
    conflictingRecommendations: Object.freeze(assessment.conflicts
      .filter((item) => item.recommendationIds.every((id) => activeIds.has(id.value)))
      .slice(0, limit)
      .map((item) => Object.freeze({ recommendationIds: Object.freeze([item.recommendationIds[0].value, item.recommendationIds[1].value]) as readonly [string, string], code: item.code, destination: workspacePath(source) }))),
    stale: freshness !== "current",
    evaluatedAt: new Date(assessment.evaluatedAt),
    destination: workspacePath(source),
  });
}

function mapRecommendation(source: PortfolioDashboardSource, item: PortfolioRecommendation, history?: PortfolioRecommendationHistory): PortfolioDashboardRecommendation {
  return Object.freeze({
    id: item.id.value,
    category: item.category,
    type: item.type,
    priority: item.priority,
    rationaleCode: item.rationaleCode,
    ignoredImpactCode: item.ignoredImpactCode,
    subject: subject(source, item.recommendedAction.subject.type, item.recommendedAction.subject.id),
    primaryBenefit: item.benefits[0] ?? null,
    primaryTradeOff: item.tradeOffs[0] ?? null,
    confidence: item.confidence,
    lifecycleStatus: history?.currentStatus ?? "generated",
    evidenceCount: item.evidence.length,
    conflictIds: Object.freeze(item.conflictIds.map((id) => id.value)),
    destination: workspacePath(source),
  });
}

function changeSummary(source: PortfolioDashboardSource, limit: number) {
  const items: PortfolioDashboardChange[] = [];
  if (source.previousHealth && source.current.health) {
    const change = comparePortfolioHealth(source.previousHealth, source.current.health);
    if (change.policyCompatible && change.overallChange !== "not-comparable" && change.overallChange !== "unchanged") items.push(changeItem("health-overall", "health", `PORTFOLIO_HEALTH_${change.overallChange.toUpperCase()}`, change.overallChange === "improved" ? "positive" : "negative", source.current.health.evaluatedAt, `${workspacePath(source)}#health`));
    for (const finding of change.newFindings) items.push(changeItem(`health-new-${finding.code}-${finding.subjectId ?? ""}`, "health", `NEW_${finding.code}`, "negative", source.current.health.evaluatedAt, `${workspacePath(source)}#health`));
    for (const finding of change.resolvedFindings) items.push(changeItem(`health-resolved-${finding.code}-${finding.subjectId ?? ""}`, "health", `RESOLVED_${finding.code}`, "positive", source.current.health.evaluatedAt, `${workspacePath(source)}#health`));
  }
  if (source.previousAllocation && source.current.allocation) {
    const change = compareCapitalAllocation(source.previousAllocation, source.current.allocation);
    if (change.comparable && change.postureChange) items.push(changeItem("allocation-posture", "allocation", "PORTFOLIO_ALLOCATION_POSTURE_CHANGED", "neutral", source.current.allocation.evaluatedAt, `${workspacePath(source)}#allocation`));
    if (change.comparable && change.previousPrimaryCandidateId !== change.currentPrimaryCandidateId) items.push(changeItem("allocation-primary", "allocation", "PORTFOLIO_PRIMARY_CANDIDATE_CHANGED", "neutral", source.current.allocation.evaluatedAt, `${workspacePath(source)}#allocation`));
    if (change.comparable && source.previousAllocation.capitalPosition.deployableCapital.amount !== source.current.allocation.capitalPosition.deployableCapital.amount) {
      const positive = source.current.allocation.capitalPosition.deployableCapital.amount > source.previousAllocation.capitalPosition.deployableCapital.amount;
      items.push(changeItem("capital-deployable", "capital", "PORTFOLIO_DEPLOYABLE_CAPITAL_CHANGED", positive ? "positive" : "negative", source.current.allocation.evaluatedAt, `${workspacePath(source)}#capital`));
    }
  }
  if (source.previousRecommendations && source.recommendations) {
    const change = comparePortfolioRecommendations(source.previousRecommendations, source.recommendations);
    if (change.comparable) {
      change.newRecommendations.forEach((id) => items.push(changeItem(`recommendation-new-${id.value}`, "recommendation", "PORTFOLIO_RECOMMENDATION_GENERATED", "neutral", source.recommendations!.evaluatedAt, workspacePath(source))));
      change.resolvedRecommendations.forEach((id) => items.push(changeItem(`recommendation-resolved-${id.value}`, "recommendation", "PORTFOLIO_RECOMMENDATION_RESOLVED", "positive", source.recommendations!.evaluatedAt, workspacePath(source))));
      change.escalatedRecommendations.forEach((id) => items.push(changeItem(`recommendation-escalated-${id.value}`, "recommendation", "PORTFOLIO_RECOMMENDATION_ESCALATED", "negative", source.recommendations!.evaluatedAt, workspacePath(source))));
    }
  }
  const comparable = Boolean(source.previousHealth && source.current.health && source.previousHealth.policyVersion === source.current.health.policyVersion && sameWindow(source.previousHealth, source.current.health));
  return Object.freeze({
    comparable,
    ...(!comparable ? { noComparisonReason: !source.previousHealth ? "no-previous-assessment" : "incompatible-assessments" } : {}),
    items: Object.freeze(uniqueBy(items, (item) => item.id).sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0) || a.id.localeCompare(b.id)).slice(0, limit)),
  });
}

function driverSummary(source: PortfolioDashboardSource, limit: number) {
  const health = source.current.health;
  const recommendations = source.recommendations?.recommendations ?? [];
  const rows = health ? uniqueBy([
    ...health.contributionSummary.topRevenueContributors,
    ...health.contributionSummary.topNoiContributors,
    ...health.contributionSummary.negativeContributors,
    ...health.contributionSummary.unknownContributors,
  ], (item) => item.propertyId) : [];
  const mapped = rows.map((item): PortfolioDashboardDriver => {
    return Object.freeze({
      subject: subject(source, "property", item.propertyId),
      contribution: item.contribution === "positive" ? "positive" : "constraining",
      ...(item.revenueShare ? { revenueShare: item.revenueShare.value } : {}),
      ...(item.noiShare ? { noiShare: item.noiShare.value } : {}),
      ...(item.capitalShare ? { capitalShare: item.capitalShare.value } : {}),
      ...(item.healthDrivers[0] ? { driverCode: item.healthDrivers[0].code } : {}),
      confidence: item.dataQuality.level,
      recommendationCount: recommendations.filter((recommendation) => recommendation.affectedObjects.some((affected) => affected.type === "property" && affected.id === item.propertyId)).length,
    });
  });
  const capitalConsuming = source.current.allocation?.candidates.filter((item) => item.candidate.subject.type === "opportunity" || item.candidate.subject.type === "acquisition").filter((item) => item.candidate.requiredCapital.status === "known").sort((a, b) => (b.candidate.requiredCapital.status === "known" ? b.candidate.requiredCapital.amount.amount : 0) - (a.candidate.requiredCapital.status === "known" ? a.candidate.requiredCapital.amount.amount : 0) || a.candidate.id.value.localeCompare(b.candidate.id.value)).slice(0, limit).map((item): PortfolioDashboardDriver => Object.freeze({
    subject: allocationSubject(source, item),
    contribution: "capital-consuming",
    confidence: item.confidence.level,
    recommendationCount: recommendations.filter((recommendation) => recommendation.affectedObjects.some((affected) => affected.id === allocationSubject(source, item).id)).length,
    driverCode: item.candidate.purpose,
  })) ?? [];
  return Object.freeze({
    positive: Object.freeze(mapped.filter((item) => item.contribution === "positive").sort(driverOrder).slice(0, limit)),
    constraining: Object.freeze(mapped.filter((item) => item.contribution === "constraining").sort(driverOrder).slice(0, limit)),
    capitalConsuming: Object.freeze(capitalConsuming),
    exposures: Object.freeze((health?.concentrationAssessments ?? []).filter((item) => item.topExposure).sort((a, b) => (b.topExposure?.share.value ?? 0) - (a.topExposure?.share.value ?? 0) || a.type.localeCompare(b.type)).slice(0, PORTFOLIO_DASHBOARD_LIMITS.exposures).map((item) => Object.freeze({
      type: item.type,
      key: item.topExposure!.key,
      share: item.topExposure!.share.value,
      basis: item.topExposure!.basis,
      band: item.band,
      destination: `${workspacePath(source)}#composition`,
    }))),
    singleProperty: source.current.properties.filter((item) => item.active).length === 1,
  });
}

function attentionSummary(source: PortfolioDashboardSource, healthStatus: ReturnType<typeof freshnessHealth>, allocationStatus: ReturnType<typeof freshnessAllocation>, recommendationStatus: ReturnType<typeof freshnessRecommendations>, limit: number) {
  const items: PortfolioDashboardAttentionItem[] = [];
  const allocation = source.current.allocation;
  if (allocation && allocation.mandatoryCoverage.unfunded.amount > 0) items.push(attention("capital-unfunded", "capital", "critical", "PORTFOLIO_MANDATORY_CAPITAL_UNFUNDED", "mandatory-capital", `${workspacePath(source)}#capital`));
  for (const item of source.current.health?.attentionPriorities ?? []) items.push(Object.freeze({
    rank: 0,
    type: "health",
    severity: item.severity === "warning" ? "medium" : item.severity,
    code: item.findingCode,
    ...(item.subjectId ? { subject: subject(source, item.subjectType === "property" ? "property" : item.subjectType === "market" ? "market" : "portfolio", item.subjectId) } : {}),
    sourceReference: Object.freeze({ type: "health-attention", referenceId: `${item.rank}:${item.findingCode}` }),
    destination: `${workspacePath(source)}#health`,
  }));
  for (const item of source.recommendations?.recommendations.filter((recommendation) => recommendation.priority === "critical" || recommendation.priority === "high").sort((a, b) => a.rank - b.rank) ?? []) items.push(Object.freeze({
    rank: 0,
    type: "recommendation",
    severity: item.priority === "critical" ? "critical" : "high",
    code: item.rationaleCode,
    subject: subject(source, item.recommendedAction.subject.type, item.recommendedAction.subject.id),
    sourceReference: Object.freeze({ type: "recommendation", referenceId: item.id.value }),
    destination: workspacePath(source),
  }));
  for (const gap of source.current.health?.dataGaps.filter((item) => item.impact === "blocking") ?? []) items.push(attention(`gap-${gap.code}-${gap.subjectId ?? ""}`, "data", "high", gap.code, `${gap.code}:${gap.subjectId ?? "portfolio"}`, `${workspacePath(source)}#quality`));
  if (healthStatus !== "current") items.push(attention("stale-health", "data", "high", "PORTFOLIO_HEALTH_REEVALUATION_REQUIRED", "health-freshness", `${workspacePath(source)}#quality`));
  if (allocationStatus !== "current") items.push(attention("stale-allocation", "data", "high", "PORTFOLIO_ALLOCATION_REEVALUATION_REQUIRED", "allocation-freshness", `${workspacePath(source)}#quality`));
  if (recommendationStatus !== "current") items.push(attention("stale-recommendations", "data", "high", "PORTFOLIO_RECOMMENDATIONS_REEVALUATION_REQUIRED", "recommendation-freshness", `${workspacePath(source)}#quality`));
  const severity = { critical: 0, high: 1, medium: 2, informational: 3 };
  const ordered = uniqueBy(items, (item) => `${item.type}:${item.code}:${item.subject?.id ?? ""}`).sort((a, b) => severity[a.severity] - severity[b.severity] || a.sourceReference.referenceId.localeCompare(b.sourceReference.referenceId)).slice(0, limit);
  return Object.freeze({ items: Object.freeze(ordered.map((item, index) => Object.freeze({ ...item, rank: index + 1 }))) });
}

function freshnessSummary(source: PortfolioDashboardSource, healthStatus: ReturnType<typeof freshnessHealth>, allocationStatus: ReturnType<typeof freshnessAllocation>, recommendationStatus: ReturnType<typeof freshnessRecommendations>): PortfolioDashboardFreshnessSummary {
  const health = source.current.health;
  const total = health?.contributionSummary ? source.current.properties.filter((item) => item.active).length : 0;
  const coveredIds = new Set(health ? [
    ...health.contributionSummary.topRevenueContributors,
    ...health.contributionSummary.topNoiContributors,
    ...health.contributionSummary.negativeContributors,
    ...health.contributionSummary.unknownContributors,
  ].map((item) => item.propertyId) : []);
  const statuses = [healthStatus, allocationStatus, recommendationStatus];
  const overall = statuses.some((item) => item === "stale" || item === "incompatible") ? "stale" : statuses.some((item) => item === "unavailable") ? "incomplete" : "current";
  return Object.freeze({
    overall,
    confidence: source.recommendations?.confidence ?? health?.confidence ?? source.current.allocation?.confidence ?? null,
    propertyCoverage: total ? Object.freeze({ covered: coveredIds.size, total }) : null,
    staleObservationCount: health?.dataGaps.filter((item) => item.code === "PORTFOLIO_DATA_STALE").length ?? 0,
    blockingGapCount: (health?.dataGaps.filter((item) => item.impact === "blocking").length ?? 0) + (source.current.allocation?.dataGaps.filter((item) => item.impact === "blocking").length ?? 0),
    healthEvaluatedAt: health ? new Date(health.evaluatedAt) : null,
    allocationEvaluatedAt: source.current.allocation ? new Date(source.current.allocation.evaluatedAt) : null,
    recommendationEvaluatedAt: source.recommendations ? new Date(source.recommendations.evaluatedAt) : null,
    healthStatus,
    allocationStatus,
    recommendationStatus,
    lineage: Object.freeze({
      portfolioVersion: source.current.version,
      healthPolicyVersion: health?.policyVersion ?? null,
      allocationPolicyVersion: source.current.allocation?.allocationPolicyVersion ?? null,
      recommendationPolicyVersion: source.recommendations?.recommendationPolicyVersion ?? null,
    }),
  });
}

function freshnessHealth(source: PortfolioDashboardSource, query: GetPortfolioIntelligenceDashboardQuery) {
  return !source.current.health ? "unavailable" as const
    : source.current.health.portfolioVersion !== source.current.version || !sameWindow(source.current.health, query.observationWindow) ? "stale" as const
      : "current" as const;
}
function freshnessAllocation(source: PortfolioDashboardSource, query: GetPortfolioIntelligenceDashboardQuery) {
  const allocation = source.current.allocation, health = source.current.health;
  return !allocation ? "unavailable" as const
    : allocation.portfolioVersion !== source.current.version ? "stale" as const
      : !health || allocation.healthPolicyVersion !== health.policyVersion ? "incompatible" as const
        : freshnessHealth(source, query) !== "current" || allocation.evaluatedAt < health.evaluatedAt ? "stale" as const : "current" as const;
}
function freshnessRecommendations(source: PortfolioDashboardSource, query: GetPortfolioIntelligenceDashboardQuery) {
  const recommendation = source.recommendations, health = source.current.health, allocation = source.current.allocation;
  return !recommendation ? "unavailable" as const
    : recommendation.portfolioVersion !== source.current.version ? "stale" as const
      : !health || !allocation || recommendation.healthPolicyVersion !== health.policyVersion || recommendation.allocationPolicyVersion !== allocation.allocationPolicyVersion ? "incompatible" as const
        : !sameWindow(recommendation, query.observationWindow) || freshnessAllocation(source, query) !== "current" || recommendation.evaluatedAt < allocation.evaluatedAt ? "stale" as const : "current" as const;
}

function limitationsFor(source: PortfolioDashboardSource, health: ReturnType<typeof freshnessHealth>, allocation: ReturnType<typeof freshnessAllocation>, recommendations: ReturnType<typeof freshnessRecommendations>): readonly PortfolioDashboardLimitation[] {
  const items: PortfolioDashboardLimitation[] = [];
  if (health !== "current") items.push(limitation(`PORTFOLIO_DASHBOARD_HEALTH_${health.toUpperCase()}`, "health", health === "unavailable" ? "material" : "blocking", "REEVALUATE_HEALTH"));
  if (allocation !== "current") items.push(limitation(`PORTFOLIO_DASHBOARD_ALLOCATION_${allocation.toUpperCase()}`, "allocation", allocation === "unavailable" ? "material" : "blocking", "REEVALUATE_ALLOCATION"));
  if (recommendations !== "current") items.push(limitation(`PORTFOLIO_DASHBOARD_RECOMMENDATIONS_${recommendations.toUpperCase()}`, "recommendations", recommendations === "unavailable" ? "material" : "blocking", "REEVALUATE_RECOMMENDATIONS"));
  if (!source.previousHealth) items.push(limitation("PORTFOLIO_DASHBOARD_NO_COMPARABLE_HISTORY", "changes", "minor", "WAIT_FOR_NEXT_COMPATIBLE_ASSESSMENT"));
  return Object.freeze(items);
}

function primaryConstraint(source: PortfolioDashboardSource) {
  const priority = source.current.health?.attentionPriorities[0];
  if (priority) return Object.freeze({
    code: priority.findingCode,
    dimension: priority.dimension,
    severity: priority.severity,
    ...(priority.subjectId ? { subject: subject(source, priority.subjectType === "property" ? "property" : priority.subjectType === "market" ? "market" : "portfolio", priority.subjectId) } : {}),
    destination: `${workspacePath(source)}#health`,
  });
  const constraint = source.current.allocation?.constraints[0];
  return constraint ? Object.freeze({ code: constraint.code, severity: constraint.severity, destination: `${workspacePath(source)}#allocation` }) : null;
}

function capabilities(health: boolean, allocation: boolean, recommendations: boolean) {
  const no = (reasonCode: string) => Object.freeze({ available: false, reasonCode });
  return Object.freeze({
    viewPortfolio: Object.freeze({ available: true }),
    viewHealth: health ? Object.freeze({ available: true }) : no("HEALTH_UNAVAILABLE"),
    viewAllocation: allocation ? Object.freeze({ available: true }) : no("ALLOCATION_UNAVAILABLE"),
    viewRecommendations: recommendations ? Object.freeze({ available: true }) : no("RECOMMENDATIONS_UNAVAILABLE"),
    refreshIntelligence: no("PI_006_REFRESH_NOT_WIRED"),
    acknowledgeRecommendation: no("PI_006_READ_ONLY"),
    deferRecommendation: no("PI_006_READ_ONLY"),
    dismissRecommendation: no("PI_006_READ_ONLY"),
    createAction: no("PI_006_NO_ACTION_CREATION"),
  });
}

function recommendationReference(item: PortfolioDashboardRecommendation) { return Object.freeze({ id: item.id, type: item.type, category: item.category, priority: item.priority, subject: item.subject, destination: item.destination }); }
function allocationSubject(source: PortfolioDashboardSource, item: CapitalAllocationAssessment["candidates"][number]) {
  const value = item.candidate.subject;
  if ("propertyId" in value) return subject(source, "property", value.propertyId);
  if ("opportunityId" in value) return subject(source, "opportunity", value.opportunityId);
  if ("obligationId" in value) return subject(source, "capital", value.obligationId);
  return subject(source, "portfolio", value.portfolioId.value);
}
function subject(source: PortfolioDashboardSource, type: PortfolioDashboardSubjectReference["type"], id: string): PortfolioDashboardSubjectReference {
  const property = type === "property" ? source.current.properties.find((item) => item.propertyId === id) : undefined;
  const opportunity = type === "opportunity" ? source.current.opportunities.find((item) => item.opportunityId === id) : undefined;
  const label = property?.name ?? opportunity?.name ?? id;
  const destination = type === "property" ? `/properties/${encodeURIComponent(id)}`
    : type === "opportunity" ? `/dashboard/investments/opportunities/${encodeURIComponent(id)}`
      : workspacePath(source);
  return Object.freeze({ type, id, label, destination });
}
function workspacePath(source: PortfolioDashboardSource) { return `/dashboard/portfolio/workspace?portfolio=${encodeURIComponent(source.current.portfolioId.value)}`; }
function attention(id: string, type: PortfolioDashboardAttentionItem["type"], severity: PortfolioDashboardAttentionItem["severity"], code: string, referenceId: string, destination: string): PortfolioDashboardAttentionItem { return Object.freeze({ rank: 0, type, severity, code, sourceReference: Object.freeze({ type: id, referenceId }), destination }); }
function limitation(code: string, section: PortfolioDashboardLimitation["section"], impact: PortfolioDashboardLimitation["impact"], guidanceCode: string): PortfolioDashboardLimitation { return Object.freeze({ code, section, impact, guidanceCode }); }
function changeItem(id: string, type: PortfolioDashboardChange["type"], code: string, direction: PortfolioDashboardChange["direction"], occurredAt: Date, destination: string): PortfolioDashboardChange { return Object.freeze({ id, type, code, direction, occurredAt: new Date(occurredAt), destination }); }
function urgencyRank(value: string) { return ({ immediate: 0, "near-term": 1, planned: 2, optional: 3 } as Record<string, number>)[value] ?? 4; }
function driverOrder(a: PortfolioDashboardDriver, b: PortfolioDashboardDriver) { return (b.noiShare ?? b.revenueShare ?? 0) - (a.noiShare ?? a.revenueShare ?? 0) || a.subject.id.localeCompare(b.subject.id); }
function bound(value: number | undefined, maximum: number) { return value === undefined || !Number.isInteger(value) ? maximum : Math.max(1, Math.min(value, maximum)); }
function sameWindow(
  a: { readonly observationWindow: { readonly start: Date; readonly end: Date } },
  b: { readonly observationWindow: { readonly start: Date; readonly end: Date } } | { readonly start: Date; readonly end: Date },
) {
  const window = "observationWindow" in b ? b.observationWindow : b;
  return a.observationWindow.start.getTime() === window.start.getTime() && a.observationWindow.end.getTime() === window.end.getTime();
}
function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] { return [...new Map(values.map((value) => [key(value), value])).values()]; }
function cloneWindow(value: GetPortfolioIntelligenceDashboardQuery["observationWindow"]) { return Object.freeze({ start: new Date(value.start), end: new Date(value.end), ...(value.comparisonStart ? { comparisonStart: new Date(value.comparisonStart) } : {}), ...(value.comparisonEnd ? { comparisonEnd: new Date(value.comparisonEnd) } : {}) }); }

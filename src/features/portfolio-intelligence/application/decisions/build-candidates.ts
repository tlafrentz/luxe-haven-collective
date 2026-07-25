import type { PortfolioFinding, PortfolioFindings } from "../findings";
import type {
  BuildCandidateInput, PortfolioDecisionCandidate, CapitalConflict, ExpectedImpact,
  ResourceRequirement, StrategicAlternative,
} from "./contracts";
import {
  PORTFOLIO_DECISION_POLICY, calculateCapitalReturn, candidateReady,
  evaluateRecommendationStrength,
} from "./policies";

export function buildCapitalAllocationCandidate(input: BuildCandidateInput): PortfolioDecisionCandidate {
  const { finding, workspaceId, now } = input;
  const isRisk = finding.kind === "risk";
  const financial = finding.impact.dimension === "revenue" || finding.impact.dimension === "noi";
  const resources: ResourceRequirement[] = financial ? [{
    type: "management-attention", cadence: "internal", hours: undefined,
    description: "Scope and validate the initiative before committing financial capital.",
    estimated: true, confidence: finding.confidence,
  }] : [{
    type: "team-capacity", cadence: "internal", hours: undefined,
    description: "Investigation and implementation capacity; effort must be confirmed during review.",
    estimated: true, confidence: finding.confidence,
  }];
  const impact: ExpectedImpact = {
    dimensions: [{
      dimension: isRisk ? "risk-reduction" : mapImpact(finding.impact.dimension),
      value: finding.impact.estimatedAmount === undefined
        ? { type: "directional", direction: isRisk ? "decrease" : "increase" }
        : { type: "point", value: finding.impact.estimatedAmount, unit: "organization-reporting-currency" },
      expected: true,
    }],
    measurementPeriod: { minimumDays: 30, maximumDays: 90 },
    basis: { type: "existing-intelligence-recommendation", description: finding.impact.basis },
  };
  const baseline = baselineAlternative(finding, impact);
  const proposed = proposedAlternative(finding, impact, resources);
  const assumptions: PortfolioDecisionCandidate["assumptions"] = finding.assumptions.length
    ? finding.assumptions.map((statement, index) => ({ id: `${finding.id}:assumption:${index}`, statement, status: "unconfirmed" as const, material: true }))
    : [{ id: `${finding.id}:assumption:evidence`, statement: "The source finding remains active and materially unchanged.", status: "unconfirmed", material: true }];
  const dependencies: PortfolioDecisionCandidate["dependencies"] = finding.dependencies.length
    ? finding.dependencies.map((item, index) => ({
      id: `${finding.id}:dependency:${index}`, type: item.type === "provider" ? "provider-data" as const : "property-configuration" as const,
      description: item.label, status: "unresolved" as const, critical: false,
    }))
    : [{ id: `${finding.id}:dependency:capacity`, type: "team-availability", description: "Confirm implementation ownership and capacity.", status: "unresolved", critical: false }];
  const fresh = finding.freshness === "current";
  const strength = evaluateRecommendationStrength({
    confidence: finding.confidence, material: finding.impact.magnitude !== "unquantified",
    dependenciesReady: !dependencies.some(({ critical, status }) => critical && status === "unresolved"),
    fresh, complete: finding.evidence.length > 0,
  });
  const generated = new Date(now);
  const expires = new Date(generated);
  expires.setUTCDate(expires.getUTCDate() + PORTFOLIO_DECISION_POLICY.recommendationValidityDays);
  const candidate: PortfolioDecisionCandidate = {
    id: `candidate:${finding.id}`, workspaceId, sourceFindingIds: [finding.id],
    affectedPropertyIds: finding.affectedPropertyIds,
    category: category(finding), decisionType: decisionType(finding),
    title: isRisk ? `Address ${finding.title}` : `Investigate ${finding.title}`,
    description: `${finding.description} This candidate authorizes review only until explicitly approved.`,
    requestedResources: resources, expectedImpact: impact,
    ...(isRisk ? { riskReduction: impact.dimensions[0] } : {}),
    effort: finding.kind === "opportunity" && finding.effort !== "unknown" ? finding.effort : "moderate",
    horizon: horizon(finding.horizon), confidence: finding.confidence,
    assumptions, dependencies, alternatives: [proposed, baseline],
    recommendedAlternativeId: proposed.id, recommendationStrength: strength,
    capitalReturn: calculateCapitalReturn(resources, impact),
    status: "draft", ordering: {
      materiality: finding.priority.impact, urgency: finding.priority.urgency,
      confidence: finding.confidence, riskReduction: isRisk,
      dependencyReadiness: "review-required", timeToImpact: horizon(finding.horizon),
      rationale: finding.priority.rationale,
    },
    evidenceVersion: `${PORTFOLIO_DECISION_POLICY.version}:${finding.detectedAt}`,
    generatedAt: generated.toISOString(), expiresAt: expires.toISOString(),
  };
  return Object.freeze({ ...candidate, status: candidateReady(candidate) ? "ready-for-review" : "draft" });
}

export function getCapitalAllocationCandidates(findings: PortfolioFindings): readonly PortfolioDecisionCandidate[] {
  return findings.prioritized
    .map((finding) => buildCapitalAllocationCandidate({
      finding, workspaceId: findings.identity.workspaceId, now: findings.evaluatedAt,
    }))
    .sort((left, right) => rank(right.ordering.materiality) - rank(left.ordering.materiality));
}

export function detectCapitalConflicts(candidates: readonly PortfolioDecisionCandidate[]): readonly CapitalConflict[] {
  const conflicts: CapitalConflict[] = [];
  const byProperty = new Map<string, PortfolioDecisionCandidate[]>();
  for (const candidate of candidates) for (const propertyId of candidate.affectedPropertyIds) {
    byProperty.set(propertyId, [...(byProperty.get(propertyId) ?? []), candidate]);
  }
  for (const [propertyId, items] of byProperty) if (items.length > 1) conflicts.push({
    id: `conflict:property:${propertyId}`, type: "property",
    candidateIds: items.map(({ id }) => id),
    description: "Multiple proposed strategies affect the same property and require coordinated review.",
    blocking: false,
  });
  return conflicts;
}

function baselineAlternative(finding: PortfolioFinding, impact: ExpectedImpact): StrategicAlternative {
  return {
    id: `alternative:${finding.id}:baseline`, label: "Maintain Current Strategy",
    description: `Do not initiate a strategic change. The measured ${finding.kind} remains monitored.`,
    baseline: true, requiredResources: [], expectedImpact: {
      ...impact, dimensions: impact.dimensions.map((item) => ({
        ...item, value: { type: "directional" as const, direction: "maintain" as const },
      })),
    }, risks: [{ title: "Finding remains", description: "The underlying condition may persist or change." }],
    confidence: finding.confidence, reversibility: "easily-reversible",
    tradeoffs: ["No implementation disruption.", "The current risk or upside remains unaddressed."],
  };
}
function proposedAlternative(finding: PortfolioFinding, impact: ExpectedImpact, resources: readonly ResourceRequirement[]): StrategicAlternative {
  return {
    id: `alternative:${finding.id}:recommended`,
    label: finding.kind === "risk" ? "Investigate and Mitigate" : "Validate and Pursue",
    description: "Validate assumptions, confirm resources, and proceed only after explicit approval.",
    baseline: false, requiredResources: resources, expectedImpact: impact,
    risks: [{ title: "Expected impact is uncertain", description: "Projection is not a measured outcome or guaranteed return." }],
    confidence: finding.confidence, reversibility: "partially-reversible",
    tradeoffs: ["Consumes operating capacity.", "May require further financial or market evidence."],
  };
}
function category(finding: PortfolioFinding): PortfolioDecisionCandidate["category"] {
  if (finding.category === "data" || finding.category === "data-quality" || finding.category === "provider") return "data-improvement";
  if (finding.category === "operational" || finding.category === "operations") return "operational-improvement";
  if (finding.kind === "risk") return "risk-reduction";
  if (finding.category === "market" || finding.category === "expansion" || finding.category === "diversification") return "market-expansion";
  return "revenue-improvement";
}
function decisionType(finding: PortfolioFinding): PortfolioDecisionCandidate["decisionType"] {
  if (finding.kind === "risk" && finding.category === "concentration") return "reduce-concentration";
  if (finding.kind === "risk") return "mitigate-risk";
  if (finding.category === "market" || finding.category === "expansion") return "enter-market";
  return finding.affectedPropertyIds.length === 1 ? "optimize-property" : "allocate-capital";
}
function horizon(value: PortfolioFinding["horizon"]): PortfolioDecisionCandidate["horizon"] {
  return value === "immediate" ? "immediate" : value === "near-term" ? "near-term"
    : value === "medium-term" ? "quarterly" : value === "long-term" ? "annual" : "multi-year";
}
function mapImpact(value: PortfolioFinding["impact"]["dimension"]): ExpectedImpact["dimensions"][number]["dimension"] {
  return value === "portfolio-resilience" ? "portfolio-diversification"
    : value === "operational" ? "operational-efficiency"
      : value === "guest" ? "guest-experience" : value;
}
function rank(value: string): number { return value === "critical" ? 4 : value === "high" ? 3 : value === "moderate" ? 2 : 1; }

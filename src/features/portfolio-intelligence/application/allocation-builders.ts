import type { PortfolioId } from "@/features/portfolio";
import { Identifier, Money, Percentage } from "@/platform/kernel";

import type {
  CapitalAllocationAcquisitionSource,
  CapitalAllocationCandidate,
  CapitalAllocationCandidateId,
  CapitalAllocationDataGap,
  CapitalAllocationExpectedImpact,
  CapitalAllocationObligationSource,
  CapitalAllocationPosition,
  CapitalAllocationPropertyImprovementSource,
  PortfolioGoalReference,
} from "../domain";

export type CapitalAllocationCandidateBuildResult = Readonly<{
  candidate: CapitalAllocationCandidate | null;
  dataGaps: readonly CapitalAllocationDataGap[];
  excludedReason?: "terminal-opportunity";
}>;

const candidateId = (kind: string, id: string): CapitalAllocationCandidateId =>
  Identifier.create(`capital-candidate-${kind}-${id}` as `capital-candidate-${string}`);

export function buildAcquisitionCandidate(input: {
  portfolioId: PortfolioId;
  source: CapitalAllocationAcquisitionSource;
  goals: readonly PortfolioGoalReference[];
}): CapitalAllocationCandidateBuildResult {
  const source = input.source;
  if (source.acquisitionStatus === "exited" || source.acquisitionStatus === "rejected" || source.acquisitionStatus === "acquired") {
    return Object.freeze({ candidate: null, dataGaps: Object.freeze([]), excludedReason: "terminal-opportunity" });
  }
  const id = candidateId("acquisition", source.opportunityId);
  const gaps = source.requiredCapital ? [] : [dataGap("ALLOCATION_REQUIREMENT_UNKNOWN", "opportunity", "blocking", ["requiredCapital"], id)];
  const impact = defaultImpact(source.confidence, input.goals, {
    financial: source.requiredCapital ? {
      requiredCapital: source.requiredCapital,
      ...(source.projectedAnnualCashFlow ? { projectedAnnualCashFlow: source.projectedAnnualCashFlow } : {}),
      ...(source.projectedNoi ? { projectedAnnualNoi: source.projectedNoi } : {}),
      ...(source.projectedReturn ? { projectedReturn: source.projectedReturn } : {}),
      valueBasis: "investment-analysis",
      confidence: source.confidence,
    } : null,
    diversification: source.marketExposure || source.propertyTypeExposure ? {
      direction: "unknown", affectedExposureTypes: Object.freeze([...(source.marketExposure ? [source.marketExposure.type] : []), ...(source.propertyTypeExposure ? [source.propertyTypeExposure.type] : [])]),
      addressesExistingConcentration: false, introducesNewConcentration: false,
      evidence: Object.freeze([...(source.marketExposure ? [source.marketExposure] : []), ...(source.propertyTypeExposure ? [source.propertyTypeExposure] : [])]),
    } : undefined,
  });
  return Object.freeze({
    candidate: Object.freeze({
      id, portfolioId: input.portfolioId,
      purpose: source.committed ? "acquisition-closing" : "new-acquisition",
      classification: source.committed ? "mandatory" : "growth",
      subject: source.pipelineStage ? Object.freeze({ type: "acquisition" as const, opportunityId: source.opportunityId, pipelineId: `pipeline-${source.opportunityId}` }) : Object.freeze({ type: "opportunity" as const, opportunityId: source.opportunityId }),
      requiredCapital: source.requiredCapital
        ? Object.freeze({ status: "known" as const, amount: source.requiredCapital, fundingType: "one-time" as const, committed: source.committed, reversible: !source.committed, estimated: false })
        : Object.freeze({ status: "unknown" as const, fundingType: "one-time" as const, committed: source.committed, reasonCode: "ALLOCATION_REQUIREMENT_UNKNOWN" }),
      timing: Object.freeze({ urgency: source.committed ? "near-term" as const : "planned" as const, delayImpact: source.committed ? "material" as const : "unknown" as const }),
      expectedImpact: impact,
      risks: Object.freeze(source.riskLevel ? [{ code: "ACQUISITION_RISK", severity: source.riskLevel, evidenceReference: source.analysisId }] : []),
      evidence: Object.freeze([{ kind: "analysis" as const, referenceId: source.analysisId }]),
      confidence: source.confidence,
      sourceVersion: Object.freeze({ source: `investment-analysis:${source.acquisitionRoute}:${source.recommendation}`, version: `${source.opportunityVersion}.${source.analysisVersion}`, updatedAt: new Date(source.updatedAt) }),
    }),
    dataGaps: Object.freeze(gaps),
  });
}

export function buildPropertyImprovementCandidate(input: {
  portfolioId: PortfolioId;
  source: CapitalAllocationPropertyImprovementSource;
  goals: readonly PortfolioGoalReference[];
}): CapitalAllocationCandidateBuildResult {
  const source = input.source, id = candidateId("improvement", source.improvementId);
  const protective = source.category === "risk" || source.category === "compliance" || source.category === "capital-maintenance";
  const gaps = source.requiredCapital ? [] : [dataGap("ALLOCATION_REQUIREMENT_UNKNOWN", "property", "blocking", ["requiredCapital"], id)];
  return Object.freeze({
    candidate: Object.freeze({
      id, portfolioId: input.portfolioId,
      purpose: protective ? "risk-remediation" : "property-improvement",
      classification: protective ? "protective" : "growth",
      subject: Object.freeze({ type: "property" as const, propertyId: source.propertyId }),
      requiredCapital: source.requiredCapital
        ? Object.freeze({ status: "known" as const, amount: source.requiredCapital, fundingType: "one-time" as const, committed: false, reversible: false, estimated: source.expectedFinancialImpact?.valueBasis === "property-improvement-estimate" })
        : Object.freeze({ status: "unknown" as const, fundingType: "one-time" as const, committed: false, reasonCode: "ALLOCATION_REQUIREMENT_UNKNOWN" }),
      timing: source.urgency,
      expectedImpact: defaultImpact(source.confidence, input.goals, { financial: source.expectedFinancialImpact ?? null, health: source.expectedHealthImpact }),
      risks: Object.freeze([]),
      evidence: Object.freeze([{ kind: "property" as const, referenceId: source.propertyId }]),
      confidence: source.confidence,
      sourceVersion: Object.freeze({ source: `property-improvement:${source.category}`, version: 1, updatedAt: new Date(source.updatedAt) }),
    }),
    dataGaps: Object.freeze(gaps),
  });
}

export function buildObligationCandidate(portfolioId: PortfolioId, source: CapitalAllocationObligationSource): CapitalAllocationCandidateBuildResult {
  const id = candidateId("obligation", source.obligationId);
  const gaps = source.amount ? [] : [dataGap("ALLOCATION_REQUIREMENT_UNKNOWN", "capital", "blocking", ["amount"], id)];
  return Object.freeze({
    candidate: Object.freeze({
      id, portfolioId,
      purpose: source.type === "acquisition-closing" ? "acquisition-closing" : source.type === "risk-remediation" || source.type === "critical-maintenance" ? "risk-remediation" : "mandatory-obligation",
      classification: "mandatory",
      subject: source.subject,
      requiredCapital: source.amount
        ? Object.freeze({ status: "known" as const, amount: source.amount, fundingType: "one-time" as const, committed: source.committed, reversible: false, estimated: false, ...(source.requiredBy ? { dueAt: new Date(source.requiredBy) } : {}) })
        : Object.freeze({ status: "unknown" as const, fundingType: "one-time" as const, committed: source.committed, reasonCode: "ALLOCATION_REQUIREMENT_UNKNOWN" }),
      timing: Object.freeze({ urgency: source.severity === "critical" ? "immediate" as const : source.requiredBy ? "near-term" as const : "planned" as const, ...(source.requiredBy ? { requiredBy: new Date(source.requiredBy) } : {}), delayImpact: source.severity === "critical" ? "critical" as const : "material" as const }),
      expectedImpact: defaultImpact(source.confidence, [], {
        financial: source.amount ? Object.freeze({ requiredCapital: source.amount, valueBasis: "committed-obligation" as const, confidence: source.confidence }) : null,
        health: Object.freeze({ affectedDimensions: Object.freeze([]), expectedDirection: source.type === "risk-remediation" ? "improve" as const : "maintain" as const, addressesLimitingDimension: false, addressesCriticalFinding: source.severity === "critical", evidence: Object.freeze([]) }),
      }),
      risks: Object.freeze([]),
      evidence: Object.freeze([{ kind: "obligation" as const, referenceId: source.obligationId }]),
      confidence: source.confidence,
      sourceVersion: Object.freeze({ source: `obligation:${source.type}`, version: 1, updatedAt: new Date(source.requiredBy ?? new Date(0)) }),
    }),
    dataGaps: Object.freeze(gaps),
  });
}

export function buildPreserveCapitalCandidate(input: {
  portfolioId: PortfolioId; capital: CapitalAllocationPosition; confidence: import("@/platform/scoring").ConfidenceAssessment;
}): CapitalAllocationCandidate {
  return Object.freeze({
    id: candidateId("hold", input.portfolioId.value), portfolioId: input.portfolioId,
    purpose: "defer-deployment", classification: "hold",
    subject: Object.freeze({ type: "portfolio" as const, portfolioId: input.portfolioId }),
    requiredCapital: Object.freeze({ status: "known" as const, amount: Money.zero(), fundingType: "reserve" as const, committed: false, reversible: true, estimated: false }),
    timing: Object.freeze({ urgency: "optional", delayImpact: "unknown" }),
    expectedImpact: defaultImpact(input.confidence, [], {
      financial: null,
      health: Object.freeze({ affectedDimensions: Object.freeze([{ dimension: "capital" as const, direction: "maintain" as const }]), expectedDirection: "maintain", addressesLimitingDimension: false, addressesCriticalFinding: false, evidence: Object.freeze([]) }),
    }),
    risks: Object.freeze([]), evidence: Object.freeze([{ kind: "calculation" as const, referenceId: "preserve-deployable-capital" }]),
    confidence: input.confidence, sourceVersion: Object.freeze({ source: "synthetic-preserve-capital", version: 1, updatedAt: new Date(input.capital.capturedAt) }),
  });
}

function defaultImpact(
  confidence: import("@/platform/scoring").ConfidenceAssessment,
  goals: readonly PortfolioGoalReference[],
  override: Partial<CapitalAllocationExpectedImpact>,
): CapitalAllocationExpectedImpact {
  return Object.freeze({
    financial: override.financial ?? null,
    health: override.health ?? Object.freeze({ affectedDimensions: Object.freeze([]), expectedDirection: "unknown", addressesLimitingDimension: false, addressesCriticalFinding: false, evidence: Object.freeze([]) }),
    strategy: override.strategy ?? Object.freeze({ status: goals.length ? "partially-aligned" : "unevaluable", alignedGoals: Object.freeze([...goals]), conflictingGoals: Object.freeze([]), confidence }),
    diversification: override.diversification ?? Object.freeze({ direction: "unknown", affectedExposureTypes: Object.freeze([]), addressesExistingConcentration: false, introducesNewConcentration: false, evidence: Object.freeze([]) }),
    risk: override.risk ?? Object.freeze({ direction: "unknown", risksResolved: Object.freeze([]), risksIntroduced: Object.freeze([]), residualRisk: "unknown" }),
    operations: override.operations ?? null,
  });
}
function dataGap(code: CapitalAllocationDataGap["code"], source: CapitalAllocationDataGap["source"], impact: CapitalAllocationDataGap["impact"], missingFields: readonly string[], candidateId: CapitalAllocationCandidateId): CapitalAllocationDataGap {
  return Object.freeze({ code, candidateId, source, impact, missingFields: Object.freeze([...missingFields]), confidencePenalty: Percentage.create(impact === "blocking" ? 40 : 15) });
}

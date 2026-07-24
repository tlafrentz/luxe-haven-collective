import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore, Score, ScoreBreakdown, ScoreComponent } from "@/platform/scoring";

import type {
  CapitalAllocationAssessment,
  CapitalAllocationBlocker,
  CapitalAllocationCandidate,
  CapitalAllocationCandidateAssessment,
  CapitalAllocationConfidence,
  CapitalAllocationConstraint,
  CapitalAllocationDataGap,
  CapitalAllocationDimension,
  CapitalAllocationFeasibility,
  CapitalAllocationFinding,
  CapitalAllocationPortfolioPosture,
  CapitalAllocationPosition,
  CapitalAllocationPositionSummary,
  CapitalAllocationPriorityClass,
  CapitalAllocationScoreBreakdown,
  CapitalAllocationTradeOff,
  CapitalAllocationOpportunityCost,
  EvaluateCapitalAllocationInput,
  MandatoryCapitalCoverage,
} from "./contracts";
import type { CapitalAllocationPolicy } from "./policy";

type CandidateWork = Readonly<{ candidate: CapitalAllocationCandidate; feasibility: CapitalAllocationFeasibility; priorityClass: CapitalAllocationPriorityClass; dataGaps: readonly CapitalAllocationDataGap[]; scores: CapitalAllocationScoreBreakdown | null; confidence: ConfidenceAssessment; strengths: readonly CapitalAllocationFinding[]; weaknesses: readonly CapitalAllocationFinding[]; tradeOffs: readonly CapitalAllocationTradeOff[]; opportunityCosts: readonly CapitalAllocationOpportunityCost[] }>;

export function evaluateCapitalAllocation(input: EvaluateCapitalAllocationInput): CapitalAllocationAssessment {
  validateInput(input);
  const effectiveInput = Object.freeze({ ...input, capital: applyLiquidityPolicy(input.capital, input.policy) });
  const candidates = normalizeCandidates(input.candidates, input.policy);
  const position = summarizePosition(effectiveInput.capital);
  const mandatoryCoverage = assessMandatoryCoverage(candidates, effectiveInput.capital);
  const mandatoryUnfunded = mandatoryCoverage.unfunded.amount > 0 || mandatoryCoverage.obligations.some((value) => value.amount === null);
  const work = candidates.map((candidate) => evaluateCandidate(candidate, candidates, effectiveInput, position, mandatoryUnfunded));
  const ranked = rankCandidates(work, input.policy, mandatoryUnfunded);
  const posture = determinePosture(ranked, effectiveInput, position, mandatoryCoverage);
  const primary = choosePrimary(ranked, posture, mandatoryUnfunded);
  const alternates = ranked.filter((value) => value.candidate.id.value !== primary?.candidate.id.value && value.feasibility.status === "feasible" && value.candidate.classification !== "mandatory").slice(0, input.policy.ranking.alternateLimit);
  const constraints = constraintsFor(ranked, mandatoryCoverage, position, input.policy);
  const sourceGaps = input.sourceDataGaps ?? [];
  const gaps = sortedGaps([...sourceGaps, ...ranked.flatMap((value) => value.dataGaps)]).slice(0, input.policy.ranking.dataGapLimit);
  const allocationConfidence = assessConfidence(effectiveInput, ranked, gaps);
  let rank = 0;
  const candidateAssessments = ranked.map((value) => {
    const candidateRank = isRankable(value.feasibility) ? ++rank : null;
    return toAssessment(value, primary?.candidate.id.value ?? null, candidateRank);
  });
  return Object.freeze({
    portfolioId: input.portfolio.portfolioId,
    portfolioVersion: input.portfolio.portfolioVersion,
    ...(input.portfolioHealthAssessmentId ? { portfolioHealthAssessmentId: input.portfolioHealthAssessmentId } : {}),
    healthPolicyVersion: input.health.policyVersion,
    allocationPolicyVersion: input.policy.version,
    evaluatedAt: new Date(input.evaluatedAt),
    capitalPosition: position,
    mandatoryCoverage,
    candidates: Object.freeze(candidateAssessments),
    recommendedPosture: posture,
    ...(primary ? { primaryCandidateId: primary.candidate.id } : {}),
    alternateCandidateIds: Object.freeze(alternates.map((value) => value.candidate.id)),
    constraints: Object.freeze(constraints),
    portfolioTradeOffs: Object.freeze(sortedTradeOffs(ranked.flatMap((value) => value.tradeOffs)).slice(0, input.policy.ranking.tradeOffLimit)),
    dataGaps: Object.freeze(gaps),
    confidence: allocationConfidence.assessment,
    allocationConfidence,
    snapshotFingerprint: fingerprintCapitalAllocation(effectiveInput),
  });
}

function applyLiquidityPolicy(position: CapitalAllocationPosition, policy: CapitalAllocationPolicy): CapitalAllocationPosition {
  const policyReserve = policy.liquidity.minimumReserveValue;
  if (!(policyReserve instanceof Money)) throw new RangeError("Allocation reserve policy is not evaluable.");
  return Object.freeze({
    ...position,
    requiredMinimumReserve: Money.usd(Math.max(position.requiredMinimumReserve.amount, policyReserve.amount)),
  });
}

export function summarizePosition(position: CapitalAllocationPosition): CapitalAllocationPositionSummary {
  const deductions = cents(position.requiredMinimumReserve.amount) + cents(position.committedCapital.amount) + cents(position.nearTermObligations.amount);
  const raw = cents(position.availableCapital.amount) - deductions;
  return Object.freeze({
    availableCapital: position.availableCapital,
    deployableCapital: Money.usd(fromCents(Math.max(0, raw))),
    requiredMinimumReserve: position.requiredMinimumReserve,
    committedCapital: position.committedCapital,
    nearTermObligations: position.nearTermObligations,
    capitalShortfall: Money.usd(fromCents(Math.max(0, -raw))),
  });
}

export function assessMandatoryCoverage(candidates: readonly CapitalAllocationCandidate[], position: CapitalAllocationPosition): MandatoryCapitalCoverage {
  const mandatory = candidates.filter((candidate) => candidate.classification === "mandatory");
  const knownCandidateTotal = sumMoney(mandatory.flatMap((candidate) => candidate.requiredCapital.status === "known" ? [candidate.requiredCapital.amount] : []));
  const representedObligations = position.committedCapital.add(position.nearTermObligations);
  const totalRequired = Money.usd(Math.max(knownCandidateTotal.amount, representedObligations.amount));
  const verifiedFunding = Math.max(0, cents(position.availableCapital.amount) - cents(position.requiredMinimumReserve.amount));
  const fundedTotal = Math.min(cents(totalRequired.amount), verifiedFunding);
  let remainingFunding = verifiedFunding;
  const obligations = [...mandatory].sort((a, b) => urgencyRank(a.timing.urgency) - urgencyRank(b.timing.urgency) || a.id.value.localeCompare(b.id.value)).map((candidate) => {
    if (candidate.requiredCapital.status === "unknown") return Object.freeze({ candidateId: candidate.id, amount: null, funded: Money.zero(), unfunded: Money.zero(), urgency: candidate.timing.urgency });
    const amount = candidate.requiredCapital.amount;
    const funded = Math.min(cents(amount.amount), remainingFunding);
    remainingFunding -= funded;
    return Object.freeze({ candidateId: candidate.id, amount, funded: Money.usd(fromCents(funded)), unfunded: Money.usd(fromCents(Math.max(0, cents(amount.amount) - funded))), urgency: candidate.timing.urgency });
  });
  return Object.freeze({
    totalRequired,
    funded: Money.usd(fromCents(fundedTotal)),
    unfunded: Money.usd(fromCents(Math.max(0, cents(totalRequired.amount) - fundedTotal))),
    coverage: totalRequired.amount === 0 ? null : Percentage.create(round(fundedTotal / cents(totalRequired.amount) * 100)),
    obligations: Object.freeze(obligations),
  });
}

export function evaluateFeasibility(candidate: CapitalAllocationCandidate, position: CapitalAllocationPosition, policy: CapitalAllocationPolicy, evaluatedAt: Date, mandatoryUnfunded = false): CapitalAllocationFeasibility {
  if (candidate.requiredCapital.status === "unknown") return Object.freeze({ status: "insufficient-data", dataGaps: Object.freeze([gap("ALLOCATION_REQUIREMENT_UNKNOWN", sourceFor(candidate), "blocking", ["requiredCapital"], candidate)]) });
  if (candidate.timing.expirationDate && candidate.timing.expirationDate < evaluatedAt) return Object.freeze({ status: "infeasible", blockers: Object.freeze([blocker("ALLOCATION_CANDIDATE_EXPIRED", candidate)]) });
  if (candidate.requiredCapital.fundingType === "recurring") return Object.freeze({ status: "insufficient-data", dataGaps: Object.freeze([gap("ALLOCATION_REQUIREMENT_UNKNOWN", sourceFor(candidate), "blocking", ["recurringNormalization"], candidate)]) });
  if (candidate.requiredCapital.fundingType === "staged") {
    if (!candidate.requiredCapital.stages?.length || cents(sumMoney(candidate.requiredCapital.stages.map((stage) => stage.amount)).amount) !== cents(candidate.requiredCapital.amount.amount)) {
      return Object.freeze({ status: "insufficient-data", dataGaps: Object.freeze([gap("ALLOCATION_REQUIREMENT_UNKNOWN", sourceFor(candidate), "blocking", ["stages"], candidate)]) });
    }
  }
  const ageDays = Math.max(0, evaluatedAt.getTime() - candidate.sourceVersion.updatedAt.getTime()) / 86_400_000;
  const positionSummary = summarizePosition(position);
  const amount = candidate.requiredCapital.amount;
  if (candidate.classification !== "mandatory" && mandatoryUnfunded && policy.feasibility.prohibitDiscretionaryWhenMandatoryUnfunded) {
    return Object.freeze({ status: "infeasible", blockers: Object.freeze([blocker("ALLOCATION_COMMITMENT_UNFUNDED", candidate)]) });
  }
  if (candidate.classification !== "mandatory" && amount.amount > positionSummary.deployableCapital.amount) {
    const availableAfterOtherProtections = Math.max(0, position.availableCapital.amount - position.committedCapital.amount - position.nearTermObligations.amount);
    const reserveAfter = availableAfterOtherProtections - amount.amount;
    if (reserveAfter < position.requiredMinimumReserve.amount) return Object.freeze({ status: "infeasible", blockers: Object.freeze([blocker("ALLOCATION_RESERVE_BREACH", candidate), blocker("ALLOCATION_CAPITAL_INSUFFICIENT", candidate)]) });
    return Object.freeze({ status: "infeasible", blockers: Object.freeze([blocker("ALLOCATION_CAPITAL_INSUFFICIENT", candidate)]) });
  }
  const deployableAfter = Math.max(0, positionSummary.deployableCapital.amount - amount.amount);
  const reserveAfter = Math.max(0, position.availableCapital.amount - position.committedCapital.amount - position.nearTermObligations.amount - amount.amount);
  const coverage = position.requiredMinimumReserve.amount === 0 ? null : Percentage.create(clamp(reserveAfter / position.requiredMinimumReserve.amount * 100));
  const conditions = [];
  if (candidate.requiredCapital.estimated) conditions.push(Object.freeze({ code: "VERIFY_ESTIMATED_REQUIREMENT", evidence: candidate.evidence }));
  if (ageDays > policy.feasibility.staleAfterDays) {
    return Object.freeze({ status: "conditionally-feasible", capitalRequired: amount, conditions: Object.freeze([...conditions, Object.freeze({ code: "REFRESH_SOURCE", evidence: candidate.evidence })]), blockers: Object.freeze([blocker("ALLOCATION_SOURCE_STALE", candidate)]) });
  }
  if (coverage && coverage.value < policy.feasibility.conditionalReserveCoverage.value && policy.liquidity.allowReserveBreach) {
    return Object.freeze({ status: "conditionally-feasible", capitalRequired: amount, conditions: Object.freeze([...conditions, Object.freeze({ code: "APPROVE_RESERVE_BREACH", evidence: candidate.evidence })]), blockers: Object.freeze([blocker("ALLOCATION_RESERVE_BREACH", candidate)]) });
  }
  return Object.freeze({ status: "feasible", capitalRequired: amount, deployableCapitalBefore: positionSummary.deployableCapital, deployableCapitalAfter: Money.usd(roundMoney(deployableAfter)), reserveCoverageAfter: coverage, conditions: Object.freeze(conditions) });
}

function evaluateCandidate(candidate: CapitalAllocationCandidate, allCandidates: readonly CapitalAllocationCandidate[], input: EvaluateCapitalAllocationInput, position: CapitalAllocationPositionSummary, mandatoryUnfunded: boolean): CandidateWork {
  const feasibility = evaluateFeasibility(candidate, input.capital, input.policy, input.evaluatedAt, mandatoryUnfunded);
  const gaps = feasibility.status === "insufficient-data" ? feasibility.dataGaps : impactGaps(candidate);
  const priorityClass = priorityFor(candidate);
  const scoreable = feasibility.status === "feasible" || feasibility.status === "conditionally-feasible";
  const scores = scoreable && candidate.classification !== "mandatory" ? scoreCandidate(candidate, input, position, gaps) : null;
  const confidence = candidateConfidence(candidate, input, gaps);
  const strengths = findings(candidate, true).slice(0, input.policy.ranking.findingLimit);
  const weaknesses = findings(candidate, false).slice(0, input.policy.ranking.findingLimit);
  return Object.freeze({ candidate, feasibility, priorityClass, dataGaps: Object.freeze(gaps), scores, confidence, strengths: Object.freeze(strengths), weaknesses: Object.freeze(weaknesses), tradeOffs: Object.freeze(tradeOffs(candidate, feasibility).slice(0, input.policy.ranking.tradeOffLimit)), opportunityCosts: Object.freeze(opportunityCosts(candidate, allCandidates).slice(0, input.policy.ranking.tradeOffLimit)) });
}

function scoreCandidate(candidate: CapitalAllocationCandidate, input: EvaluateCapitalAllocationInput, position: CapitalAllocationPositionSummary, gaps: readonly CapitalAllocationDataGap[]): CapitalAllocationScoreBreakdown {
  const values: Record<CapitalAllocationDimension, number> = {
    "portfolio-health-impact": directionScore(candidate.expectedImpact.health.expectedDirection),
    "financial-efficiency": financialScore(candidate),
    "strategic-alignment": ({ aligned: 95, "partially-aligned": 70, misaligned: 20, unevaluable: 40 } as const)[candidate.expectedImpact.strategy.status],
    "risk-adjustment": ({ reduces: 95, neutral: 70, increases: 20, mixed: 45, unknown: 40 } as const)[candidate.expectedImpact.risk.direction],
    "diversification-impact": ({ improves: 95, neutral: 70, worsens: 20, unknown: 40 } as const)[candidate.expectedImpact.diversification.direction],
    "liquidity-impact": candidate.requiredCapital.status === "known" && position.deployableCapital.amount > 0 ? clamp((1 - candidate.requiredCapital.amount.amount / position.deployableCapital.amount) * 100) : candidate.purpose === "defer-deployment" ? 100 : 0,
    timing: ({ immediate: 100, "near-term": 85, planned: 65, optional: 50 } as const)[candidate.timing.urgency],
  };
  if (candidate.expectedImpact.health.addressesLimitingDimension) values["portfolio-health-impact"] = Math.max(values["portfolio-health-impact"], 90);
  if (candidate.expectedImpact.health.addressesCriticalFinding) values["portfolio-health-impact"] = 100;
  const components = (Object.keys(input.policy.discretionaryWeights) as CapitalAllocationDimension[]).map((dimension) => {
    const score = Score.create(values[dimension]);
    const weight = input.policy.discretionaryWeights[dimension];
    return Object.freeze({ dimension, score, weight, contribution: round(weight.applyTo(score.value), 4), evidence: candidate.evidence, confidence: candidate.confidence, dataGaps: Object.freeze(gaps.filter((value) => dimensionForGap(value) === dimension)) });
  });
  const platformBreakdown = ScoreBreakdown.create({
    key: candidate.id.value,
    label: "Capital allocation candidate",
    components: components.map((component) => ScoreComponent.create({ key: component.dimension, label: component.dimension, score: component.score, weight: component.weight })),
  });
  let total = platformBreakdown.score.value;
  if (candidate.expectedImpact.health.expectedDirection === "weaken" && candidate.expectedImpact.health.addressesCriticalFinding) total = 0;
  return Object.freeze({ total: Score.create(round(total)), components: Object.freeze(components), policyVersion: input.policy.version });
}

function rankCandidates(work: readonly CandidateWork[], policy: CapitalAllocationPolicy, mandatoryUnfunded: boolean): readonly CandidateWork[] {
  const order = new Map(policy.priorityOrder.map((value, index) => [value, index]));
  return Object.freeze([...work].sort((a, b) => {
    const feasibility = feasibilityRank(a.feasibility.status) - feasibilityRank(b.feasibility.status);
    if (feasibility !== 0) return feasibility;
    const group = (order.get(a.priorityClass) ?? 99) - (order.get(b.priorityClass) ?? 99);
    if (group !== 0) return group;
    if (mandatoryUnfunded && a.candidate.classification !== b.candidate.classification) return a.candidate.classification === "mandatory" ? -1 : 1;
    const score = (b.scores?.total.value ?? 0) - (a.scores?.total.value ?? 0);
    if (score !== 0) return score;
    const confidence = b.confidence.score.value - a.confidence.score.value;
    if (confidence !== 0) return confidence;
    const urgency = urgencyRank(a.candidate.timing.urgency) - urgencyRank(b.candidate.timing.urgency);
    if (urgency !== 0) return urgency;
    const capital = knownAmount(a.candidate) - knownAmount(b.candidate);
    return capital || a.candidate.id.value.localeCompare(b.candidate.id.value);
  }));
}

function choosePrimary(work: readonly CandidateWork[], posture: CapitalAllocationPortfolioPosture, mandatoryUnfunded: boolean): CandidateWork | undefined {
  const eligible = work.filter((value) => value.feasibility.status === "feasible");
  if (eligible.length === 0) return undefined;
  if (mandatoryUnfunded || posture === "fund-mandatory-obligations") return eligible.find((value) => value.candidate.classification === "mandatory");
  if (posture === "preserve-liquidity" || posture === "defer-deployment") return eligible.find((value) => value.candidate.purpose === "defer-deployment");
  if (posture === "remediate-portfolio-risk") return eligible.find((value) => value.candidate.purpose === "risk-remediation") ?? eligible[0];
  return eligible.find((value) => value.candidate.classification !== "hold" && value.candidate.classification !== "mandatory") ?? eligible.find((value) => value.candidate.purpose === "defer-deployment");
}

function determinePosture(work: readonly CandidateWork[], input: EvaluateCapitalAllocationInput, position: CapitalAllocationPositionSummary, coverage: MandatoryCapitalCoverage): CapitalAllocationPortfolioPosture {
  if (coverage.obligations.some((value) => value.amount === null)) return "insufficient-data";
  if (coverage.unfunded.amount > 0) return "fund-mandatory-obligations";
  if (coverage.obligations.length > 0) return "fund-mandatory-obligations";
  if (position.capitalShortfall.amount > 0 || input.health.overall.limitingDimensions.includes("capital")) return "preserve-liquidity";
  const feasible = work.filter((value) => value.feasibility.status === "feasible");
  if (feasible.length === 0) return "defer-deployment";
  if (input.health.risks.some((finding) => finding.code === "PORTFOLIO_RISK_CRITICAL") && feasible.some((value) => value.candidate.purpose === "risk-remediation")) return "remediate-portfolio-risk";
  const nonHold = feasible.filter((value) => value.candidate.classification !== "hold" && value.candidate.classification !== "mandatory");
  if (nonHold.length === 0) return "defer-deployment";
  if (nonHold.length > 1) return "allocate-selectively";
  return nonHold[0].candidate.purpose === "property-improvement" ? "improve-existing-assets" : "pursue-growth";
}

function toAssessment(value: CandidateWork, primaryId: string | null, rank: number | null): CapitalAllocationCandidateAssessment {
  const posture = value.candidate.id.value === primaryId
    ? value.candidate.classification === "mandatory" ? "required" : "fund"
    : value.feasibility.status === "insufficient-data" ? "insufficient-data"
    : value.feasibility.status === "infeasible" ? "reject"
    : value.feasibility.status === "conditionally-feasible" ? "fund-conditionally"
    : "defer";
  return Object.freeze({
    candidate: Object.freeze({
      id: value.candidate.id,
      purpose: value.candidate.purpose,
      classification: value.candidate.classification,
      subject: value.candidate.subject,
      requiredCapital: value.candidate.requiredCapital,
      timing: value.candidate.timing,
      expectedImpact: value.candidate.expectedImpact,
    }),
    feasibility: value.feasibility, priorityClass: value.priorityClass, scores: value.scores,
    confidence: value.confidence, strengths: value.strengths, weaknesses: value.weaknesses,
    tradeOffs: value.tradeOffs, opportunityCosts: value.opportunityCosts, dataGaps: value.dataGaps, rank, posture,
  });
}

function assessConfidence(input: EvaluateCapitalAllocationInput, work: readonly CandidateWork[], gaps: readonly CapitalAllocationDataGap[]): CapitalAllocationConfidence {
  const candidateCoverage = work.length === 0 ? 0 : work.filter((value) => value.feasibility.status !== "insufficient-data").length / work.length * 100;
  const freshness = work.length === 0 ? 100 : work.reduce((sum, value) => sum + freshnessScore(value.candidate.sourceVersion.updatedAt, input.evaluatedAt, input.policy), 0) / work.length;
  const verifiedCapital = input.capital.unverifiedCapital?.amount ? 60 : 95;
  const candidateConfidence = work.length === 0 ? 50 : work.reduce((sum, value) => sum + value.confidence.score.value, 0) / work.length;
  const penalties = gaps.map((value) => Object.freeze({ code: value.code, points: value.confidencePenalty.value, ...(value.candidateId ? { candidateId: value.candidateId } : {}) }));
  const raw = input.policy.confidence.healthWeight.applyTo(input.health.confidence.score.value) + input.policy.confidence.capitalWeight.applyTo(verifiedCapital) + input.policy.confidence.candidateWeight.applyTo(candidateConfidence) + input.policy.confidence.freshnessWeight.applyTo(freshness);
  const score = clamp(raw - Math.min(40, penalties.reduce((sum, value) => sum + value.points, 0)));
  return Object.freeze({
    assessment: confidence(score, penalties.length ? penalties.map((value) => value.code) : ["Health, verified capital, candidate coverage, and freshness assessed."]),
    portfolioHealth: input.health.confidence,
    capital: confidence(verifiedCapital, [input.capital.unverifiedCapital?.amount ? "Some capital is unverified." : "Capital position is verified."]),
    candidateCoverage: Percentage.create(round(candidateCoverage)),
    sourceFreshness: Percentage.create(round(freshness)),
    penalties: Object.freeze(penalties),
  });
}

export function fingerprintCapitalAllocation(input: EvaluateCapitalAllocationInput): string {
  const canonical = {
    portfolio: [input.portfolio.portfolioId.value, input.portfolio.portfolioVersion],
    health: [input.health.snapshotFingerprint, input.health.policyVersion, input.health.overall.score.value],
    capital: {
      available: input.capital.availableCapital.amount, reserved: input.capital.reservedCapital.amount,
      committed: input.capital.committedCapital.amount, allocated: input.capital.allocatedCapital.amount,
      minimumReserve: input.capital.requiredMinimumReserve.amount, obligations: input.capital.nearTermObligations.amount,
      unverified: input.capital.unverifiedCapital?.amount, capturedAt: input.capital.capturedAt.toISOString(),
    },
    candidates: [...input.candidates].sort((a, b) => a.id.value.localeCompare(b.id.value)).map((candidate) => ({
      id: candidate.id.value, purpose: candidate.purpose, classification: candidate.classification,
      requirement: candidate.requiredCapital.status === "known" ? { amount: candidate.requiredCapital.amount.amount, type: candidate.requiredCapital.fundingType, committed: candidate.requiredCapital.committed, estimated: candidate.requiredCapital.estimated, stages: candidate.requiredCapital.stages?.map((stage) => [stage.id, stage.amount.amount, stage.dueAt?.toISOString()]) } : { unknown: candidate.requiredCapital.reasonCode },
      timing: { ...candidate.timing, earliestDate: candidate.timing.earliestDate?.toISOString(), requiredBy: candidate.timing.requiredBy?.toISOString(), expirationDate: candidate.timing.expirationDate?.toISOString() },
      impact: {
        financial: candidate.expectedImpact.financial ? { required: candidate.expectedImpact.financial.requiredCapital.amount, cashFlow: candidate.expectedImpact.financial.projectedAnnualCashFlow?.amount, noi: candidate.expectedImpact.financial.projectedAnnualNoi?.amount, return: candidate.expectedImpact.financial.projectedReturn?.value, basis: candidate.expectedImpact.financial.valueBasis } : null,
        health: candidate.expectedImpact.health, strategy: candidate.expectedImpact.strategy.status,
        diversification: candidate.expectedImpact.diversification.direction, risk: candidate.expectedImpact.risk.direction,
      },
      confidence: candidate.confidence.score.value, source: [candidate.sourceVersion.source, candidate.sourceVersion.version, candidate.sourceVersion.updatedAt.toISOString()],
    })),
    policy: input.policy.version,
    evaluatedAt: input.evaluatedAt.toISOString(),
  };
  const text = JSON.stringify(canonical);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `cas-fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeCandidates(candidates: readonly CapitalAllocationCandidate[], policy: CapitalAllocationPolicy) {
  if (candidates.length > policy.ranking.candidateLimit) throw new RangeError("Capital allocation candidate input exceeds policy limit.");
  const values = new Map<string, CapitalAllocationCandidate>();
  for (const candidate of [...candidates].sort((a, b) => a.sourceVersion.updatedAt.getTime() - b.sourceVersion.updatedAt.getTime() || a.id.value.localeCompare(b.id.value))) {
    const current = values.get(candidate.id.value);
    if (current && current.requiredCapital.status === "known" && candidate.requiredCapital.status === "known" && current.requiredCapital.committed && candidate.requiredCapital.committed) throw new RangeError("ALLOCATION_DUPLICATE_COMMITMENT");
    values.set(candidate.id.value, candidate);
  }
  return [...values.values()].sort((a, b) => a.id.value.localeCompare(b.id.value));
}
function validateInput(input: EvaluateCapitalAllocationInput) {
  if (!input.health.portfolioId.equals(input.portfolio.portfolioId)) throw new RangeError("Portfolio health assessment is incompatible.");
  if (input.capital.reportingCurrency !== input.portfolio.reportingCurrency) throw new RangeError("ALLOCATION_CURRENCY_INCOMPATIBLE");
  const money = [input.capital.availableCapital, input.capital.reservedCapital, input.capital.committedCapital, input.capital.allocatedCapital, input.capital.requiredMinimumReserve, input.capital.nearTermObligations, ...(input.capital.unverifiedCapital ? [input.capital.unverifiedCapital] : [])];
  if (money.some((value) => value.currency !== input.portfolio.reportingCurrency || value.isNegative())) throw new RangeError("Capital position is invalid.");
  if (Number.isNaN(input.evaluatedAt.getTime())) throw new TypeError("Evaluation time is invalid.");
  for (const candidate of input.candidates) {
    if (!candidate.portfolioId.equals(input.portfolio.portfolioId)) throw new RangeError("Candidate belongs to another portfolio.");
    if (candidate.requiredCapital.status === "known") {
      const requirement = candidate.requiredCapital;
      if (requirement.amount.isNegative() || (requirement.minimumAmount && requirement.minimumAmount.amount > requirement.amount.amount) || (requirement.maximumAmount && requirement.amount.amount > requirement.maximumAmount.amount)) throw new RangeError("Capital requirement bounds are invalid.");
    }
  }
}
function impactGaps(candidate: CapitalAllocationCandidate): CapitalAllocationDataGap[] {
  const gaps = [];
  if (!candidate.expectedImpact.financial && candidate.classification !== "mandatory" && candidate.classification !== "hold") gaps.push(gap("ALLOCATION_FINANCIAL_IMPACT_UNKNOWN", sourceFor(candidate), "material", ["financialImpact"], candidate));
  if (candidate.expectedImpact.strategy.status === "unevaluable") gaps.push(gap("ALLOCATION_STRATEGY_UNAVAILABLE", "strategy", "material", ["strategy"], candidate));
  if (candidate.expectedImpact.diversification.direction === "unknown" && candidate.classification === "growth") gaps.push(gap("ALLOCATION_EXPOSURE_IMPACT_UNKNOWN", sourceFor(candidate), "minor", ["diversificationImpact"], candidate));
  return gaps;
}
function findings(candidate: CapitalAllocationCandidate, positive: boolean): CapitalAllocationFinding[] {
  const values = [];
  if (positive && candidate.expectedImpact.health.addressesCriticalFinding) values.push(Object.freeze({ code: "ALLOCATION_ADDRESSES_CRITICAL_HEALTH", severity: "positive" as const, evidence: candidate.evidence }));
  if (positive && candidate.expectedImpact.strategy.status === "aligned") values.push(Object.freeze({ code: "ALLOCATION_STRATEGY_ALIGNED", severity: "positive" as const, evidence: candidate.evidence }));
  if (!positive && candidate.expectedImpact.risk.direction === "increases") values.push(Object.freeze({ code: "ALLOCATION_INCREASES_RISK", severity: "high" as const, evidence: candidate.evidence }));
  if (!positive && candidate.expectedImpact.diversification.direction === "worsens") values.push(Object.freeze({ code: "ALLOCATION_INCREASES_CONCENTRATION", severity: "warning" as const, evidence: candidate.evidence }));
  return values;
}
function tradeOffs(candidate: CapitalAllocationCandidate, feasibility: CapitalAllocationFeasibility): CapitalAllocationTradeOff[] {
  const values = [];
  if (candidate.classification === "growth" && candidate.requiredCapital.status === "known") values.push(Object.freeze({ code: "ALLOCATION_GROWTH_VS_LIQUIDITY", type: "liquidity" as const, positiveEffect: Object.freeze({ code: "GROWTH_OPTION", direction: "positive" as const, magnitude: "material" as const }), negativeEffect: Object.freeze({ code: "LIQUIDITY_REDUCED", direction: "negative" as const, magnitude: "material" as const }), evidence: candidate.evidence }));
  if (candidate.expectedImpact.diversification.direction === "improves" && candidate.expectedImpact.financial?.projectedReturn === undefined) values.push(Object.freeze({ code: "ALLOCATION_DIVERSIFICATION_VS_UNQUANTIFIED_RETURN", type: "diversification" as const, positiveEffect: Object.freeze({ code: "DIVERSIFICATION_IMPROVES", direction: "positive" as const, magnitude: "material" as const }), negativeEffect: Object.freeze({ code: "RETURN_UNQUANTIFIED", direction: "negative" as const, magnitude: "unknown" as const }), evidence: candidate.evidence }));
  if (candidate.purpose === "defer-deployment") values.push(Object.freeze({ code: "ALLOCATION_LIQUIDITY_VS_DELAY", type: "timing" as const, positiveEffect: Object.freeze({ code: "LIQUIDITY_PRESERVED", direction: "positive" as const, magnitude: "material" as const }), negativeEffect: Object.freeze({ code: "STRATEGY_DELAY", direction: "negative" as const, magnitude: candidate.timing.delayImpact === "unknown" ? "unknown" as const : "minor" as const }), evidence: candidate.evidence }));
  if (feasibility.status === "infeasible") return values;
  return values;
}
function opportunityCosts(candidate: CapitalAllocationCandidate, allCandidates: readonly CapitalAllocationCandidate[]): CapitalAllocationOpportunityCost[] {
  if (candidate.purpose !== "defer-deployment") return [];
  return allCandidates
    .filter((value) => value.purpose !== "defer-deployment")
    .sort((a, b) => urgencyRank(a.timing.urgency) - urgencyRank(b.timing.urgency) || a.id.value.localeCompare(b.id.value))
    .map((value) => Object.freeze({
      candidateId: value.id,
      type: value.purpose === "risk-remediation" ? "unresolved-risk" as const : value.timing.expirationDate ? "expired-opportunity" as const : value.classification === "growth" ? "delayed-growth" as const : "strategy-delay" as const,
      severity: value.timing.delayImpact === "critical" ? "critical" as const : value.timing.delayImpact === "material" ? "material" as const : "minor" as const,
      evidence: value.evidence,
    }));
}
function candidateConfidence(candidate: CapitalAllocationCandidate, input: EvaluateCapitalAllocationInput, gaps: readonly CapitalAllocationDataGap[]) {
  const health = input.health.confidence.score.value;
  const base = candidate.confidence.score.value * 0.6 + health * 0.4;
  const penalty = gaps.reduce((sum, value) => sum + value.confidencePenalty.value, 0);
  return confidence(clamp(base - Math.min(50, penalty)), gaps.length ? gaps.map((value) => value.code) : ["Candidate source and Portfolio Health confidence combined."]);
}
function constraintsFor(work: readonly CandidateWork[], coverage: MandatoryCapitalCoverage, position: CapitalAllocationPositionSummary, policy: CapitalAllocationPolicy): CapitalAllocationConstraint[] {
  const values: CapitalAllocationConstraint[] = [];
  if (coverage.unfunded.amount > 0) values.push(Object.freeze({ code: "ALLOCATION_COMMITMENT_UNFUNDED", severity: "critical" }));
  if (coverage.obligations.some((value) => value.amount === null)) values.push(Object.freeze({ code: "ALLOCATION_MANDATORY_AMOUNT_UNKNOWN", severity: "critical" }));
  if (position.capitalShortfall.amount > 0) values.push(Object.freeze({ code: "ALLOCATION_CAPITAL_SHORTFALL", severity: "critical" }));
  for (const item of work) if (item.feasibility.status === "infeasible") for (const itemBlocker of item.feasibility.blockers) values.push(Object.freeze({ code: itemBlocker.code, severity: itemBlocker.code === "ALLOCATION_COMMITMENT_UNFUNDED" ? "critical" : "warning", candidateId: item.candidate.id }));
  return values.sort((a, b) => a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code) || (a.candidateId?.value ?? "").localeCompare(b.candidateId?.value ?? "")).slice(0, policy.ranking.findingLimit);
}
function priorityFor(candidate: CapitalAllocationCandidate): CapitalAllocationPriorityClass {
  if (candidate.classification === "mandatory") return "required";
  if (candidate.purpose === "risk-remediation" || candidate.purpose === "liquidity-reserve") return "protect";
  if (candidate.purpose === "property-improvement" || candidate.purpose === "property-expansion") return "improve";
  if (candidate.purpose === "new-acquisition") return "grow";
  if (candidate.purpose === "strategic-reserve") return "reserve";
  return "defer";
}
function financialScore(candidate: CapitalAllocationCandidate) {
  const financial = candidate.expectedImpact.financial;
  if (!financial) return candidate.classification === "hold" ? 60 : candidate.classification === "mandatory" ? 70 : 40;
  if (financial.projectedReturn) return clamp(financial.projectedReturn.value * 4);
  if (financial.projectedAnnualCashFlow && financial.requiredCapital.amount > 0) return clamp(financial.projectedAnnualCashFlow.amount / financial.requiredCapital.amount * 400);
  return financial.valueBasis === "risk-avoidance" || financial.valueBasis === "committed-obligation" ? 70 : 40;
}
function directionScore(value: CapitalAllocationCandidate["expectedImpact"]["health"]["expectedDirection"]) { return ({ improve: 95, maintain: 70, weaken: 15, mixed: 45, unknown: 40 } as const)[value]; }
function dimensionForGap(gapValue: CapitalAllocationDataGap): CapitalAllocationDimension { return gapValue.code === "ALLOCATION_FINANCIAL_IMPACT_UNKNOWN" ? "financial-efficiency" : gapValue.code === "ALLOCATION_STRATEGY_UNAVAILABLE" ? "strategic-alignment" : "diversification-impact"; }
function sourceFor(candidate: CapitalAllocationCandidate): CapitalAllocationDataGap["source"] { return candidate.subject.type === "property" ? "property" : candidate.subject.type === "opportunity" ? "opportunity" : candidate.subject.type === "acquisition" ? "acquisition" : "capital"; }
function gap(code: CapitalAllocationDataGap["code"], source: CapitalAllocationDataGap["source"], impact: CapitalAllocationDataGap["impact"], fields: readonly string[], candidate: CapitalAllocationCandidate): CapitalAllocationDataGap { return Object.freeze({ code, candidateId: candidate.id, source, impact, missingFields: Object.freeze([...fields]), confidencePenalty: Percentage.create(impact === "blocking" ? 40 : impact === "material" ? 20 : 10) }); }
function blocker(code: CapitalAllocationBlocker["code"], candidate: CapitalAllocationCandidate): CapitalAllocationBlocker { return Object.freeze({ code, evidence: candidate.evidence }); }
function isRankable(value: CapitalAllocationFeasibility) { return value.status === "feasible" || value.status === "conditionally-feasible"; }
function feasibilityRank(value: CapitalAllocationFeasibility["status"]) { return ({ feasible: 0, "conditionally-feasible": 1, "insufficient-data": 2, infeasible: 3 } as const)[value]; }
function urgencyRank(value: CapitalAllocationCandidate["timing"]["urgency"]) { return ({ immediate: 0, "near-term": 1, planned: 2, optional: 3 } as const)[value]; }
function knownAmount(candidate: CapitalAllocationCandidate) { return candidate.requiredCapital.status === "known" ? candidate.requiredCapital.amount.amount : Number.POSITIVE_INFINITY; }
function freshnessScore(date: Date, evaluatedAt: Date, policy: CapitalAllocationPolicy) { return Math.max(0, evaluatedAt.getTime() - date.getTime()) / 86_400_000 <= policy.feasibility.staleAfterDays ? 100 : 25; }
function sortedGaps(values: readonly CapitalAllocationDataGap[]) { const order = { blocking: 0, material: 1, minor: 2 }; return [...values].sort((a, b) => order[a.impact] - order[b.impact] || a.code.localeCompare(b.code) || (a.candidateId?.value ?? "").localeCompare(b.candidateId?.value ?? "")); }
function sortedTradeOffs(values: readonly CapitalAllocationTradeOff[]) { return [...values].sort((a, b) => a.code.localeCompare(b.code)); }
function confidence(value: number, rationale: readonly string[]) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(round(value)), rationale }); }
function sumMoney(values: readonly Money[]) { return Money.usd(fromCents(values.reduce((sum, value) => sum + cents(value.amount), 0))); }
function cents(value: number) { return Math.round((value + Number.EPSILON) * 100); }
function fromCents(value: number) { return value / 100; }
function roundMoney(value: number) { return fromCents(cents(value)); }
function round(value: number, places = 2) { const factor = 10 ** places; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }

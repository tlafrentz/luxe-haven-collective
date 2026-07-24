import { Identifier } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";
import type { CapitalAllocationCandidateAssessment } from "../allocation";
import type { PortfolioHealthFinding } from "../health";
import type {
  EvaluatePortfolioRecommendationsInput,
  PortfolioRecommendation,
  PortfolioRecommendationAssessment,
  PortfolioRecommendationBenefit,
  PortfolioRecommendationCategory,
  PortfolioRecommendationConstraint,
  PortfolioRecommendationEvidenceReference,
  PortfolioRecommendationId,
  PortfolioRecommendationImpact,
  PortfolioRecommendationObjectReference,
  PortfolioRecommendationPriority,
  PortfolioRecommendationTradeOff,
  PortfolioRecommendationType,
} from "./contracts";
import { validatePortfolioRecommendationPolicy, type PortfolioRecommendationRuleCode } from "./policy";

type Draft = Readonly<{
  key: string;
  rule: PortfolioRecommendationRuleCode;
  category: PortfolioRecommendationCategory;
  type: PortfolioRecommendationType;
  priority: PortfolioRecommendationPriority;
  confidenceValues: readonly number[];
  evidence: readonly PortfolioRecommendationEvidenceReference[];
  benefits: readonly PortfolioRecommendationBenefit[];
  tradeOffs: readonly PortfolioRecommendationTradeOff[];
  constraints: readonly PortfolioRecommendationConstraint[];
  actionSubject: PortfolioRecommendationObjectReference;
  affectedObjects: readonly PortfolioRecommendationObjectReference[];
  impact: PortfolioRecommendationImpact;
  findingCodes: readonly string[];
  rationaleCode: string;
  ignoredImpactCode: string;
  urgency: number;
}>;

export function evaluatePortfolioRecommendations(input: EvaluatePortfolioRecommendationsInput): PortfolioRecommendationAssessment {
  validate(input);
  const raw = buildDrafts(input);
  const { drafts, suppressed } = suppress(raw);
  const scored = drafts.map((draft) => ({ draft, score: rankingScore(draft, input) }))
    .sort((a, b) => b.score - a.score || priorityRank(a.draft.priority) - priorityRank(b.draft.priority) || b.draft.urgency - a.draft.urgency || a.draft.key.localeCompare(b.draft.key))
    .slice(0, input.policy.maximumRecommendations);
  const base = scored.map(({ draft }, index) => recommendation(draft, input, index + 1));
  const conflicts = findConflicts(base, input.policy.maximumConflicts);
  const conflictMap = new Map<string, PortfolioRecommendationId[]>();
  for (const conflict of conflicts) {
    for (const id of conflict.recommendationIds) conflictMap.set(id.value, [...(conflictMap.get(id.value) ?? []), conflict.recommendationIds.find((other) => !other.equals(id))!]);
  }
  const recommendations = Object.freeze(base.map((item) => Object.freeze({
    ...item,
    conflictIds: Object.freeze((conflictMap.get(item.id.value) ?? []).sort((a, b) => a.value.localeCompare(b.value))),
  })));
  const sourceLimitations = Object.freeze([...new Set(input.sourceLimitations ?? [])].sort());
  return Object.freeze({
    portfolioId: input.portfolioId,
    portfolioVersion: input.portfolioVersion,
    healthPolicyVersion: input.health.policyVersion,
    allocationPolicyVersion: input.allocation.allocationPolicyVersion,
    recommendationPolicyVersion: input.policy.version,
    observationWindow: cloneWindow(input.observationWindow),
    evaluatedAt: new Date(input.evaluatedAt),
    posture: posture(recommendations),
    recommendations,
    suppressed: Object.freeze(suppressed),
    conflicts: Object.freeze(conflicts),
    confidence: assessmentConfidence(recommendations, input, sourceLimitations),
    sourceLimitations,
    snapshotFingerprint: fingerprintPortfolioRecommendations(input),
  });
}

function buildDrafts(input: EvaluatePortfolioRecommendationsInput): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const finding of [...input.health.risks, ...input.health.warnings]) {
    const draft = healthDraft(finding, input);
    if (draft) drafts.push(draft);
  }
  if (input.health.capitalAssessment.unfundedCommitment.amount > 0 || input.allocation.mandatoryCoverage.unfunded.amount > 0) {
    drafts.push(draft(input, "RECOMMEND_RESOLVE_CAPITAL_SHORTFALL", "increase-liquidity", "resolve-capital-shortfall", "capital", input.portfolioId.value, {
      evidence: [{ kind: "capital-allocation-constraint", referenceId: "mandatory-capital-unfunded", sourceVersion: input.allocation.allocationPolicyVersion }],
      benefits: ["improves-liquidity", "reduces-risk"],
      tradeOffs: ["delays-growth"],
      constraints: ["mandatory-obligations-unfunded"],
      impact: impact("improve", "improve", "reduce", "delay"),
      confidence: [input.health.confidence.score.value, input.allocation.confidence.score.value],
      urgency: 100,
    }));
  }
  if (!input.strategy.available) {
    drafts.push(draft(input, "RECOMMEND_COLLECT_MISSING_DATA", "investigate", "collect-missing-data", "portfolio", input.portfolioId.value, {
      evidence: [{ kind: "portfolio-strategy", referenceId: "strategy-source-unavailable" }],
      benefits: ["improves-data-quality"],
      tradeOffs: ["requires-more-evidence"],
      constraints: ["missing-data"],
      impact: impact("maintain", "preserve", "maintain", "unknown"),
      confidence: [input.health.confidence.score.value],
      urgency: 65,
    }));
  } else if (!input.strategy.defined) {
    drafts.push(draft(input, "RECOMMEND_REEVALUATE_STRATEGY", "investigate", "reevaluate-strategy", "portfolio", input.portfolioId.value, {
      evidence: [{ kind: "portfolio-health-gap", referenceId: "PORTFOLIO_STRATEGY_MISSING", sourceVersion: input.health.policyVersion }],
      benefits: ["supports-strategy", "improves-data-quality"],
      tradeOffs: ["requires-more-evidence"],
      constraints: ["missing-strategy"],
      impact: impact("maintain", "preserve", "maintain", "support"),
      confidence: [input.health.confidence.score.value],
      urgency: 45,
    }));
  }
  for (const gap of input.health.dataGaps) {
    drafts.push(draft(input, "RECOMMEND_COLLECT_MISSING_DATA", "investigate", "collect-missing-data", gap.subjectType === "property" ? "property" : "portfolio", gap.subjectId ?? input.portfolioId.value, {
      evidence: [{ kind: "portfolio-health-gap", referenceId: `${gap.code}:${gap.subjectId ?? "portfolio"}`, sourceVersion: input.health.policyVersion }],
      benefits: ["improves-data-quality"],
      tradeOffs: ["requires-more-evidence"],
      constraints: ["missing-data"],
      impact: impact("maintain", "preserve", "maintain", "unknown"),
      confidence: [input.health.confidence.score.value],
      findingCodes: [gap.code],
      urgency: gap.impact === "blocking" ? 90 : gap.impact === "material" ? 65 : 30,
    }));
  }
  const primary = input.allocation.primaryCandidateId
    ? input.allocation.candidates.find((candidate) => candidate.candidate.id.equals(input.allocation.primaryCandidateId!))
    : undefined;
  if (primary) {
    const candidateDraft = allocationDraft(primary, input);
    if (candidateDraft) drafts.push(candidateDraft);
  }
  if (["preserve-liquidity", "defer-deployment"].includes(input.allocation.recommendedPosture)) {
    drafts.push(draft(input, "RECOMMEND_PRESERVE_CAPITAL", "preserve", "wait", "capital", input.portfolioId.value, {
      evidence: [{ kind: "capital-allocation-finding", referenceId: `posture:${input.allocation.recommendedPosture}`, sourceVersion: input.allocation.allocationPolicyVersion }],
      benefits: ["preserves-capital", "improves-liquidity"],
      tradeOffs: ["delays-growth", "foregoes-opportunity"],
      constraints: input.allocation.dataGaps.some((gap) => gap.impact === "blocking") ? ["missing-data"] : [],
      impact: impact("maintain", "preserve", "maintain", "delay"),
      confidence: [input.allocation.confidence.score.value, input.health.confidence.score.value],
      urgency: 75,
    }));
  }
  for (const observation of [...input.observations].sort((a, b) => a.observationId.localeCompare(b.observationId))) {
    const observationDraft = fromObservation(observation, input);
    if (observationDraft) drafts.push(observationDraft);
  }
  if (drafts.length === 0) {
    drafts.push(draft(input, "RECOMMEND_MONITOR", "monitor", "monitor-portfolio-condition", "portfolio", input.portfolioId.value, {
      evidence: [{ kind: "portfolio-health-finding", referenceId: input.health.overall.summaryCode, sourceVersion: input.health.policyVersion }],
      benefits: ["improves-health"],
      tradeOffs: [],
      constraints: [],
      impact: impact("maintain", "preserve", "maintain", "support"),
      confidence: [input.health.confidence.score.value, input.allocation.confidence.score.value],
      urgency: 10,
    }));
  }
  return drafts;
}

function healthDraft(finding: PortfolioHealthFinding, input: EvaluatePortfolioRecommendationsInput): Draft | null {
  const common = {
    evidence: [{ kind: "portfolio-health-finding" as const, referenceId: `${finding.code}:${finding.subjectId ?? "portfolio"}`, sourceVersion: input.health.policyVersion }],
    confidence: [input.health.confidence.score.value],
    findingCodes: [finding.code],
    urgency: finding.severity === "critical" ? 100 : finding.severity === "high" ? 80 : 60,
  };
  if (finding.code === "PORTFOLIO_RISK_CRITICAL") return draft(input, "RECOMMEND_RESOLVE_CRITICAL_RISK", "reduce-risk", "resolve-portfolio-risk", finding.subject === "property" ? "property" : "portfolio", finding.subjectId ?? input.portfolioId.value, { ...common, benefits: ["reduces-risk", "improves-health"], tradeOffs: ["requires-capital"], constraints: [], impact: impact("improve", "consume", "reduce", "support") });
  if (finding.code === "PORTFOLIO_CAPITAL_OVERCOMMITTED") return draft(input, "RECOMMEND_RESOLVE_CAPITAL_SHORTFALL", "increase-liquidity", "resolve-capital-shortfall", "capital", input.portfolioId.value, { ...common, benefits: ["improves-liquidity", "reduces-risk"], tradeOffs: ["delays-growth"], constraints: ["insufficient-capital"], impact: impact("improve", "improve", "reduce", "delay") });
  if (finding.code === "PORTFOLIO_CAPITAL_RESERVE_LOW") return draft(input, "RECOMMEND_INCREASE_RESERVE", "increase-liquidity", "increase-reserve", "capital", input.portfolioId.value, { ...common, benefits: ["improves-liquidity", "improves-health"], tradeOffs: ["delays-growth"], constraints: [], impact: impact("improve", "improve", "reduce", "delay") });
  if (finding.code === "PORTFOLIO_MARKET_CONCENTRATED") return draft(input, "RECOMMEND_ADDRESS_MARKET_CONCENTRATION", "diversify", "address-concentration", "market", finding.subjectId ?? "dominant-market", { ...common, benefits: ["reduces-concentration", "reduces-risk"], tradeOffs: ["requires-capital"], constraints: [], impact: impact("improve", "consume", "reduce", "support") });
  if (finding.code === "PORTFOLIO_REVENUE_CONCENTRATED" || finding.code === "PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY") return draft(input, "RECOMMEND_REDUCE_REVENUE_DEPENDENCE", "diversify", "reduce-revenue-dependence", finding.subject === "property" ? "property" : "portfolio", finding.subjectId ?? input.portfolioId.value, { ...common, benefits: ["reduces-concentration", "reduces-risk"], tradeOffs: ["requires-capital"], constraints: [], impact: impact("improve", "consume", "reduce", "support") });
  if (finding.code === "PORTFOLIO_STRATEGY_MISALIGNED") return draft(input, "RECOMMEND_REEVALUATE_STRATEGY", "investigate", "reevaluate-strategy", "portfolio", input.portfolioId.value, { ...common, benefits: ["supports-strategy", "improves-health"], tradeOffs: ["may-delay-strategy"], constraints: [], impact: impact("improve", "preserve", "maintain", "support") });
  return null;
}

function allocationDraft(candidate: CapitalAllocationCandidateAssessment, input: EvaluatePortfolioRecommendationsInput): Draft | null {
  if (!["feasible", "conditionally-feasible"].includes(candidate.feasibility.status)) return null;
  const subject = subjectOf(candidate);
  const purpose = candidate.candidate.purpose;
  const evidence: PortfolioRecommendationEvidenceReference[] = [{ kind: "capital-allocation-candidate", referenceId: candidate.candidate.id.value, sourceVersion: input.allocation.allocationPolicyVersion }];
  const constraints: PortfolioRecommendationConstraint[] = candidate.feasibility.status === "conditionally-feasible" ? ["incomplete-analysis"] : [];
  const common = { evidence, confidence: [candidate.confidence.score.value, input.allocation.confidence.score.value], constraints, urgency: urgencyValue(candidate.candidate.timing.urgency) };
  if (purpose === "new-acquisition" || purpose === "acquisition-closing") return draft(input, "RECOMMEND_PRIMARY_ALLOCATION", "acquire", "acquire-opportunity", subject.type, subject.id, { ...common, benefits: ["supports-strategy", "improves-health"], tradeOffs: ["reduces-liquidity", ...(candidate.candidate.expectedImpact.diversification.introducesNewConcentration ? ["increases-concentration" as const] : [])], impact: impact("improve", "consume", candidate.candidate.expectedImpact.risk.direction === "reduces" ? "reduce" : "unknown", "support") });
  if (purpose === "property-improvement" || purpose === "property-expansion") return draft(input, "RECOMMEND_PRIMARY_ALLOCATION", "improve", "renovate-property", subject.type, subject.id, { ...common, benefits: ["improves-health", "increases-noi"], tradeOffs: ["requires-capital", "operational-disruption"], impact: impact("improve", "consume", "unknown", "support") });
  if (purpose === "risk-remediation" || purpose === "mandatory-obligation") return draft(input, "RECOMMEND_PRIMARY_ALLOCATION", "reduce-risk", "resolve-portfolio-risk", subject.type, subject.id, { ...common, benefits: ["reduces-risk", "improves-health"], tradeOffs: ["requires-capital", "delays-growth"], impact: impact("improve", "consume", "reduce", "support") });
  if (purpose === "defer-deployment" || purpose === "strategic-reserve" || purpose === "liquidity-reserve") return draft(input, "RECOMMEND_PRESERVE_CAPITAL", "preserve", "wait", subject.type, subject.id, { ...common, benefits: ["preserves-capital", "improves-liquidity"], tradeOffs: ["delays-growth", "foregoes-opportunity"], impact: impact("maintain", "preserve", "maintain", "delay") });
  return null;
}

function fromObservation(observation: EvaluatePortfolioRecommendationsInput["observations"][number], input: EvaluatePortfolioRecommendationsInput): Draft | null {
  const evidence = [{ kind: observation.kind, referenceId: observation.observationId, ...(observation.sourceVersion ? { sourceVersion: observation.sourceVersion } : {}) }];
  const stale = input.evaluatedAt.getTime() - observation.observedAt.getTime() > input.policy.staleObservationDays * 86_400_000;
  const common = { evidence, confidence: [observation.confidence.score.value, stale ? 25 : 100], constraints: stale ? ["stale-data" as const] : [], findingCodes: [observation.code], urgency: observation.severity === "critical" ? 100 : observation.severity === "high" ? 80 : 50 };
  if (observation.code === "EXECUTIVE_OCCUPANCY_DECLINING" && observation.subjectType === "property") return draft(input, "RECOMMEND_PRIMARY_ALLOCATION", "improve", "improve-occupancy", "property", observation.subjectId!, { ...common, benefits: ["increases-noi", "improves-health"], tradeOffs: ["operational-disruption"], impact: impact("improve", "unknown", "maintain", "support") });
  if (observation.code === "INVESTMENT_ANALYSIS_INCOMPLETE" && observation.subjectType === "opportunity") return draft(input, "RECOMMEND_COLLECT_MISSING_DATA", "investigate", "collect-missing-data", "opportunity", observation.subjectId!, { ...common, benefits: ["improves-data-quality"], tradeOffs: ["requires-more-evidence"], impact: impact("maintain", "preserve", "maintain", "unknown") });
  if (observation.code === "MARKET_CONCENTRATION_HIGH" && observation.subjectType === "market") return draft(input, "RECOMMEND_ADDRESS_MARKET_CONCENTRATION", "diversify", "address-concentration", "market", observation.subjectId!, { ...common, benefits: ["reduces-concentration", "reduces-risk"], tradeOffs: ["requires-capital"], impact: impact("improve", "consume", "reduce", "support") });
  return null;
}

function draft(input: EvaluatePortfolioRecommendationsInput, rule: PortfolioRecommendationRuleCode, category: PortfolioRecommendationCategory, type: PortfolioRecommendationType, subjectType: PortfolioRecommendationObjectReference["type"], subjectId: string, details: Readonly<{
  evidence: readonly PortfolioRecommendationEvidenceReference[];
  benefits: readonly PortfolioRecommendationBenefit[];
  tradeOffs: readonly PortfolioRecommendationTradeOff[];
  constraints: readonly PortfolioRecommendationConstraint[];
  impact: PortfolioRecommendationImpact;
  confidence: readonly number[];
  findingCodes?: readonly string[];
  urgency: number;
}>): Draft {
  const policyRule = input.policy.rules.find((value) => value.code === rule);
  if (!policyRule) throw new Error(`Recommendation policy rule ${rule} is unavailable.`);
  const subject = Object.freeze({ type: subjectType, id: subjectId });
  return Object.freeze({
    key: `${type}:${subjectType}:${subjectId}`,
    rule,
    category,
    type,
    priority: policyRule.priority,
    confidenceValues: Object.freeze([...details.confidence]),
    evidence: Object.freeze([...details.evidence]),
    benefits: Object.freeze([...details.benefits]),
    tradeOffs: Object.freeze([...details.tradeOffs]),
    constraints: Object.freeze([...details.constraints]),
    actionSubject: subject,
    affectedObjects: Object.freeze([subject]),
    impact: details.impact,
    findingCodes: Object.freeze([...(details.findingCodes ?? [])]),
    rationaleCode: `${rule}_RATIONALE`,
    ignoredImpactCode: `${rule}_IGNORED_IMPACT`,
    urgency: details.urgency,
  });
}

function suppress(values: readonly Draft[]): { drafts: readonly Draft[]; suppressed: readonly Readonly<{ normalizedKey: string; sourceCount: number }>[] } {
  const groups = new Map<string, Draft[]>();
  for (const value of values) groups.set(value.key, [...(groups.get(value.key) ?? []), value]);
  const drafts = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => mergeDrafts(group));
  const suppressed = [...groups.entries()].filter(([, group]) => group.length > 1).sort(([a], [b]) => a.localeCompare(b)).map(([normalizedKey, group]) => Object.freeze({ normalizedKey, sourceCount: group.length }));
  return { drafts: Object.freeze(drafts), suppressed: Object.freeze(suppressed) };
}

function mergeDrafts(group: readonly Draft[]): Draft {
  const strongest = [...group].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.rule.localeCompare(b.rule))[0];
  return Object.freeze({
    ...strongest,
    confidenceValues: uniqueNumbers(group.flatMap((item) => item.confidenceValues)),
    evidence: uniqueBy(group.flatMap((item) => item.evidence), (item) => `${item.kind}:${item.referenceId}`),
    benefits: unique(group.flatMap((item) => item.benefits)),
    tradeOffs: unique(group.flatMap((item) => item.tradeOffs)),
    constraints: unique(group.flatMap((item) => item.constraints)),
    findingCodes: unique(group.flatMap((item) => item.findingCodes)),
    urgency: Math.max(...group.map((item) => item.urgency)),
  });
}

function recommendation(value: Draft, input: EvaluatePortfolioRecommendationsInput, rank: number): PortfolioRecommendation {
  const confidenceValue = average(value.confidenceValues) - value.constraints.length * 5;
  const id = recommendationId(value.key);
  return Object.freeze({
    id,
    portfolioId: input.portfolioId,
    category: value.category,
    type: value.type,
    priority: value.priority,
    confidence: confidence(confidenceValue, value.evidence.map((item) => `${item.kind}:${item.referenceId}`)),
    evidence: Object.freeze(value.evidence.slice(0, input.policy.maximumEvidencePerRecommendation)),
    benefits: Object.freeze(value.benefits),
    tradeOffs: Object.freeze(value.tradeOffs),
    constraints: Object.freeze(value.constraints),
    recommendedAction: Object.freeze({ code: value.type, subject: value.actionSubject, reversible: true }),
    supportingFindingCodes: Object.freeze(value.findingCodes),
    affectedObjects: Object.freeze(value.affectedObjects),
    estimatedImpact: value.impact,
    rationaleCode: value.rationaleCode,
    ignoredImpactCode: value.ignoredImpactCode,
    rank,
    conflictIds: Object.freeze([]),
    policyVersion: input.policy.version,
    generatedAt: new Date(input.evaluatedAt),
  });
}

function findConflicts(recommendations: readonly PortfolioRecommendation[], limit: number) {
  const values: Readonly<{ recommendationIds: readonly [PortfolioRecommendationId, PortfolioRecommendationId]; code: string }>[] = [];
  for (let left = 0; left < recommendations.length; left += 1) for (let right = left + 1; right < recommendations.length; right += 1) {
    const a = recommendations[left], b = recommendations[right];
    if (conflict(a, b)) values.push(Object.freeze({ recommendationIds: Object.freeze([a.id, b.id]) as readonly [PortfolioRecommendationId, PortfolioRecommendationId], code: "PORTFOLIO_RECOMMENDATION_GROWTH_LIQUIDITY_CONFLICT" }));
  }
  return values.slice(0, limit);
}
function conflict(a: PortfolioRecommendation, b: PortfolioRecommendation): boolean {
  const growth = new Set(["acquire", "improve"]);
  const protection = new Set(["preserve", "increase-liquidity", "hold"]);
  return (growth.has(a.category) && protection.has(b.category)) || (growth.has(b.category) && protection.has(a.category));
}

function rankingScore(value: Draft, input: EvaluatePortfolioRecommendationsInput): number {
  const weights = input.policy.rankingWeights;
  return weights.priority.applyTo(priorityScore(value.priority)) +
    weights.confidence.applyTo(average(value.confidenceValues)) +
    weights.healthImpact.applyTo(value.impact.health === "improve" ? 100 : value.impact.health === "maintain" ? 60 : 25) +
    weights.capitalImpact.applyTo(value.impact.capital === "improve" ? 100 : value.impact.capital === "preserve" ? 80 : value.impact.capital === "consume" ? 40 : 25) +
    weights.riskReduction.applyTo(value.impact.risk === "reduce" ? 100 : value.impact.risk === "maintain" ? 60 : 25) +
    weights.urgency.applyTo(value.urgency);
}
function posture(values: readonly PortfolioRecommendation[]) {
  if (values.some((item) => item.priority === "critical" && (item.category === "reduce-risk" || item.category === "increase-liquidity"))) return "protect" as const;
  if (values.some((item) => item.category === "increase-liquidity" || item.category === "preserve")) return "stabilize" as const;
  if (values.some((item) => item.category === "improve" || item.category === "diversify")) return "optimize" as const;
  if (values.some((item) => item.category === "acquire")) return "grow" as const;
  return "observe" as const;
}

export function fingerprintPortfolioRecommendations(input: EvaluatePortfolioRecommendationsInput): string {
  const canonical = {
    portfolio: [input.portfolioId.value, input.portfolioVersion],
    health: [input.health.snapshotFingerprint, input.health.policyVersion],
    allocation: [input.allocation.snapshotFingerprint, input.allocation.allocationPolicyVersion],
    strategy: { available: input.strategy.available, defined: input.strategy.defined, version: input.strategy.version, goals: [...input.strategy.goals].sort((a, b) => a.referenceId.localeCompare(b.referenceId)) },
    observations: [...input.observations].sort((a, b) => a.observationId.localeCompare(b.observationId)).map((item) => [item.kind, item.observationId, item.code, item.subjectType, item.subjectId, item.severity, item.confidence.score.value, item.observedAt.toISOString(), item.sourceVersion]),
    policy: input.policy.version,
    window: [input.observationWindow.start.toISOString(), input.observationWindow.end.toISOString()],
    evaluatedAt: input.evaluatedAt.toISOString(),
    limitations: [...(input.sourceLimitations ?? [])].sort(),
  };
  return `prs-fnv1a-${fnv(JSON.stringify(canonical))}`;
}

function validate(input: EvaluatePortfolioRecommendationsInput): void {
  validatePortfolioRecommendationPolicy(input.policy);
  if (!input.health.portfolioId.equals(input.portfolioId) || !input.allocation.portfolioId.equals(input.portfolioId)) throw new Error("Recommendation sources belong to incompatible portfolios.");
  if (input.health.portfolioVersion !== input.portfolioVersion || input.allocation.portfolioVersion !== input.portfolioVersion) throw new Error("Recommendation sources are stale for the portfolio version.");
  if (input.allocation.healthPolicyVersion !== input.health.policyVersion) throw new Error("Recommendation allocation and health policies are incompatible.");
  if (input.observationWindow.start > input.observationWindow.end || Number.isNaN(input.evaluatedAt.getTime())) throw new TypeError("Recommendation evaluation dates are invalid.");
  if (input.observations.some((item) => !item.observationId.trim() || !item.code.trim() || Number.isNaN(item.observedAt.getTime()))) throw new TypeError("Recommendation observations require stable references, codes, and dates.");
}
function subjectOf(candidate: CapitalAllocationCandidateAssessment): PortfolioRecommendationObjectReference {
  const subject = candidate.candidate.subject;
  if ("propertyId" in subject) return Object.freeze({ type: "property", id: subject.propertyId });
  if ("opportunityId" in subject) return Object.freeze({ type: "opportunity", id: subject.opportunityId });
  if ("obligationId" in subject) return Object.freeze({ type: "capital", id: subject.obligationId });
  return Object.freeze({ type: "portfolio", id: subject.portfolioId.value });
}
function recommendationId(key: string): PortfolioRecommendationId { return Identifier.create(`portfolio-recommendation-${fnv(key)}`); }
function fnv(text: string) { let hash = 2166136261; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, "0"); }
function confidence(value: number, rationale: readonly string[]) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(Math.max(0, Math.min(100, Math.round(value * 100) / 100))), rationale: rationale.length ? rationale : ["Recommendation evidence assessed."] }); }
function assessmentConfidence(values: readonly PortfolioRecommendation[], input: EvaluatePortfolioRecommendationsInput, limitations: readonly string[]) { const base = average([input.health.confidence.score.value, input.allocation.confidence.score.value, ...values.map((value) => value.confidence.score.value)]); return confidence(base - limitations.length * 5, limitations.length ? limitations : ["Health, allocation, strategy, and observation evidence assessed."]); }
function impact(health: PortfolioRecommendationImpact["health"], capital: PortfolioRecommendationImpact["capital"], risk: PortfolioRecommendationImpact["risk"], strategy: PortfolioRecommendationImpact["strategy"]): PortfolioRecommendationImpact { return Object.freeze({ health, capital, risk, strategy }); }
function priorityRank(value: PortfolioRecommendationPriority) { return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as const)[value]; }
function priorityScore(value: PortfolioRecommendationPriority) { return ({ critical: 100, high: 80, medium: 60, low: 40, informational: 20 } as const)[value]; }
function urgencyValue(value: CapitalAllocationCandidateAssessment["candidate"]["timing"]["urgency"]) { return ({ immediate: 100, "near-term": 80, planned: 50, optional: 20 } as const)[value]; }
function average(values: readonly number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function unique<T extends string>(values: readonly T[]) { return Object.freeze([...new Set(values)].sort()); }
function uniqueNumbers(values: readonly number[]) { return Object.freeze([...new Set(values)].sort((a, b) => a - b)); }
function uniqueBy<T>(values: readonly T[], key: (value: T) => string) { return Object.freeze([...new Map(values.map((value) => [key(value), value])).values()].sort((a, b) => key(a).localeCompare(key(b)))); }
function cloneWindow(value: EvaluatePortfolioRecommendationsInput["observationWindow"]) { return Object.freeze({ start: new Date(value.start), end: new Date(value.end), ...(value.comparisonStart ? { comparisonStart: new Date(value.comparisonStart) } : {}), ...(value.comparisonEnd ? { comparisonEnd: new Date(value.comparisonEnd) } : {}) }); }

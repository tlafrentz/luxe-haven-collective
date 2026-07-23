import { Identifier } from "@/platform/kernel";

export type InvestmentOpportunityRoute = "purchase" | "rental-arbitrage";
export type OpportunityStatus = "evaluating" | "researching" | "shortlisted" | "offer-submitted" | "under-contract" | "acquired" | "rejected";
export type OpportunitySource = "user" | "learning" | "market" | "default" | "derived";

export type InvestmentOpportunityId = Identifier<`investment-opportunity-${string}`>;
export type OpportunityAnalysisId = Identifier<`opportunity-analysis-${string}`>;
export type OpportunityOwnerId = Identifier<string>;
export type OpportunityActivityId = Identifier<`opportunity-activity-${string}`>;
export const createInvestmentOpportunityId = (value?: string): InvestmentOpportunityId => Identifier.create((value ?? `investment-opportunity-${crypto.randomUUID()}`) as `investment-opportunity-${string}`);
export const createOpportunityAnalysisId = (value?: string): OpportunityAnalysisId => Identifier.create((value ?? `opportunity-analysis-${crypto.randomUUID()}`) as `opportunity-analysis-${string}`);
export const createOpportunityOwnerId = (value: string): OpportunityOwnerId => Identifier.create(value);
export const createOpportunityActivityId = (value?: string): OpportunityActivityId => Identifier.create((value ?? `opportunity-activity-${crypto.randomUUID()}`) as `opportunity-activity-${string}`);

export class OpportunityDomainError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "OpportunityDomainError"; }
}

export class OpportunityName {
  private constructor(public readonly value: string) {}
  static create(value: string): OpportunityName {
    const clean = value.trim();
    if (!clean || clean.length > 120) throw new OpportunityDomainError("INVALID_OPPORTUNITY_NAME", "Opportunity name must contain 1–120 characters.");
    return new OpportunityName(clean);
  }
  toString() { return this.value; }
}

export type OpportunityTag = Readonly<{ normalizedValue: string; displayValue: string }>;
export const MAX_OPPORTUNITY_TAGS = 20;
export function createOpportunityTag(value: string): OpportunityTag {
  const displayValue = value.trim().replace(/\s+/g, " ");
  if (!displayValue || displayValue.length > 40) throw new OpportunityDomainError("INVALID_OPPORTUNITY_TAG", "Opportunity tags must contain 1–40 characters.");
  return Object.freeze({ displayValue, normalizedValue: displayValue.toLocaleLowerCase("en-US") });
}
export function createOpportunityTags(values: readonly string[]): readonly OpportunityTag[] {
  if (values.length > MAX_OPPORTUNITY_TAGS) throw new OpportunityDomainError("INVALID_OPPORTUNITY_TAG", `An opportunity may have at most ${MAX_OPPORTUNITY_TAGS} tags.`);
  const tags = values.map(createOpportunityTag);
  const unique = new Map(tags.map((tag) => [tag.normalizedValue, tag]));
  if (unique.size !== tags.length) throw new OpportunityDomainError("INVALID_OPPORTUNITY_TAG", "Duplicate opportunity tags are not allowed.");
  return Object.freeze([...unique.values()].sort((a, b) => a.normalizedValue.localeCompare(b.normalizedValue)));
}

export type OpportunityAddress = Readonly<{ address1: string; address2?: string; city: string; state: string; postalCode: string; country?: string }>;
export type OpportunityPropertyReference = Readonly<{
  marketPropertyId?: string; normalizedAddress: OpportunityAddress; displayAddress: string;
  propertyType?: string; bedrooms?: number; bathrooms?: number; squareFeet?: number; yearBuilt?: number;
  providerReference?: Readonly<{ provider: string; externalId?: string }>;
  resolutionStatus: "resolved" | "user-supplied"; capturedAt: Date;
}>;

export type OpportunityActorReference = Readonly<{ type: "user" | "account" | "system"; id: string }>;
export type OpportunityMoneySnapshot = Readonly<{ amount: number; currency: "USD"; source?: OpportunitySource }>;
export type OpportunityMetricSnapshot = Readonly<{ value: number; source?: OpportunitySource }>;
export type OpportunityRecommendationSnapshot = Readonly<{ recommendation: "strong-buy" | "buy" | "buy-with-conditions" | "wait" | "pass"; summary: string; rationale: readonly string[]; conditions: readonly string[]; recommendationId?: string }>;
export type OpportunityScoreSnapshot = Readonly<{ value: number; scaleMinimum: number; scaleMaximum: number; band?: string }>;
export type OpportunityConfidenceSnapshot = Readonly<{ level: string; explanation?: string }>;
export type OpportunityFinancialSnapshot = Readonly<{
  purchasePrice?: OpportunityMoneySnapshot; proposedMonthlyLease?: OpportunityMoneySnapshot; estimatedMarketValue?: OpportunityMoneySnapshot; estimatedMarketRent?: OpportunityMoneySnapshot;
  projectedAnnualRevenue: OpportunityMoneySnapshot; projectedAdr: OpportunityMoneySnapshot; projectedOccupancy: OpportunityMetricSnapshot;
  operatingExpenses: OpportunityMoneySnapshot; netOperatingIncome?: OpportunityMoneySnapshot; annualCashFlow: OpportunityMoneySnapshot;
  capRate?: OpportunityMetricSnapshot; cashOnCashReturn: OpportunityMetricSnapshot; initialCashRequired: OpportunityMoneySnapshot;
}>;
export type OpportunityAnalysisSnapshot = Readonly<{
  schemaVersion: "1"; route: InvestmentOpportunityRoute; subject: Readonly<{ id: string; normalizedAddress: OpportunityAddress }>; recommendation: OpportunityRecommendationSnapshot; score: OpportunityScoreSnapshot;
  confidence: OpportunityConfidenceSnapshot; financials: OpportunityFinancialSnapshot;
  market: Readonly<{ name: string; submarket?: string; medianAdr: OpportunityMoneySnapshot; medianOccupancy: OpportunityMetricSnapshot; trend: string }>;
  risks: readonly Readonly<{ id: string; title: string; description: string; severity: string; probability: number; mitigation?: string }>[];
  dataGaps: readonly Readonly<{ code: string; description: string }>[]; evidence: readonly Readonly<{ id: string; title: string; source: string; confidence: string }>[];
  analyzedAt: Date;
}>;
export type OpportunityAnalysisSourceSummary = Readonly<{ userSuppliedCount: number; learningSuppliedCount: number; marketSuppliedCount: number; defaultSuppliedCount: number; overrides: readonly Readonly<{ assumption: string; winningSource: Exclude<OpportunitySource, "derived">; overriddenSource?: "learning" | "market" | "default" }>[]; marketEvidenceAvailable: boolean; marketAnalysisStatus?: string }>;
export type OpportunityAnalysisPolicyVersions = Readonly<{ investmentAnalysisPolicy?: string; investmentRecommendationPolicy?: string; investmentConfidencePolicy?: string; marketAnalysisPolicy?: string; comparableQualificationPolicy?: string; opportunitySnapshotSchema: "1" }>;
export type OpportunityAnalysisLineage = Readonly<{ investmentLifecycleResultId: string; investmentAnalysisContextId?: string; investmentMarketContextId?: string; marketAnalysisReportId?: string; evidenceIds: readonly string[]; decisionId?: string; recommendationId?: string }>;

export type OpportunityAnalysisProps = Readonly<{ id: OpportunityAnalysisId; opportunityId: InvestmentOpportunityId; sequence: number; route: InvestmentOpportunityRoute; investmentAnalysisId: string; investmentDecisionId?: string; marketAnalysisId?: string; resultSnapshot: OpportunityAnalysisSnapshot; sourceSummary: OpportunityAnalysisSourceSummary; policyVersions: OpportunityAnalysisPolicyVersions; lineage: OpportunityAnalysisLineage; createdBy: OpportunityActorReference; createdAt: Date }>;
export class OpportunityAnalysis {
  private constructor(private readonly state: OpportunityAnalysisProps) {}
  static create(input: OpportunityAnalysisProps): OpportunityAnalysis {
    if (!Number.isInteger(input.sequence) || input.sequence < 1 || !input.investmentAnalysisId.trim() || !input.lineage.investmentLifecycleResultId.trim()) throw new OpportunityDomainError("ANALYSIS_INVALID", "Analysis identity and sequence are required.");
    return new OpportunityAnalysis({ ...input, resultSnapshot: structuredClone(input.resultSnapshot), sourceSummary: structuredClone(input.sourceSummary), policyVersions: structuredClone(input.policyVersions), lineage: structuredClone(input.lineage), createdBy: Object.freeze({ ...input.createdBy }), createdAt: new Date(input.createdAt) });
  }
  get props() { return { ...this.state, resultSnapshot: structuredClone(this.state.resultSnapshot), sourceSummary: structuredClone(this.state.sourceSummary), policyVersions: structuredClone(this.state.policyVersions), lineage: structuredClone(this.state.lineage), createdBy: { ...this.state.createdBy }, createdAt: new Date(this.state.createdAt) }; }
  get id() { return this.state.id; } get sequence() { return this.state.sequence; } get route() { return this.state.route; }
  get lineage() { return structuredClone(this.state.lineage); } get createdAt() { return new Date(this.state.createdAt); }
}

export type OpportunityActivityType = "opportunity-created" | "analysis-saved" | "status-changed" | "name-changed" | "tags-changed" | "opportunity-archived" | "opportunity-restored";
export type OpportunityActivity = Readonly<{ id: OpportunityActivityId; opportunityId: InvestmentOpportunityId; type: OpportunityActivityType; actor: OpportunityActorReference; details: Readonly<Record<string, unknown>>; occurredAt: Date; aggregateVersion: number; commandId?: string }>;

import type { ImmutableAnalysisProjection } from "@/features/investment-opportunity";

export const INVESTMENT_REPORT_SCHEMA_VERSION = "investment-report.v1" as const;
export type InvestmentReportStatus = "active" | "archived";
export type InvestmentReportErrorCode =
  | "ANALYSIS_NOT_FOUND" | "ANALYSIS_UNAUTHORIZED" | "ANALYSIS_INCOMPLETE"
  | "ANALYSIS_VERSION_INCOMPATIBLE" | "CANONICAL_PROJECTIONS_UNAVAILABLE"
  | "REPORT_ALREADY_EXISTS" | "REPORT_NOT_FOUND" | "REPORT_UNAUTHORIZED"
  | "REPORT_PERSISTENCE_FAILED" | "ARCHIVE_CONFLICT" | "RESTORE_CONFLICT";

export class InvestmentReportError extends Error {
  constructor(public readonly code: InvestmentReportErrorCode, message: string) {
    super(message); this.name = "InvestmentReportError";
  }
}

export type ReportValue = Readonly<{
  label: string; value: string | number | boolean | null; unit?: string;
  sourceType: "user" | "provider" | "calculated" | "learning" | "default" | "unknown";
  observedAt?: string;
}>;

export type InvestmentReportSnapshot = Readonly<{
  schemaVersion: typeof INVESTMENT_REPORT_SCHEMA_VERSION;
  analysisProjectionVersion: string;
  lineage: Readonly<{
    opportunityId: string; analysisId: string; analysisVersion: number; strategy: "purchase" | "rental-arbitrage";
    calculationPolicyVersion?: string; scorePolicyVersion?: string; sourceLineage: unknown;
  }>;
  subject: Readonly<{ name: string; address: string; propertyType: string | null; bedrooms: number | null; bathrooms: number | null; market: string | null }>;
  decision: ImmutableAnalysisProjection["snapshot"]["recommendation"];
  score: ImmutableAnalysisProjection["snapshot"]["score"];
  confidence: ImmutableAnalysisProjection["snapshot"]["confidence"];
  financials: ImmutableAnalysisProjection["snapshot"]["financials"];
  market: ImmutableAnalysisProjection["snapshot"]["market"];
  risks: ImmutableAnalysisProjection["snapshot"]["risks"];
  limitations: ImmutableAnalysisProjection["snapshot"]["dataGaps"];
  evidence: ImmutableAnalysisProjection["snapshot"]["evidence"];
  assumptions: readonly ReportValue[];
  sourceSummary: ImmutableAnalysisProjection["analysisVersion"]["sourceSummary"];
  policyVersions: ImmutableAnalysisProjection["analysisVersion"]["policyVersions"];
  analyzedAt: string;
  generatedAt: string;
  currency: "USD";
}>;

export function buildInvestmentReportSnapshot(
  analysis: ImmutableAnalysisProjection,
  generatedAt: Date,
): InvestmentReportSnapshot {
  if (analysis.snapshot.schemaVersion !== "1") throw new InvestmentReportError("ANALYSIS_VERSION_INCOMPATIBLE", "This saved analysis version is not compatible with Investment Reports v1.");
  const financials = analysis.snapshot.financials;
  if (!financials?.projectedAnnualRevenue || !financials.annualCashFlow || !financials.projectedOccupancy) {
    throw new InvestmentReportError("CANONICAL_PROJECTIONS_UNAVAILABLE", "Save a completed analysis with canonical projections before generating a report.");
  }
  if (!analysis.snapshot.recommendation || !analysis.snapshot.score || !analysis.snapshot.confidence) {
    throw new InvestmentReportError("ANALYSIS_INCOMPLETE", "Complete and save the investment decision before generating a report.");
  }
  const property = analysis.opportunity.property;
  const sourceType = (source: string): ReportValue["sourceType"] =>
    source === "user" || source === "market" || source === "learning" || source === "default" || source === "derived"
      ? source === "market" ? "provider" : source === "derived" ? "calculated" : source
      : "unknown";
  return deepFreeze(structuredClone({
    schemaVersion: INVESTMENT_REPORT_SCHEMA_VERSION,
    analysisProjectionVersion: analysis.projectionVersion,
    lineage: {
      opportunityId: analysis.opportunity.id, analysisId: analysis.analysisVersion.id,
      analysisVersion: analysis.analysisVersion.number, strategy: analysis.snapshot.route,
      calculationPolicyVersion: analysis.analysisVersion.policyVersions.investmentAnalysisPolicy,
      scorePolicyVersion: analysis.analysisVersion.policyVersions.investmentRecommendationPolicy,
      sourceLineage: analysis.analysisVersion.lineage,
    },
    subject: {
      name: analysis.opportunity.name, address: property.displayAddress,
      propertyType: property.propertyType ?? null, bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null, market: analysis.snapshot.market?.name ?? null,
    },
    decision: analysis.snapshot.recommendation, score: analysis.snapshot.score,
    confidence: analysis.snapshot.confidence, financials, market: analysis.snapshot.market,
    risks: analysis.snapshot.risks, limitations: analysis.snapshot.dataGaps,
    evidence: analysis.snapshot.evidence,
    assumptions: analysis.assumptions.map(item => ({
      label: item.key, value: item.value, unit: item.unit ?? item.period,
      sourceType: sourceType(item.source), observedAt: item.sourceTimestamp,
    })),
    sourceSummary: analysis.analysisVersion.sourceSummary,
    policyVersions: analysis.analysisVersion.policyVersions,
    analyzedAt: analysis.snapshot.analyzedAt.toISOString(), generatedAt: generatedAt.toISOString(), currency: "USD",
  }));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

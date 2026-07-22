import type { MarketAnalysisReport } from "@/features/market-intelligence";
import { PlatformError } from "@/platform/kernel";

import type {
  InvestmentMarketContext,
  InvestmentMarketDataGapProjection,
  InvestmentMarketEvidenceUsability,
} from "./types/investment-market-context-types";

export type InvestmentMarketContextErrorCode =
  | "INVESTMENT_MARKET_CONTEXT_INVALID_REPORT"
  | "INVESTMENT_MARKET_CONTEXT_INVALID_LINEAGE";

export class InvestmentMarketContextError extends PlatformError {
  public constructor(code: InvestmentMarketContextErrorCode, message: string) {
    super(code, message);
  }
}

/** The sole Investment-owned projection of the canonical Market report. */
export function buildInvestmentMarketContext(
  report: MarketAnalysisReport,
): InvestmentMarketContext {
  validateReport(report);
  const evidenceIds = new Set(report.evidence.map(({ id }) => id));
  const evidenceCandidateIds = new Set(report.evidence.flatMap(({ candidateIds }) => candidateIds));
  const gapIds = new Set(report.dataGaps.map(({ id }) => id));
  for (const risk of report.risks) {
    if (risk.evidenceIds.some((id) => !evidenceIds.has(id) && !evidenceCandidateIds.has(id)) || risk.dataGapIds.some((id) => !gapIds.has(id))) {
      fail("INVESTMENT_MARKET_CONTEXT_INVALID_LINEAGE", "Market risk references must exist in the report.");
    }
  }

  const context: InvestmentMarketContext = {
    marketAnalysisId: report.analysisId,
    subjectId: report.subject.id,
    status: mapReportStatus(report.status),
    ...(report.saleValuation ? {
      saleValuation: {
        status: report.saleValuation.status,
        ...(report.saleValuation.estimatedValue === undefined ? {} : { estimatedValue: report.saleValuation.estimatedValue }),
        ...(report.saleValuation.valueRange === undefined ? {} : { valueRange: { ...report.saleValuation.valueRange } }),
        comparableCount: report.saleValuation.qualification.included.length,
        confidenceScore: report.saleValuation.confidence.score,
        source: "market-analysis",
      },
    } : {}),
    ...(report.longTermRent ? {
      longTermRent: {
        status: report.longTermRent.status,
        ...(report.longTermRent.estimatedMonthlyRent === undefined ? {} : { estimatedMonthlyRent: report.longTermRent.estimatedMonthlyRent }),
        ...(report.longTermRent.rentRange === undefined ? {} : { rentRange: { ...report.longTermRent.rentRange } }),
        comparableCount: report.longTermRent.qualification.included.length,
        confidenceScore: report.longTermRent.confidence.score,
        source: "market-analysis",
      },
    } : {}),
    confidence: {
      score: report.confidence.score,
      level: report.confidence.level,
      reasons: [...report.confidence.reasons].sort(),
    },
    risks: [...report.risks]
      .sort((a, b) => a.code.localeCompare(b.code) || a.title.localeCompare(b.title))
      .map((risk, index) => ({
      id: `${report.analysisId}:risk:${risk.code}:${index + 1}`,
      marketRiskCode: risk.code,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      sourceEvidenceIds: [...risk.evidenceIds].sort(),
      sourceDataGapIds: [...risk.dataGapIds].sort(),
      marketAnalysisId: report.analysisId,
      })),
    dataGaps: report.dataGaps.map((gap) => mapGap(gap, report.analysisId))
      .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id)),
    evidence: report.evidence.map((evidence) => ({
      evidenceId: evidence.id,
      type: evidence.type,
      description: evidence.description,
      candidateIds: [...evidence.candidateIds].sort(),
    })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    lineage: {
      marketAnalysisId: report.analysisId,
      propertyResolutionId: report.lineage.propertyResolutionId,
      policyVersion: report.lineage.policyVersion,
      observationIds: [...report.lineage.observationIds].sort(),
      evidenceIds: [...report.lineage.evidenceIds].sort(),
      ...(report.lineage.sale ? {
        saleAcquisitionId: report.lineage.sale.acquisitionId,
        saleQualificationId: report.lineage.sale.qualificationId,
      } : {}),
      ...(report.lineage.longTermRent ? {
        rentalAcquisitionId: report.lineage.longTermRent.acquisitionId,
        rentalQualificationId: report.lineage.longTermRent.qualificationId,
      } : {}),
    },
    analyzedAt: new Date(report.analyzedAt),
  };
  return deepFreeze(context);
}

/** Determines whether projected estimates are safe defaults without changing them. */
export function assessInvestmentMarketEvidenceUsability(
  context: InvestmentMarketContext,
): InvestmentMarketEvidenceUsability {
  const reasons: string[] = [];
  const blockingSections = new Set(context.dataGaps
    .filter(({ severity }) => severity === "blocking")
    .flatMap(({ affectedInvestmentAssumptionKeys }) => affectedInvestmentAssumptionKeys));
  const saleValuation = assessSection(context.saleValuation, "market-value", blockingSections, reasons);
  const longTermRent = assessSection(context.longTermRent, "monthly-lease", blockingSections, reasons);
  return deepFreeze({ saleValuation, longTermRent, reasons: reasons.sort() });
}

function assessSection(
  section: { readonly status: string; readonly confidenceScore: number; readonly estimatedValue?: number; readonly estimatedMonthlyRent?: number } | undefined,
  key: string,
  blocking: ReadonlySet<string>,
  reasons: string[],
): "usable" | "usable-with-caution" | "unusable" {
  const estimate = section?.estimatedValue ?? section?.estimatedMonthlyRent;
  if (!section || estimate === undefined || section.status === "insufficient" || section.status === "unsupported" || blocking.has(key)) {
    reasons.push(`${key}: authoritative estimate is unavailable or blocked.`);
    return "unusable";
  }
  if (section.status === "limited" || section.confidenceScore < 60) {
    reasons.push(`${key}: Market evidence is limited and should be used with caution.`);
    return "usable-with-caution";
  }
  return "usable";
}

function mapGap(gap: MarketAnalysisReport["dataGaps"][number], analysisId: string): InvestmentMarketDataGapProjection {
  const keys = gap.section === "sale-valuation"
    ? ["market-value"]
    : gap.section === "long-term-rent"
      ? ["monthly-lease"]
      : [];
  return {
    id: gap.id,
    code: gap.code,
    severity: gap.severity,
    affectedInvestmentAssumptionKeys: keys,
    sourceStage: gap.sourceStage,
    sourceMarketAnalysisId: analysisId,
  };
}

function validateReport(report: MarketAnalysisReport): void {
  if (!report.analysisId.trim() || !report.subject.id.trim() || !report.lineage.propertyResolutionId.trim()) {
    fail("INVESTMENT_MARKET_CONTEXT_INVALID_REPORT", "Market report identity and subject lineage are required.");
  }
  if (!Number.isFinite(report.confidence.score) || report.confidence.score < 0 || report.confidence.score > 100) {
    fail("INVESTMENT_MARKET_CONTEXT_INVALID_REPORT", "Market confidence must be between zero and one hundred.");
  }
  const observationIds = new Set(report.observations.map(({ id }) => id));
  const evidenceIds = new Set(report.evidence.map(({ id }) => id));
  if (observationIds.size !== report.observations.length || evidenceIds.size !== report.evidence.length || Number.isNaN(report.analyzedAt.getTime())) {
    fail("INVESTMENT_MARKET_CONTEXT_INVALID_REPORT", "Market report observation IDs, evidence IDs, and analysis time must be valid.");
  }
  if (report.lineage.observationIds.some((id) => !observationIds.has(id)) || report.lineage.evidenceIds.some((id) => !evidenceIds.has(id))) {
    fail("INVESTMENT_MARKET_CONTEXT_INVALID_LINEAGE", "Market report lineage must reference report observations and evidence.");
  }
}

function mapReportStatus(status: MarketAnalysisReport["status"]): InvestmentMarketContext["status"] {
  return status === "complete" ? "available" : status === "partial" ? "limited" : status;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(code: InvestmentMarketContextErrorCode, message: string): never {
  throw new InvestmentMarketContextError(code, message);
}

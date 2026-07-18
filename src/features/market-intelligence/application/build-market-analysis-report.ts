import type {
  ComparableAnalysis,
} from "../domain/entities/comparable-analysis";

import {
  MarketAnalysisReport,
} from "../domain/entities/market-analysis-report";

import type {
  MarketValuation,
} from "../domain/entities/market-valuation";

import {
  buildMarketAnalysisEvidence,
} from "./build-market-analysis-evidence";

import {
  buildMarketAnalysisFindings,
} from "./build-market-analysis-findings";

import {
  buildMarketAnalysisSummary,
} from "./build-market-analysis-summary";

export interface BuildMarketAnalysisReportInput {
  readonly analysis:
    ComparableAnalysis;
  readonly valuation:
    MarketValuation;
  readonly generatedAt?: Date;
}

export function buildMarketAnalysisReport(
  input:
    BuildMarketAnalysisReportInput,
): MarketAnalysisReport {
  return new MarketAnalysisReport({
    analysis:
      input.analysis,
    valuation:
      input.valuation,
    summary:
      buildMarketAnalysisSummary(
        input,
      ),
    findings:
      buildMarketAnalysisFindings(
        input,
      ),
    evidence:
      buildMarketAnalysisEvidence(
        input,
      ),
    generatedAt:
      input.generatedAt,
  });
}

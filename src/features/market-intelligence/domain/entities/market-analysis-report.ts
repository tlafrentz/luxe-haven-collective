import type {
  ComparableAnalysis,
} from "./comparable-analysis";

import type {
  MarketValuation,
} from "./market-valuation";

import {
  MarketAnalysisEvidence,
} from "../value-objects/market-analysis-evidence";

import {
  MarketAnalysisFinding,
} from "../value-objects/market-analysis-finding";

export interface MarketAnalysisReportInput {
  readonly analysis:
    ComparableAnalysis;
  readonly valuation:
    MarketValuation;
  readonly summary: string;
  readonly findings?:
    readonly MarketAnalysisFinding[];
  readonly evidence?:
    readonly MarketAnalysisEvidence[];
  readonly generatedAt?: Date;
}

/** Market-owned read projection; canonical lifecycle artifacts are produced by mapMarketPlatformArtifacts. */
export class MarketAnalysisReport {
  readonly analysis:
    ComparableAnalysis;

  readonly valuation:
    MarketValuation;

  readonly summary: string;

  readonly findings:
    readonly MarketAnalysisFinding[];

  readonly evidence:
    readonly MarketAnalysisEvidence[];

  readonly generatedAt: Date;

  constructor(
    input:
      MarketAnalysisReportInput,
  ) {
    const summary =
      input.summary.trim();

    if (!summary) {
      throw new Error(
        "Market analysis report summary is required.",
      );
    }

    this.analysis =
      input.analysis;

    this.valuation =
      input.valuation;

    this.summary =
      summary;

    this.findings =
      Object.freeze([
        ...(
          input.findings ??
          []
        ),
      ]);

    this.evidence =
      Object.freeze([
        ...(
          input.evidence ??
          []
        ),
      ]);

    this.generatedAt =
      input.generatedAt ??
      new Date();
  }

  get confidenceScore():
    number {
    return this.valuation
      .confidence
      .score;
  }

  get confidenceLevel():
    string {
    return this.valuation
      .confidence
      .level;
  }

  get estimatedValue():
    number {
    return this.valuation
      .valueRange
      .estimated;
  }

  get riskCount(): number {
    return this.findings
      .filter(
        (finding) =>
          finding.type ===
          "risk",
      )
      .length;
  }

  get dataGapCount():
    number {
    return this.findings
      .filter(
        (finding) =>
          finding.type ===
          "data-gap",
      )
      .length;
  }
}

export type MarketAnalysisEvidenceType =
  | "subject-property"
  | "comparable-property"
  | "valuation"
  | "provider"
  | "calculation";

export interface MarketAnalysisEvidenceInput {
  readonly type:
    MarketAnalysisEvidenceType;
  readonly label: string;
  readonly value: string;
  readonly source?: string;
}

export class MarketAnalysisEvidence {
  readonly type:
    MarketAnalysisEvidenceType;

  readonly label: string;

  readonly value: string;

  readonly source?: string;

  constructor(
    input:
      MarketAnalysisEvidenceInput,
  ) {
    const label =
      input.label.trim();

    const value =
      input.value.trim();

    if (!label) {
      throw new Error(
        "Market analysis evidence label is required.",
      );
    }

    if (!value) {
      throw new Error(
        "Market analysis evidence value is required.",
      );
    }

    this.type =
      input.type;

    this.label =
      label;

    this.value =
      value;

    this.source =
      input.source?.trim() ||
      undefined;
  }
}

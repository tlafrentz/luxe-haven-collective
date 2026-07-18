export type MarketAnalysisFindingType =
  | "strength"
  | "risk"
  | "observation"
  | "data-gap";

export type MarketAnalysisFindingSeverity =
  | "low"
  | "moderate"
  | "high";

export interface MarketAnalysisFindingInput {
  readonly type:
    MarketAnalysisFindingType;
  readonly title: string;
  readonly description: string;
  readonly severity?:
    MarketAnalysisFindingSeverity;
}

export class MarketAnalysisFinding {
  readonly type:
    MarketAnalysisFindingType;

  readonly title: string;

  readonly description: string;

  readonly severity:
    MarketAnalysisFindingSeverity;

  constructor(
    input:
      MarketAnalysisFindingInput,
  ) {
    const title =
      input.title.trim();

    const description =
      input.description.trim();

    if (!title) {
      throw new Error(
        "Market analysis finding title is required.",
      );
    }

    if (!description) {
      throw new Error(
        "Market analysis finding description is required.",
      );
    }

    this.type =
      input.type;

    this.title =
      title;

    this.description =
      description;

    this.severity =
      input.severity ??
      "moderate";
  }
}

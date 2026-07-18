export interface ExecutiveMarketSummaryInput {
  readonly headline: string;
  readonly summary: string;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly opportunities?: readonly string[];
  readonly unknowns?: readonly string[];
  readonly recommendedFocus?: readonly string[];
}

export class ExecutiveMarketSummary {
  readonly headline: string;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
  readonly unknowns: readonly string[];
  readonly recommendedFocus: readonly string[];

  private constructor(input: ExecutiveMarketSummaryInput) {
    this.headline = input.headline.trim();
    this.summary = input.summary.trim();
    this.strengths = Object.freeze([...(input.strengths ?? [])]);
    this.risks = Object.freeze([...(input.risks ?? [])]);
    this.opportunities = Object.freeze([...(input.opportunities ?? [])]);
    this.unknowns = Object.freeze([...(input.unknowns ?? [])]);
    this.recommendedFocus = Object.freeze([
      ...(input.recommendedFocus ?? []),
    ]);
  }

  static create(
    input: ExecutiveMarketSummaryInput,
  ): ExecutiveMarketSummary {
    if (!input.headline.trim()) {
      throw new Error("ExecutiveMarketSummary requires a headline.");
    }

    if (!input.summary.trim()) {
      throw new Error("ExecutiveMarketSummary requires a summary.");
    }

    return new ExecutiveMarketSummary(input);
  }

  get hasMaterialRisks(): boolean {
    return this.risks.length > 0;
  }

  get hasUnknowns(): boolean {
    return this.unknowns.length > 0;
  }
}

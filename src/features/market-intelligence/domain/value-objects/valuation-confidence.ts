export type ValuationConfidenceLevel =
  | "low"
  | "moderate"
  | "high";

export interface ValuationConfidenceInput {
  readonly score: number;
  readonly comparableCount: number;
  readonly averageSimilarity: number;
  readonly dispersionRatio: number;
  readonly reasons?: readonly string[];
}

export class ValuationConfidence {
  readonly score: number;

  readonly comparableCount: number;

  readonly averageSimilarity: number;

  readonly dispersionRatio: number;

  readonly reasons:
    readonly string[];

  constructor(
    input:
      ValuationConfidenceInput,
  ) {
    if (
      !Number.isFinite(
        input.score,
      ) ||
      input.score < 0 ||
      input.score > 100
    ) {
      throw new Error(
        "Valuation confidence score must be between 0 and 100.",
      );
    }

    if (
      !Number.isInteger(
        input.comparableCount,
      ) ||
      input.comparableCount < 0
    ) {
      throw new Error(
        "Valuation comparable count must be a non-negative integer.",
      );
    }

    if (
      !Number.isFinite(
        input.averageSimilarity,
      ) ||
      input.averageSimilarity < 0 ||
      input.averageSimilarity > 100
    ) {
      throw new Error(
        "Average similarity must be between 0 and 100.",
      );
    }

    if (
      !Number.isFinite(
        input.dispersionRatio,
      ) ||
      input.dispersionRatio < 0
    ) {
      throw new Error(
        "Valuation dispersion ratio must be a finite non-negative number.",
      );
    }

    this.score =
      Math.round(
        input.score * 100,
      ) / 100;

    this.comparableCount =
      input.comparableCount;

    this.averageSimilarity =
      Math.round(
        input.averageSimilarity * 100,
      ) / 100;

    this.dispersionRatio =
      Math.round(
        input.dispersionRatio * 10000,
      ) / 10000;

    this.reasons =
      Object.freeze([
        ...(
          input.reasons ??
          []
        ),
      ]);
  }

  get level():
    ValuationConfidenceLevel {
    if (
      this.score >= 80
    ) {
      return "high";
    }

    if (
      this.score >= 60
    ) {
      return "moderate";
    }

    return "low";
  }
}

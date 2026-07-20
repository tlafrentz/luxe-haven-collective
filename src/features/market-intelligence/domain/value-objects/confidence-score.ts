import { ConfidenceLevel } from "../enums/confidence-level";

/** @deprecated Compatibility score used by legacy Market models; canonical artifact confidence uses Platform Scoring. */
export class ConfidenceScore {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isFinite(value)) {
      throw new Error("Confidence score must be a finite number.");
    }

    if (value < 0 || value > 100) {
      throw new Error(
        "Confidence score must be between 0 and 100.",
      );
    }

    this.value = value;
  }

  get level(): ConfidenceLevel {
    if (this.value >= 90) {
      return ConfidenceLevel.VeryHigh;
    }

    if (this.value >= 75) {
      return ConfidenceLevel.High;
    }

    if (this.value >= 50) {
      return ConfidenceLevel.Moderate;
    }

    if (this.value >= 25) {
      return ConfidenceLevel.Low;
    }

    if (this.value > 0) {
      return ConfidenceLevel.VeryLow;
    }

    return ConfidenceLevel.Unknown;
  }

  greaterThan(
    other: ConfidenceScore,
  ): boolean {
    return this.value > other.value;
  }

  lessThan(
    other: ConfidenceScore,
  ): boolean {
    return this.value < other.value;
  }

  equals(
    other: ConfidenceScore,
  ): boolean {
    return this.value === other.value;
  }

  static zero(): ConfidenceScore {
    return new ConfidenceScore(0);
  }

  static maximum(): ConfidenceScore {
    return new ConfidenceScore(100);
  }
}

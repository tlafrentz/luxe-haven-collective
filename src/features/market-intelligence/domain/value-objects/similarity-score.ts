export interface SimilarityScoreBreakdown {
  readonly distance: number;
  readonly squareFeet: number;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly yearBuilt: number;
  readonly propertyType: number;
}

export class SimilarityScore {
  static readonly minimum = 0;
  static readonly maximum = 100;

  readonly value: number;
  readonly breakdown?: SimilarityScoreBreakdown;

  constructor(value: number, breakdown?: SimilarityScoreBreakdown) {
    if (!Number.isFinite(value)) {
      throw new Error("Similarity score must be a finite number.");
    }

    if (value < SimilarityScore.minimum || value > SimilarityScore.maximum) {
      throw new Error("Similarity score must be between 0 and 100.");
    }

    if (breakdown) validateBreakdown(breakdown);

    this.value = Math.round(value * 100) / 100;
    this.breakdown = breakdown;
  }

  get normalized(): number { return this.value / 100; }
  get isStrong(): boolean { return this.value >= 80; }
  get isModerate(): boolean { return this.value >= 60 && this.value < 80; }
  get isWeak(): boolean { return this.value < 60; }
}

function validateBreakdown(breakdown: SimilarityScoreBreakdown): void {
  const values = Object.values(breakdown);

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Similarity score breakdown values must be finite non-negative numbers.");
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  if (Math.abs(total - 100) > 0.01) {
    throw new Error("Similarity score breakdown must total 100.");
  }
}

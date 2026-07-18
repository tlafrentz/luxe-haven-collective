import { IntelligenceRating } from "../enums/intelligence-rating";

const MIN_MARKET_SCORE = 0;
const MAX_MARKET_SCORE = 100;

export class MarketScore {
  private constructor(public readonly value: number) {}

  static create(value: number): MarketScore {
    if (!Number.isFinite(value)) {
      throw new Error("MarketScore must be a finite number.");
    }

    if (value < MIN_MARKET_SCORE || value > MAX_MARKET_SCORE) {
      throw new Error(
        `MarketScore must be between ${MIN_MARKET_SCORE} and ${MAX_MARKET_SCORE}.`,
      );
    }

    return new MarketScore(value);
  }

  static zero(): MarketScore {
    return new MarketScore(MIN_MARKET_SCORE);
  }

  static maximum(): MarketScore {
    return new MarketScore(MAX_MARKET_SCORE);
  }

  get rating(): IntelligenceRating {
    if (this.value >= 85) {
      return IntelligenceRating.Exceptional;
    }

    if (this.value >= 70) {
      return IntelligenceRating.Strong;
    }

    if (this.value >= 50) {
      return IntelligenceRating.Moderate;
    }

    if (this.value >= 30) {
      return IntelligenceRating.Weak;
    }

    return IntelligenceRating.Insufficient;
  }

  equals(other: MarketScore): boolean {
    return this.value === other.value;
  }

  toNumber(): number {
    return this.value;
  }

  toString(): string {
    return `${this.value}`;
  }
}

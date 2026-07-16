import type { Money, Percentage, Rating } from "../value-objects";

export interface ComparableProperty {
  readonly id: string;

  readonly distanceMiles: number;

  readonly bedrooms: number;
  readonly bathrooms: number;

  readonly averageDailyRate: Money;
  readonly occupancy: Percentage;

  readonly rating: Rating;
  readonly reviewCount: number;

  readonly amenities: readonly string[];
}

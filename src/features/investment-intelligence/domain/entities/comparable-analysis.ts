import { ConfidenceLevel } from "../enums";
import type { Money, Percentage, Score } from "../value-objects";
import type { ComparableProperty } from "./comparable-property";

export interface ComparableAnalysis {
  readonly comparables: readonly ComparableProperty[];

  readonly medianAverageDailyRate: Money;
  readonly medianOccupancy: Percentage;

  readonly marketPositionScore: Score;
  readonly projectedRevenueUpside: Money;

  readonly competitiveAdvantages: readonly string[];
  readonly competitiveDisadvantages: readonly string[];

  readonly confidence: ConfidenceLevel;
}

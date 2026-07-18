export type ComparableAdjustmentType =
  | "distance"
  | "square-feet"
  | "bedrooms"
  | "bathrooms"
  | "year-built"
  | "property-type"
  | "recency"
  | "manual";

export interface ComparableAdjustmentInput {
  readonly type: ComparableAdjustmentType;
  readonly amount: number;
  readonly reason: string;
}

export class ComparableAdjustment {
  readonly type: ComparableAdjustmentType;
  readonly amount: number;
  readonly reason: string;

  constructor(input: ComparableAdjustmentInput) {
    if (!Number.isFinite(input.amount)) {
      throw new Error("Comparable adjustment amount must be a finite number.");
    }

    const reason = input.reason.trim();

    if (!reason) {
      throw new Error("Comparable adjustment reason is required.");
    }

    this.type = input.type;
    this.amount = input.amount;
    this.reason = reason;
  }

  get isPositive(): boolean { return this.amount > 0; }
  get isNegative(): boolean { return this.amount < 0; }
  get isNeutral(): boolean { return this.amount === 0; }
}

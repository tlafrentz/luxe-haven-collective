import { ValueObject } from "../../kernel";

type WeightProps = {
  readonly value: number;
};

/**
 * Immutable proportional weight represented as a ratio from 0 to 1.
 *
 * Use `Weight.fromPercentage` when the source value is expressed as a
 * percentage.
 */
export class Weight extends ValueObject<WeightProps> {
  private constructor(value: number) {
    super({ value });
  }

  /**
   * Creates a weight from a ratio between 0 and 1, inclusive.
   */
  public static create(value: number): Weight {
    assertFiniteNumber(value);

    if (value < 0 || value > 1) {
      throw new RangeError(
        "Weight ratio must be between 0 and 1, inclusive.",
      );
    }

    return new Weight(value);
  }

  /**
   * Creates a weight from a percentage between 0 and 100, inclusive.
   */
  public static fromPercentage(percentage: number): Weight {
    assertFiniteNumber(percentage);

    if (percentage < 0 || percentage > 100) {
      throw new RangeError(
        "Weight percentage must be between 0 and 100, inclusive.",
      );
    }

    return Weight.create(percentage / 100);
  }

  public get value(): number {
    return this.props.value;
  }

  public get ratio(): number {
    return this.value;
  }

  public get percentage(): number {
    return this.value * 100;
  }

  public isZero(): boolean {
    return this.value === 0;
  }

  public isFull(): boolean {
    return this.value === 1;
  }

  /**
   * Applies this weight to a numeric value.
   */
  public applyTo(value: number): number {
    assertFiniteNumber(value);

    return value * this.ratio;
  }
}

function assertFiniteNumber(value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError("Weight value must be a finite number.");
  }
}

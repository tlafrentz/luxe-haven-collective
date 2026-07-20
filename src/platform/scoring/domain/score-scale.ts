import { ValueObject } from "../../kernel";

type ScoreScaleProps = {
  readonly minimum: number;
  readonly maximum: number;
};

/**
 * Defines the inclusive numeric boundaries of a score.
 *
 * A scale is immutable and may be shared safely across scoring capabilities.
 */
export class ScoreScale extends ValueObject<ScoreScaleProps> {
  public static readonly ZERO_TO_ONE = ScoreScale.create(0, 1);
  public static readonly ZERO_TO_FIVE = ScoreScale.create(0, 5);
  public static readonly ZERO_TO_TEN = ScoreScale.create(0, 10);
  public static readonly ZERO_TO_ONE_HUNDRED = ScoreScale.create(0, 100);

  private constructor(props: ScoreScaleProps) {
    super(props);
  }

  public static create(
    minimum: number,
    maximum: number,
  ): ScoreScale {
    assertFiniteNumber(minimum, "minimum");
    assertFiniteNumber(maximum, "maximum");

    if (maximum <= minimum) {
      throw new RangeError(
        "Score scale maximum must be greater than its minimum.",
      );
    }

    return new ScoreScale({ minimum, maximum });
  }

  public get minimum(): number {
    return this.props.minimum;
  }

  public get maximum(): number {
    return this.props.maximum;
  }

  public get range(): number {
    return this.maximum - this.minimum;
  }

  /**
   * Returns whether a value falls within the inclusive scale boundaries.
   */
  public contains(value: number): boolean {
    return (
      Number.isFinite(value) &&
      value >= this.minimum &&
      value <= this.maximum
    );
  }

  /**
   * Restricts a value to this scale.
   */
  public clamp(value: number): number {
    assertFiniteNumber(value, "value");

    return Math.min(this.maximum, Math.max(this.minimum, value));
  }
}

function assertFiniteNumber(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `Score scale ${fieldName} must be a finite number.`,
    );
  }
}

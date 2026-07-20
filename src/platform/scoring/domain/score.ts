import { ValueObject } from "../../kernel";

import { ScoreScale } from "./score-scale";

type ScoreProps = {
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
};

/**
 * Immutable bounded numeric score.
 *
 * A score always carries its scale so values from incompatible scales cannot
 * be treated as equivalent accidentally.
 */
export class Score extends ValueObject<ScoreProps> {
  private constructor(
    value: number,
    scale: ScoreScale,
  ) {
    super({
      value,
      minimum: scale.minimum,
      maximum: scale.maximum,
    });
  }

  /**
   * Creates a score on the supplied scale.
   *
   * The default scale is 0–100.
   */
  public static create(
    value: number,
    scale: ScoreScale = ScoreScale.ZERO_TO_ONE_HUNDRED,
  ): Score {
    assertFiniteNumber(value);

    if (!scale.contains(value)) {
      throw new RangeError(
        `Score must be between ${scale.minimum} and ${scale.maximum}, inclusive.`,
      );
    }

    return new Score(value, scale);
  }

  /**
   * Creates a score after clamping the input to the supplied scale.
   */
  public static clamp(
    value: number,
    scale: ScoreScale = ScoreScale.ZERO_TO_ONE_HUNDRED,
  ): Score {
    return new Score(scale.clamp(value), scale);
  }

  public get value(): number {
    return this.props.value;
  }

  public get scale(): ScoreScale {
    return ScoreScale.create(
      this.props.minimum,
      this.props.maximum,
    );
  }

  public get minimum(): number {
    return this.props.minimum;
  }

  public get maximum(): number {
    return this.props.maximum;
  }

  /**
   * Returns this score's relative position on its scale from 0 to 1.
   */
  public toRatio(): number {
    return (this.value - this.minimum) /
      (this.maximum - this.minimum);
  }

  /**
   * Converts this score to an equivalent value on another scale.
   */
  public normalizeTo(targetScale: ScoreScale): Score {
    const normalizedValue =
      targetScale.minimum + this.toRatio() * targetScale.range;

    return Score.create(normalizedValue, targetScale);
  }

  /**
   * Returns a new score rounded to the requested decimal precision.
   */
  public round(decimalPlaces = 0): Score {
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
      throw new RangeError(
        "Score decimal places must be a non-negative integer.",
      );
    }

    const factor = 10 ** decimalPlaces;
    const rounded = Math.round(
      (this.value + Number.EPSILON) * factor,
    ) / factor;

    return Score.create(
      this.scale.clamp(rounded),
      this.scale,
    );
  }
}

function assertFiniteNumber(value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError("Score value must be a finite number.");
  }
}

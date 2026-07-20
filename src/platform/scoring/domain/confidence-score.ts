import { ValueObject } from "../../kernel";

import { Score } from "./score";
import { ScoreScale } from "./score-scale";

type ConfidenceScoreProps = {
  readonly value: number;
};

/**
 * Canonical platform confidence score on a 0–100 scale.
 */
export class ConfidenceScore extends ValueObject<ConfidenceScoreProps> {
  private constructor(value: number) {
    super({ value });
  }

  public static create(value: number): ConfidenceScore {
    return new ConfidenceScore(
      Score.create(
        value,
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ).value,
    );
  }

  public static clamp(value: number): ConfidenceScore {
    return new ConfidenceScore(
      Score.clamp(
        value,
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ).value,
    );
  }

  public get value(): number {
    return this.props.value;
  }

  public get score(): Score {
    return Score.create(
      this.value,
      ScoreScale.ZERO_TO_ONE_HUNDRED,
    );
  }

  public toRatio(): number {
    return this.score.toRatio();
  }

  public round(decimalPlaces = 0): ConfidenceScore {
    return ConfidenceScore.create(
      this.score.round(decimalPlaces).value,
    );
  }
}

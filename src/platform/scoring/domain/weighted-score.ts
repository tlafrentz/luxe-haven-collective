import { ValueObject } from "../../kernel";

import { Score } from "./score";
import { ScoreScale } from "./score-scale";
import { Weight } from "./weight";

type WeightedScoreProps = {
  readonly scoreValue: number;
  readonly scoreMinimum: number;
  readonly scoreMaximum: number;
  readonly weightRatio: number;
};

/**
 * Associates a score with a proportional weight.
 *
 * The weighted contribution is calculated against the score's normalized
 * position on its scale. This allows equivalent scores on different scales
 * to contribute consistently.
 */
export class WeightedScore extends ValueObject<WeightedScoreProps> {
  private constructor(
    score: Score,
    weight: Weight,
  ) {
    super({
      scoreValue: score.value,
      scoreMinimum: score.minimum,
      scoreMaximum: score.maximum,
      weightRatio: weight.ratio,
    });
  }

  public static create(
    score: Score,
    weight: Weight,
  ): WeightedScore {
    return new WeightedScore(score, weight);
  }

  public get score(): Score {
    return Score.create(
      this.props.scoreValue,
      ScoreScale.create(
        this.props.scoreMinimum,
        this.props.scoreMaximum,
      ),
    );
  }

  public get weight(): Weight {
    return Weight.create(this.props.weightRatio);
  }

  /**
   * Returns the normalized weighted contribution on a 0–1 scale.
   */
  public get normalizedContribution(): number {
    return this.score.toRatio() * this.weight.ratio;
  }

  /**
   * Returns the weighted contribution expressed on the score's own scale.
   */
  public get contribution(): number {
    return this.score.value * this.weight.ratio;
  }
}

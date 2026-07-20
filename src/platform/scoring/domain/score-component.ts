import { ValueObject } from "../../kernel";

import { Score } from "./score";
import { ScoreScale } from "./score-scale";
import { Weight } from "./weight";
import { WeightedScore } from "./weighted-score";

type ScoreComponentProps = {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly scoreValue: number;
  readonly scoreMinimum: number;
  readonly scoreMaximum: number;
  readonly weightRatio: number;
};

/**
 * Named component that contributes to a composite score.
 */
export class ScoreComponent extends ValueObject<ScoreComponentProps> {
  private constructor(props: ScoreComponentProps) {
    super(props);
  }

  public static create(input: Readonly<{
    key: string;
    label: string;
    score: Score;
    weight: Weight;
    description?: string;
  }>): ScoreComponent {
    const key = input.key.trim();
    const label = input.label.trim();
    const description = input.description?.trim();

    if (key.length === 0) {
      throw new TypeError("Score component key cannot be empty.");
    }

    if (label.length === 0) {
      throw new TypeError("Score component label cannot be empty.");
    }

    return new ScoreComponent({
      key,
      label,
      scoreValue: input.score.value,
      scoreMinimum: input.score.minimum,
      scoreMaximum: input.score.maximum,
      weightRatio: input.weight.ratio,
      ...(description ? { description } : {}),
    });
  }

  public get key(): string {
    return this.props.key;
  }

  public get label(): string {
    return this.props.label;
  }

  public get description(): string | undefined {
    return this.props.description;
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

  public get weightedScore(): WeightedScore {
    return WeightedScore.create(this.score, this.weight);
  }
}

import { ValueObject } from "../../kernel";

import { Score } from "./score";
import { ScoreComponent } from "./score-component";
import { ScoreScale } from "./score-scale";
import { Weight } from "./weight";

type ScoreComponentSnapshot = {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly scoreValue: number;
  readonly scoreMinimum: number;
  readonly scoreMaximum: number;
  readonly weightRatio: number;
};

type ScoreBreakdownProps = {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly components: readonly ScoreComponentSnapshot[];
  readonly scoreValue: number;
  readonly scoreMinimum: number;
  readonly scoreMaximum: number;
  readonly totalWeightRatio: number;
};

const WEIGHT_TOLERANCE = 1e-10;

/**
 * Composite score calculated from a complete set of weighted components.
 *
 * Every component must use the same score scale. Component keys must be
 * unique, and weights must total exactly 1 within floating-point tolerance.
 */
export class ScoreBreakdown extends ValueObject<ScoreBreakdownProps> {
  private constructor(props: ScoreBreakdownProps) {
    super(props);
  }

  public static create(input: Readonly<{
    key: string;
    label: string;
    components: readonly ScoreComponent[];
    description?: string;
  }>): ScoreBreakdown {
    const key = input.key.trim();
    const label = input.label.trim();
    const description = input.description?.trim();
    const components = [...input.components];

    if (key.length === 0) {
      throw new TypeError("Score breakdown key cannot be empty.");
    }

    if (label.length === 0) {
      throw new TypeError("Score breakdown label cannot be empty.");
    }

    if (components.length === 0) {
      throw new RangeError(
        "Score breakdown requires at least one component.",
      );
    }

    assertUniqueComponentKeys(components);
    assertCommonScale(components);

    const totalWeightRatio = components.reduce(
      (total, component) => total + component.weight.ratio,
      0,
    );

    if (Math.abs(totalWeightRatio - 1) > WEIGHT_TOLERANCE) {
      throw new RangeError(
        "Score breakdown component weights must total 100%.",
      );
    }

    const scale = components[0].score.scale;
    const scoreValue = components.reduce(
      (total, component) =>
        total + component.weightedScore.contribution,
      0,
    );

    return new ScoreBreakdown({
      key,
      label,
      ...(description ? { description } : {}),
      components: components.map(toSnapshot),
      scoreValue,
      scoreMinimum: scale.minimum,
      scoreMaximum: scale.maximum,
      totalWeightRatio,
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

  public get components(): readonly ScoreComponent[] {
    return this.props.components.map(fromSnapshot);
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

  public get totalWeightPercentage(): number {
    return this.props.totalWeightRatio * 100;
  }

  public getComponent(
    key: string,
  ): ScoreComponent | undefined {
    const snapshot = this.props.components.find(
      (component) => component.key === key,
    );

    return snapshot ? fromSnapshot(snapshot) : undefined;
  }
}

function toSnapshot(
  component: ScoreComponent,
): ScoreComponentSnapshot {
  return {
    key: component.key,
    label: component.label,
    ...(component.description
      ? { description: component.description }
      : {}),
    scoreValue: component.score.value,
    scoreMinimum: component.score.minimum,
    scoreMaximum: component.score.maximum,
    weightRatio: component.weight.ratio,
  };
}

function fromSnapshot(
  snapshot: ScoreComponentSnapshot,
): ScoreComponent {
  return ScoreComponent.create({
    key: snapshot.key,
    label: snapshot.label,
    ...(snapshot.description
      ? { description: snapshot.description }
      : {}),
    score: Score.create(
      snapshot.scoreValue,
      ScoreScale.create(
        snapshot.scoreMinimum,
        snapshot.scoreMaximum,
      ),
    ),
    weight: Weight.create(snapshot.weightRatio),
  });
}

function assertUniqueComponentKeys(
  components: readonly ScoreComponent[],
): void {
  const keys = new Set<string>();

  for (const component of components) {
    if (keys.has(component.key)) {
      throw new RangeError(
        `Score breakdown component key "${component.key}" is duplicated.`,
      );
    }

    keys.add(component.key);
  }
}

function assertCommonScale(
  components: readonly ScoreComponent[],
): void {
  const expectedScale = components[0].score.scale;

  for (const component of components.slice(1)) {
    if (!component.score.scale.equals(expectedScale)) {
      throw new RangeError(
        "Score breakdown components must use the same score scale.",
      );
    }
  }
}

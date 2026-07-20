import {
  ValueObject,
} from "../../kernel";

type EvaluationEvidenceWeightProps = Readonly<{
  value: number;
}>;

/**
 * Normalized influence assigned to Evidence during an Evaluation.
 *
 * Weight answers:
 * "How much did this Evidence influence the judgment?"
 *
 * It does not answer:
 * "How certain is the platform?"
 */
export class EvaluationEvidenceWeight extends ValueObject<EvaluationEvidenceWeightProps> {
  private constructor(
    props: EvaluationEvidenceWeightProps,
  ) {
    super(props);
  }

  public static create(
    value: number,
  ): EvaluationEvidenceWeight {
    if (
      !Number.isFinite(value)
    ) {
      throw new TypeError(
        "Evaluation evidence weight must be finite.",
      );
    }

    if (
      value < 0 ||
      value > 1
    ) {
      throw new RangeError(
        "Evaluation evidence weight must be between 0 and 1.",
      );
    }

    return new EvaluationEvidenceWeight({
      value,
    });
  }

  public static zero():
    EvaluationEvidenceWeight {
    return EvaluationEvidenceWeight.create(
      0,
    );
  }

  public static full():
    EvaluationEvidenceWeight {
    return EvaluationEvidenceWeight.create(
      1,
    );
  }

  public get value(): number {
    return this.props.value;
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
}

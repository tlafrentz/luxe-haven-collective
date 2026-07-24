import { ValueObject } from "./value-object";

type PercentageProps = {
  readonly value: number;
};

export class Percentage extends ValueObject<PercentageProps> {
  private constructor(value: number) {
    super({ value });
  }

  public static create(value: number): Percentage {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError("Percentage must be between 0 and 100, inclusive.");
    }

    return new Percentage(value);
  }

  public static zero(): Percentage {
    return Percentage.create(0);
  }

  public get value(): number {
    return this.props.value;
  }

  public get ratio(): number {
    return this.value / 100;
  }
}

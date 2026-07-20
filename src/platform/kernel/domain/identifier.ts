import { ValueObject } from "./value-object";

type IdentifierProps<TValue extends string> = {
  readonly value: TValue;
};

/**
 * Immutable, strongly typed identifier.
 *
 * Identifier creation validates that the supplied string contains at least
 * one non-whitespace character. The original string is preserved.
 *
 * @typeParam TValue - A string type used to strengthen identifier boundaries.
 */
export class Identifier<
  TValue extends string = string,
> extends ValueObject<IdentifierProps<TValue>> {
  private constructor(value: TValue) {
    super({ value });
  }

  public static create<TValue extends string>(
    value: TValue,
  ): Identifier<TValue> {
    if (value.trim().length === 0) {
      throw new TypeError("Identifier value cannot be empty.");
    }

    return new Identifier(value);
  }

  public get value(): TValue {
    return this.props.value;
  }

  public override toString(): TValue {
    return this.value;
  }

  public toJSON(): TValue {
    return this.value;
  }
}

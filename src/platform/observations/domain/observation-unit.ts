import { ValueObject } from "../../kernel";

export type ObservationUnitInput = Readonly<{
  type: string;
  symbol?: string;
}>;

type ObservationUnitProps = Readonly<{
  type: string;
  symbol?: string;
}>;

/**
 * Describes how an observation value should be interpreted.
 *
 * Examples:
 * - { type: "currency", symbol: "USD" }
 * - { type: "percentage" }
 * - { type: "nights" }
 * - { type: "currency-per-night", symbol: "USD" }
 */
export class ObservationUnit extends ValueObject<ObservationUnitProps> {
  private constructor(
    props: ObservationUnitProps,
  ) {
    super(props);
  }

  public static create(
    input: ObservationUnitInput,
  ): ObservationUnit {
    const type = requireText(
      input.type,
      "Observation unit type",
    );

    return new ObservationUnit({
      type,
      ...(input.symbol !== undefined
        ? {
            symbol: requireText(
              input.symbol,
              "Observation unit symbol",
            ),
          }
        : {}),
    });
  }

  public get type(): string {
    return this.props.type;
  }

  public get symbol(): string | undefined {
    return this.props.symbol;
  }
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(`${field} cannot be empty.`);
  }

  return normalized;
}

import { ValueObject } from "../../kernel";

type DecisionContextProps = {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly scope?: string;
  readonly scenario?: string;
  readonly effectiveAt: string;
  readonly attributes: Readonly<Record<string, string>>;
};

export type DecisionContextInput = Readonly<{
  subjectType: string;
  subjectId: string;
  effectiveAt: Date;
  scope?: string;
  scenario?: string;
  attributes?: Readonly<Record<string, string>>;
}>;

/**
 * Reproducible context for a business decision.
 *
 * Context identifies what was evaluated, when the conclusion applies, and the
 * scenario or scope under which the decision was reached.
 */
export class DecisionContext extends ValueObject<DecisionContextProps> {
  private constructor(props: DecisionContextProps) {
    super(props);
  }

  public static create(
    input: DecisionContextInput,
  ): DecisionContext {
    const subjectType = requireText(
      input.subjectType,
      "Decision context subject type",
    );
    const subjectId = requireText(
      input.subjectId,
      "Decision context subject ID",
    );
    const scope = optionalText(input.scope);
    const scenario = optionalText(input.scenario);

    if (
      !(input.effectiveAt instanceof Date) ||
      Number.isNaN(input.effectiveAt.getTime())
    ) {
      throw new TypeError(
        "Decision context effective date must be valid.",
      );
    }

    return new DecisionContext({
      subjectType,
      subjectId,
      ...(scope ? { scope } : {}),
      ...(scenario ? { scenario } : {}),
      effectiveAt: input.effectiveAt.toISOString(),
      attributes: normalizeAttributes(input.attributes ?? {}),
    });
  }

  public get subjectType(): string {
    return this.props.subjectType;
  }

  public get subjectId(): string {
    return this.props.subjectId;
  }

  public get scope(): string | undefined {
    return this.props.scope;
  }

  public get scenario(): string | undefined {
    return this.props.scenario;
  }

  public get effectiveAt(): Date {
    return new Date(this.props.effectiveAt);
  }

  public get attributes(): Readonly<Record<string, string>> {
    return this.props.attributes;
  }

  public getAttribute(key: string): string | undefined {
    return this.attributes[key];
  }
}

function normalizeAttributes(
  attributes: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const normalizedEntries = Object.entries(attributes)
    .map(([key, value]) => [
      requireText(key, "Decision context attribute key"),
      requireText(value, "Decision context attribute value"),
    ] as const)
    .sort(([first], [second]) => first.localeCompare(second));

  return Object.fromEntries(normalizedEntries);
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

function optionalText(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

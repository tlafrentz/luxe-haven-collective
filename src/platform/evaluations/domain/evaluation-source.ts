import {
  ValueObject,
} from "../../kernel";

type EvaluationSourceProps = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

export type EvaluationSourceInput = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

/**
 * Identifies the capability and policy responsible for an Evaluation.
 */
export class EvaluationSource extends ValueObject<EvaluationSourceProps> {
  private constructor(
    props: EvaluationSourceProps,
  ) {
    super(props);
  }

  public static create(
    input: EvaluationSourceInput,
  ): EvaluationSource {
    const version =
      optionalText(input.version);

    return new EvaluationSource({
      capability: requireText(
        input.capability,
        "Evaluation source capability",
      ),
      name: requireText(
        input.name,
        "Evaluation source name",
      ),
      ...(version
        ? { version }
        : {}),
    });
  }

  public get capability(): string {
    return this.props.capability;
  }

  public get name(): string {
    return this.props.name;
  }

  public get version():
    | string
    | undefined {
    return this.props.version;
  }

  public isFromCapability(
    capability: string,
  ): boolean {
    return (
      this.capability ===
      requireText(
        capability,
        "Evaluation source capability",
      )
    );
  }

  public isFrom(
    capability: string,
    name: string,
  ): boolean {
    return (
      this.isFromCapability(
        capability,
      ) &&
      this.name ===
        requireText(
          name,
          "Evaluation source name",
        )
    );
  }
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `${field} cannot be empty.`,
    );
  }

  return normalized;
}

function optionalText(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();

  return normalized
    ? normalized
    : undefined;
}

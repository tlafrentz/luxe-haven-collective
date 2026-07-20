import {
  ValueObject,
} from "../../kernel";

type ClaimSourceProps = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

export type ClaimSourceInput = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

/**
 * Identifies the capability and policy responsible for formulating a Claim.
 */
export class ClaimSource extends ValueObject<ClaimSourceProps> {
  private constructor(
    props: ClaimSourceProps,
  ) {
    super(props);
  }

  public static create(
    input: ClaimSourceInput,
  ): ClaimSource {
    const version =
      optionalText(input.version);

    return new ClaimSource({
      capability: requireText(
        input.capability,
        "Claim source capability",
      ),
      name: requireText(
        input.name,
        "Claim source name",
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
        "Claim source capability",
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
          "Claim source name",
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

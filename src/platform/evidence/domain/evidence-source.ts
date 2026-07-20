import { ValueObject } from "../../kernel";

export type EvidenceSourceInput = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

type EvidenceSourceProps = Readonly<{
  capability: string;
  name: string;
  version?: string;
}>;

/**
 * Identifies the capability, policy, rule set, or analytical process that
 * interpreted observations into evidence.
 */
export class EvidenceSource extends ValueObject<EvidenceSourceProps> {
  private constructor(
    props: EvidenceSourceProps,
  ) {
    super(props);
  }

  public static create(
    input: EvidenceSourceInput,
  ): EvidenceSource {
    const capability = requireText(
      input.capability,
      "Evidence source capability",
    );
    const name = requireText(
      input.name,
      "Evidence source name",
    );

    return new EvidenceSource({
      capability,
      name,
      ...(input.version !== undefined
        ? {
            version: requireText(
              input.version,
              "Evidence source version",
            ),
          }
        : {}),
    });
  }

  public get capability(): string {
    return this.props.capability;
  }

  public get name(): string {
    return this.props.name;
  }

  public get version(): string | undefined {
    return this.props.version;
  }

  public get isVersioned(): boolean {
    return this.version !== undefined;
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

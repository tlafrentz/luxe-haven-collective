import { ValueObject } from "../../kernel";

export type ObservationSourceInput = Readonly<{
  type: string;
  name: string;
  referenceId?: string;
  version?: string;
}>;

type ObservationSourceProps = Readonly<{
  type: string;
  name: string;
  referenceId?: string;
  version?: string;
}>;

/**
 * Describes where an observation originated.
 *
 * Confidence and quality are intentionally excluded. Those belong to platform
 * scoring and later provenance assessment.
 */
export class ObservationSource extends ValueObject<ObservationSourceProps> {
  private constructor(
    props: ObservationSourceProps,
  ) {
    super(props);
  }

  public static create(
    input: ObservationSourceInput,
  ): ObservationSource {
    return new ObservationSource({
      type: requireText(
        input.type,
        "Observation source type",
      ),
      name: requireText(
        input.name,
        "Observation source name",
      ),
      ...optionalText(
        "referenceId",
        input.referenceId,
        "Observation source reference id",
      ),
      ...optionalText(
        "version",
        input.version,
        "Observation source version",
      ),
    });
  }

  public get type(): string {
    return this.props.type;
  }

  public get name(): string {
    return this.props.name;
  }

  public get referenceId(): string | undefined {
    return this.props.referenceId;
  }

  public get version(): string | undefined {
    return this.props.version;
  }

  public get isTraceable(): boolean {
    return this.referenceId !== undefined;
  }
}

function optionalText<
  TKey extends "referenceId" | "version",
>(
  key: TKey,
  value: string | undefined,
  field: string,
): Partial<Record<TKey, string>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: requireText(value, field),
  } as Partial<Record<TKey, string>>;
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

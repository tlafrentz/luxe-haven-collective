import { ValueObject } from "../../kernel";

export type ObservationSubjectInput = Readonly<{
  type: string;
  id: string;
  parentType?: string;
  parentId?: string;
}>;

type ObservationSubjectProps = Readonly<{
  type: string;
  id: string;
  parentType?: string;
  parentId?: string;
}>;

/**
 * Identifies the business object or analytical scope an observation concerns.
 */
export class ObservationSubject extends ValueObject<ObservationSubjectProps> {
  private constructor(
    props: ObservationSubjectProps,
  ) {
    super(props);
  }

  public static create(
    input: ObservationSubjectInput,
  ): ObservationSubject {
    const type = requireText(
      input.type,
      "Observation subject type",
    );
    const id = requireText(
      input.id,
      "Observation subject id",
    );

    const hasParentType =
      input.parentType !== undefined;
    const hasParentId =
      input.parentId !== undefined;

    if (hasParentType !== hasParentId) {
      throw new TypeError(
        "Observation subject parent type and parent id must be provided together.",
      );
    }

    return new ObservationSubject({
      type,
      id,
      ...(hasParentType && hasParentId
        ? {
            parentType: requireText(
              input.parentType!,
              "Observation subject parent type",
            ),
            parentId: requireText(
              input.parentId!,
              "Observation subject parent id",
            ),
          }
        : {}),
    });
  }

  public get type(): string {
    return this.props.type;
  }

  public get id(): string {
    return this.props.id;
  }

  public get parentType(): string | undefined {
    return this.props.parentType;
  }

  public get parentId(): string | undefined {
    return this.props.parentId;
  }

  public get hasParent(): boolean {
    return (
      this.parentType !== undefined &&
      this.parentId !== undefined
    );
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

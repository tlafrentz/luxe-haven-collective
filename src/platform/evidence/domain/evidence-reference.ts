import { ValueObject } from "../../kernel";
import {
  createObservationId,
  type ObservationId,
} from "../../observations";

import {
  EvidenceReferenceRole,
} from "./evidence-reference-role";

export type EvidenceReferenceInput = Readonly<{
  observationId: ObservationId | string;
  role?: EvidenceReferenceRole;
  note?: string;
}>;

type EvidenceReferenceProps = Readonly<{
  observationIdValue: string;
  role: EvidenceReferenceRole;
  note?: string;
}>;

/**
 * Immutable traceability link from canonical evidence to an originating
 * platform observation.
 */
export class EvidenceReference extends ValueObject<EvidenceReferenceProps> {
  private constructor(
    props: EvidenceReferenceProps,
  ) {
    super(props);
  }

  public static create(
    input: EvidenceReferenceInput,
  ): EvidenceReference {
    const observationId =
      typeof input.observationId === "string"
        ? createObservationId(input.observationId)
        : input.observationId;

    return new EvidenceReference({
      observationIdValue: observationId.value,
      role:
        input.role ??
        EvidenceReferenceRole.PRIMARY,
      ...(input.note !== undefined
        ? {
            note: requireText(
              input.note,
              "Evidence reference note",
            ),
          }
        : {}),
    });
  }

  public get observationId(): ObservationId {
    return createObservationId(
      this.props.observationIdValue,
    );
  }

  public get role(): EvidenceReferenceRole {
    return this.props.role;
  }

  public get note(): string | undefined {
    return this.props.note;
  }

  public get isPrimary(): boolean {
    return (
      this.role ===
      EvidenceReferenceRole.PRIMARY
    );
  }

  public references(
    observationId: ObservationId,
  ): boolean {
    return this.observationId.equals(
      observationId,
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

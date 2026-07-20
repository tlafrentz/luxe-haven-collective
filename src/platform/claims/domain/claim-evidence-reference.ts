import {
  ValueObject,
} from "../../kernel";

import {
  createEvidenceId,
  type EvidenceId,
} from "../../evidence";

import {
  ClaimEvidenceRole,
} from "./claim-evidence-role";

type ClaimEvidenceReferenceProps = Readonly<{
  evidenceIdValue: string;
  role: ClaimEvidenceRole;
  note?: string;
}>;

export type ClaimEvidenceReferenceInput = Readonly<{
  evidenceId: EvidenceId | string;
  role?: ClaimEvidenceRole;
  note?: string;
}>;

/**
 * Immutable traceability link from a Claim to canonical Evidence.
 */
export class ClaimEvidenceReference extends ValueObject<ClaimEvidenceReferenceProps> {
  private constructor(
    props: ClaimEvidenceReferenceProps,
  ) {
    super(props);
  }

  public static create(
    input: ClaimEvidenceReferenceInput,
  ): ClaimEvidenceReference {
    const evidenceId =
      typeof input.evidenceId === "string"
        ? createEvidenceId(
            input.evidenceId,
          )
        : input.evidenceId;

    const note =
      optionalText(input.note);

    return new ClaimEvidenceReference({
      evidenceIdValue:
        evidenceId.value,
      role:
        input.role ??
        ClaimEvidenceRole.PRIMARY,
      ...(note
        ? { note }
        : {}),
    });
  }

  public get evidenceId(): EvidenceId {
    return createEvidenceId(
      this.props.evidenceIdValue,
    );
  }

  public get role():
    ClaimEvidenceRole {
    return this.props.role;
  }

  public get note():
    | string
    | undefined {
    return this.props.note;
  }

  public get isPrimary(): boolean {
    return (
      this.role ===
      ClaimEvidenceRole.PRIMARY
    );
  }

  public references(
    evidenceId: EvidenceId,
  ): boolean {
    return this.evidenceId.equals(
      evidenceId,
    );
  }
}

function optionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      "Claim evidence reference note cannot be empty.",
    );
  }

  return normalized;
}

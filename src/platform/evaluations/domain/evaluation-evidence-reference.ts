import {
  ValueObject,
} from "../../kernel";

import {
  createEvidenceId,
  type EvidenceId,
} from "../../evidence";

import {
  EvaluationEvidenceRole,
} from "./evaluation-evidence-role";

import {
  EvaluationEvidenceWeight,
} from "./evaluation-evidence-weight";

type EvaluationEvidenceReferenceProps = Readonly<{
  evidenceIdValue: string;
  role: EvaluationEvidenceRole;
  weightValue: number;
  note?: string;
}>;

export type EvaluationEvidenceReferenceInput = Readonly<{
  evidenceId: EvidenceId | string;
  role?: EvaluationEvidenceRole;
  weight?:
    | EvaluationEvidenceWeight
    | number;
  note?: string;
}>;

/**
 * Immutable traceability record describing how canonical Evidence influenced
 * an Evaluation.
 */
export class EvaluationEvidenceReference extends ValueObject<EvaluationEvidenceReferenceProps> {
  private constructor(
    props: EvaluationEvidenceReferenceProps,
  ) {
    super(props);
  }

  public static create(
    input: EvaluationEvidenceReferenceInput,
  ): EvaluationEvidenceReference {
    const evidenceId =
      typeof input.evidenceId ===
      "string"
        ? createEvidenceId(
            input.evidenceId,
          )
        : input.evidenceId;

    const weight =
      input.weight instanceof
      EvaluationEvidenceWeight
        ? input.weight
        : EvaluationEvidenceWeight.create(
            input.weight ?? 1,
          );

    const note =
      optionalText(input.note);

    return new EvaluationEvidenceReference({
      evidenceIdValue:
        evidenceId.value,
      role:
        input.role ??
        EvaluationEvidenceRole.SUPPORTING,
      weightValue:
        weight.value,
      ...(note
        ? { note }
        : {}),
    });
  }

  public get evidenceId():
    EvidenceId {
    return createEvidenceId(
      this.props.evidenceIdValue,
    );
  }

  public get role():
    EvaluationEvidenceRole {
    return this.props.role;
  }

  public get weight():
    EvaluationEvidenceWeight {
    return EvaluationEvidenceWeight.create(
      this.props.weightValue,
    );
  }

  public get note():
    | string
    | undefined {
    return this.props.note;
  }

  public references(
    evidenceId: EvidenceId,
  ): boolean {
    return this.evidenceId.equals(
      evidenceId,
    );
  }

  public isConsidered(): boolean {
    return (
      this.role ===
      EvaluationEvidenceRole.CONSIDERED
    );
  }

  public isSupporting(): boolean {
    return (
      this.role ===
      EvaluationEvidenceRole.SUPPORTING
    );
  }

  public isContradicting(): boolean {
    return (
      this.role ===
      EvaluationEvidenceRole.CONTRADICTING
    );
  }

  public isDiscarded(): boolean {
    return (
      this.role ===
      EvaluationEvidenceRole.DISCARDED
    );
  }

  public influencedEvaluation():
    boolean {
    return (
      !this.isDiscarded() &&
      !this.weight.isZero()
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
      "Evaluation evidence reference note cannot be empty.",
    );
  }

  return normalized;
}

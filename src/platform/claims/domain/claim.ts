import {
  EntityWithProps,
} from "../../kernel";

import {
  ObservationSubject,
  type ObservationSubjectInput,
  type ObservationValue,
} from "../../observations";

import {
  type EvidenceId,
} from "../../evidence";

import {
  ClaimEvidenceReference,
  type ClaimEvidenceReferenceInput,
} from "./claim-evidence-reference";

import {
  ClaimEvidenceRole,
} from "./claim-evidence-role";

import {
  createClaimId,
  type ClaimId,
} from "./claim-id";

import {
  ClaimSource,
  type ClaimSourceInput,
} from "./claim-source";

import {
  ClaimStatus,
} from "./claim-status";

import type {
  ClaimType,
} from "./claim-type";

type ClaimProps = Readonly<{
  type: ClaimType;
  subject: ObservationSubject;
  statement: string;
  status: ClaimStatus;
  source: ClaimSource;
  evidenceReferences:
    readonly ClaimEvidenceReference[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

export type ClaimInput = Readonly<{
  id?: ClaimId;
  type: ClaimType;
  subject:
    | ObservationSubject
    | ObservationSubjectInput;
  statement: string;
  status?: ClaimStatus;
  source:
    | ClaimSource
    | ClaimSourceInput;

  /**
   * PF-005.2 canonical Claim-to-Evidence references.
   */
  evidenceReferences?: readonly (
    | ClaimEvidenceReference
    | ClaimEvidenceReferenceInput
  )[];

  /**
   * Compatibility input for simple Claim construction.
   *
   * IDs are normalized to PRIMARY ClaimEvidenceReference values.
   */
  evidenceIds?: readonly EvidenceId[];

  createdAt: Date;
  updatedAt?: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

/**
 * Canonical proposition evaluated by the Luxe Haven reasoning platform.
 *
 * A Claim states what may be true. Evidence references provide traceability,
 * but the Claim does not own evidence interpretation, confidence, evaluation,
 * recommendations, or decisions.
 */
export class Claim extends EntityWithProps<
  ClaimProps,
  ClaimId
> {
  private constructor(
    id: ClaimId,
    props: ClaimProps,
  ) {
    super(id, props);
  }

  public static create(
    input: ClaimInput,
  ): Claim {
    const createdAt =
      copyValidDate(
        input.createdAt,
        "Claim createdAt",
      );

    const updatedAt =
      copyValidDate(
        input.updatedAt ??
          input.createdAt,
        "Claim updatedAt",
      );

    if (
      updatedAt.getTime() <
      createdAt.getTime()
    ) {
      throw new RangeError(
        "Claim updatedAt cannot precede createdAt.",
      );
    }

    return new Claim(
      input.id ??
        createClaimId(),
      {
        type: requireText(
          input.type,
          "Claim type",
        ),
        subject:
          input.subject instanceof
          ObservationSubject
            ? input.subject
            : ObservationSubject.create(
                input.subject,
              ),
        statement: requireText(
          input.statement,
          "Claim statement",
        ),
        status:
          input.status ??
          ClaimStatus.PROPOSED,
        source:
          input.source instanceof
          ClaimSource
            ? input.source
            : ClaimSource.create(
                input.source,
              ),
        evidenceReferences:
          normalizeEvidenceReferences(
            input,
          ),
        createdAt,
        updatedAt,
        ...(input.metadata
          ? {
              metadata: {
                ...input.metadata,
              },
            }
          : {}),
      },
    );
  }

  public get type(): ClaimType {
    return this.props.type;
  }

  public get subject():
    ObservationSubject {
    return this.props.subject;
  }

  public get statement(): string {
    return this.props.statement;
  }

  public get status(): ClaimStatus {
    return this.props.status;
  }

  public get source():
    ClaimSource {
    return this.props.source;
  }

  public get evidenceReferences():
    readonly ClaimEvidenceReference[] {
    return [
      ...this.props.evidenceReferences,
    ];
  }

  public get evidenceIds():
    readonly EvidenceId[] {
    return this.props.evidenceReferences.map(
      (reference) =>
        reference.evidenceId,
    );
  }

  public get createdAt(): Date {
    return new Date(
      this.props.createdAt,
    );
  }

  public get updatedAt(): Date {
    return new Date(
      this.props.updatedAt,
    );
  }

  public get metadata():
    | Readonly<
        Record<
          string,
          ObservationValue
        >
      >
    | undefined {
    return this.props.metadata;
  }

  public isProposed(): boolean {
    return (
      this.status ===
      ClaimStatus.PROPOSED
    );
  }

  public isActive(): boolean {
    return (
      this.status ===
      ClaimStatus.ACTIVE
    );
  }

  public hasEvidence(): boolean {
    return (
      this.props.evidenceReferences
        .length > 0
    );
  }

  public referencesEvidence(
    evidenceId: EvidenceId,
  ): boolean {
    return this.props.evidenceReferences.some(
      (reference) =>
        reference.references(
          evidenceId,
        ),
    );
  }

  public evidenceReferenceFor(
    evidenceId: EvidenceId,
  ):
    | ClaimEvidenceReference
    | undefined {
    return this.props.evidenceReferences.find(
      (reference) =>
        reference.references(
          evidenceId,
        ),
    );
  }

  public concerns(
    subjectType: string,
    subjectId: string,
  ): boolean {
    return (
      this.subject.type ===
        requireText(
          subjectType,
          "Claim subject type",
        ) &&
      this.subject.id ===
        requireText(
          subjectId,
          "Claim subject ID",
        )
    );
  }
}

function normalizeEvidenceReferences(
  input: ClaimInput,
): readonly ClaimEvidenceReference[] {
  const references:
    ClaimEvidenceReference[] = [];

  for (
    const reference of
    input.evidenceReferences ?? []
  ) {
    addEvidenceReference(
      references,
      reference instanceof
        ClaimEvidenceReference
        ? reference
        : ClaimEvidenceReference.create(
            reference,
          ),
    );
  }

  for (
    const evidenceId of
    input.evidenceIds ?? []
  ) {
    addEvidenceReference(
      references,
      ClaimEvidenceReference.create({
        evidenceId,
        role:
          ClaimEvidenceRole.PRIMARY,
      }),
    );
  }

  return references;
}

function addEvidenceReference(
  references:
    ClaimEvidenceReference[],
  candidate:
    ClaimEvidenceReference,
): void {
  const duplicate =
    references.some(
      (reference) =>
        reference.references(
          candidate.evidenceId,
        ),
    );

  if (!duplicate) {
    references.push(candidate);
  }
}

function copyValidDate(
  value: Date,
  field: string,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(
      `${field} must be valid.`,
    );
  }

  return new Date(value);
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

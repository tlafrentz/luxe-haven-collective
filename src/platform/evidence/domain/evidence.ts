import { EntityWithProps } from "../../kernel";

import {
  ObservationSubject,
  type ObservationId,
  type ObservationSubjectInput,
  type ObservationValue,
} from "../../observations";

import {
  createEvidenceId,
  type EvidenceId,
} from "./evidence-id";

import {
  EvidenceDirection,
} from "./evidence-direction";

import {
  EvidenceReference,
  type EvidenceReferenceInput,
} from "./evidence-reference";

import {
  EvidenceReferenceRole,
} from "./evidence-reference-role";

import {
  EvidenceSource,
  type EvidenceSourceInput,
} from "./evidence-source";

import {
  EvidenceStrength,
} from "./evidence-strength";

import type {
  EvidenceType,
} from "./evidence-type";

type EvidenceProps = Readonly<{
  type: EvidenceType;
  subject: ObservationSubject;
  title: string;
  explanation: string;
  direction: EvidenceDirection;
  strength: EvidenceStrength;
  source: EvidenceSource;
  references: readonly EvidenceReference[];
  createdAt: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

export type EvidenceInput = Readonly<{
  id?: EvidenceId;
  type: EvidenceType;
  subject:
    | ObservationSubject
    | ObservationSubjectInput;
  title: string;
  explanation: string;
  direction: EvidenceDirection;
  strength: EvidenceStrength;
  source:
    | EvidenceSource
    | EvidenceSourceInput;

  /**
   * PF-004.3 canonical reference input.
   */
  references?: readonly (
    | EvidenceReference
    | EvidenceReferenceInput
  )[];

  /**
   * PF-004.1 compatibility input. Values are converted to PRIMARY references.
   */
  observationIds?: readonly ObservationId[];

  createdAt: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

/**
 * Canonical platform interpretation of what one or more observations mean in
 * relation to a proposition.
 */
export class Evidence extends EntityWithProps<
  EvidenceProps,
  EvidenceId
> {
  private constructor(
    id: EvidenceId,
    props: EvidenceProps,
  ) {
    super(id, props);
  }

  public static create(
    input: EvidenceInput,
  ): Evidence {
    const references =
      normalizeReferences(input);

    if (references.length === 0) {
      throw new TypeError(
        "Evidence must reference at least one observation.",
      );
    }

    return new Evidence(
      input.id ?? createEvidenceId(),
      {
        type: requireText(
          input.type,
          "Evidence type",
        ),
        subject:
          input.subject instanceof
          ObservationSubject
            ? input.subject
            : ObservationSubject.create(
                input.subject,
              ),
        title: requireText(
          input.title,
          "Evidence title",
        ),
        explanation: requireText(
          input.explanation,
          "Evidence explanation",
        ),
        direction: input.direction,
        strength: input.strength,
        source:
          input.source instanceof
          EvidenceSource
            ? input.source
            : EvidenceSource.create(
                input.source,
              ),
        references,
        createdAt: copyValidDate(
          input.createdAt,
          "Evidence createdAt",
        ),
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

  public get type(): EvidenceType {
    return this.props.type;
  }

  public get subject(): ObservationSubject {
    return this.props.subject;
  }

  public get title(): string {
    return this.props.title;
  }

  public get explanation(): string {
    return this.props.explanation;
  }

  public get direction(): EvidenceDirection {
    return this.props.direction;
  }

  public get strength(): EvidenceStrength {
    return this.props.strength;
  }

  public get source(): EvidenceSource {
    return this.props.source;
  }

  public get evidenceReferences():
    readonly EvidenceReference[] {
    return [...this.props.references];
  }

  public get observationIds():
    readonly ObservationId[] {
    return this.props.references.map(
      (reference) =>
        reference.observationId,
    );
  }

  public get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  public get metadata():
    | Readonly<
        Record<string, ObservationValue>
      >
    | undefined {
    return this.props.metadata;
  }

  public supports(): boolean {
    return (
      this.direction ===
      EvidenceDirection.SUPPORTING
    );
  }

  public opposes(): boolean {
    return (
      this.direction ===
      EvidenceDirection.OPPOSING
    );
  }

  public isNeutral(): boolean {
    return (
      this.direction ===
      EvidenceDirection.NEUTRAL
    );
  }

  public isMixed(): boolean {
    return (
      this.direction ===
      EvidenceDirection.MIXED
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
          "Evidence subject type",
        ) &&
      this.subject.id ===
        requireText(
          subjectId,
          "Evidence subject id",
        )
    );
  }

  public referencesObservation(
    observationId: ObservationId,
  ): boolean {
    return this.props.references.some(
      (reference) =>
        reference.references(
          observationId,
        ),
    );
  }

  /**
   * Backward-compatible alias retained from PF-004.1.
   */
  public references(
    observationId: ObservationId,
  ): boolean {
    return this.referencesObservation(
      observationId,
    );
  }

  public referenceFor(
    observationId: ObservationId,
  ): EvidenceReference | undefined {
    return this.props.references.find(
      (reference) =>
        reference.references(
          observationId,
        ),
    );
  }
}

function normalizeReferences(
  input: EvidenceInput,
): readonly EvidenceReference[] {
  const references: EvidenceReference[] = [];

  for (
    const reference of
    input.references ?? []
  ) {
    addReference(
      references,
      reference instanceof
        EvidenceReference
        ? reference
        : EvidenceReference.create(
            reference,
          ),
    );
  }

  for (
    const observationId of
    input.observationIds ?? []
  ) {
    addReference(
      references,
      EvidenceReference.create({
        observationId,
        role:
          EvidenceReferenceRole.PRIMARY,
      }),
    );
  }

  return references;
}

function addReference(
  references: EvidenceReference[],
  candidate: EvidenceReference,
): void {
  const existingIndex =
    references.findIndex(
      (reference) =>
        reference.references(
          candidate.observationId,
        ),
    );

  if (existingIndex === -1) {
    references.push(candidate);
    return;
  }

  /*
   * Explicit references are processed first and therefore take precedence
   * over legacy observationIds.
   */
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

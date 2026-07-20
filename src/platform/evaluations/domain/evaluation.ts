import {
  EntityWithProps,
  Identifier,
} from "../../kernel";

import {
  type ClaimId,
} from "../../claims";

import {
  type EvidenceId,
} from "../../evidence";

import {
  type ObservationValue,
} from "../../observations";

import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

import {
  EvaluationDisposition,
} from "./evaluation-disposition";

import {
  EvaluationEvidenceReference,
  type EvaluationEvidenceReferenceInput,
} from "./evaluation-evidence-reference";

import {
  EvaluationEvidenceRole,
} from "./evaluation-evidence-role";

import {
  createEvaluationId,
  type EvaluationId,
} from "./evaluation-id";

import {
  EvaluationSource,
  type EvaluationSourceInput,
} from "./evaluation-source";

import {
  type EvaluationType,
} from "./evaluation-type";

type ConfidenceSnapshot = Readonly<{
  score: number;
  level: ConfidenceLevel;
  rationale: readonly string[];
}>;

type EvaluationProps = Readonly<{
  type: EvaluationType;
  claimIdValue: string;
  disposition: EvaluationDisposition;
  summary: string;
  confidence: ConfidenceSnapshot;
  evidenceReferences:
    readonly EvaluationEvidenceReference[];
  source: EvaluationSource;
  evaluatedAt: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

export type EvaluationInput = Readonly<{
  id?: EvaluationId;
  type: EvaluationType;
  claimId: ClaimId;
  disposition: EvaluationDisposition;
  summary: string;
  confidence: ConfidenceAssessment;

  /**
   * PF-006.2 canonical Evidence influence records.
   */
  evidenceReferences?: readonly (
    | EvaluationEvidenceReference
    | EvaluationEvidenceReferenceInput
  )[];

  /**
   * Compatibility input for simple Evaluation construction.
   *
   * IDs normalize to SUPPORTING references with full influence weight.
   */
  evidenceIds?: readonly EvidenceId[];

  source:
    | EvaluationSource
    | EvaluationSourceInput;
  evaluatedAt: Date;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

/**
 * Canonical structured judgment of a Claim.
 *
 * An Evaluation determines how available Evidence relates to a Claim, records
 * the confidence in that judgment, and preserves how each Evidence item
 * influenced the result.
 */
export class Evaluation extends EntityWithProps<
  EvaluationProps,
  EvaluationId
> {
  private constructor(
    id: EvaluationId,
    props: EvaluationProps,
  ) {
    super(id, props);
  }

  public static create(
    input: EvaluationInput,
  ): Evaluation {
    return new Evaluation(
      input.id ??
        createEvaluationId(),
      {
        type: requireText(
          input.type,
          "Evaluation type",
        ),
        claimIdValue:
          input.claimId.value,
        disposition:
          input.disposition,
        summary: requireText(
          input.summary,
          "Evaluation summary",
        ),
        confidence:
          toConfidenceSnapshot(
            input.confidence,
          ),
        evidenceReferences:
          normalizeEvidenceReferences(
            input,
          ),
        source:
          input.source instanceof
          EvaluationSource
            ? input.source
            : EvaluationSource.create(
                input.source,
              ),
        evaluatedAt:
          copyValidDate(
            input.evaluatedAt,
            "Evaluation date",
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

  public get type():
    EvaluationType {
    return this.props.type;
  }

  public get claimId():
    ClaimId {
    return Identifier.create(
      this.props.claimIdValue,
    );
  }

  public get disposition():
    EvaluationDisposition {
    return this.props.disposition;
  }

  public get summary(): string {
    return this.props.summary;
  }

  public get confidence():
    ConfidenceAssessment {
    return ConfidenceAssessment.create({
      score:
        ConfidenceScore.create(
          this.props.confidence.score,
        ),
      level:
        this.props.confidence.level,
      rationale:
        this.props.confidence.rationale,
    });
  }

  public get evidenceReferences():
    readonly EvaluationEvidenceReference[] {
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

  public get source():
    EvaluationSource {
    return this.props.source;
  }

  public get evaluatedAt(): Date {
    return new Date(
      this.props.evaluatedAt,
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

  public evaluates(
    claimId: ClaimId,
  ): boolean {
    return this.claimId.equals(
      claimId,
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
    | EvaluationEvidenceReference
    | undefined {
    return this.props.evidenceReferences.find(
      (reference) =>
        reference.references(
          evidenceId,
        ),
    );
  }

  public supportingEvidence():
    readonly EvaluationEvidenceReference[] {
    return this.referencesWithRole(
      EvaluationEvidenceRole.SUPPORTING,
    );
  }

  public contradictingEvidence():
    readonly EvaluationEvidenceReference[] {
    return this.referencesWithRole(
      EvaluationEvidenceRole.CONTRADICTING,
    );
  }

  public consideredEvidence():
    readonly EvaluationEvidenceReference[] {
    return this.referencesWithRole(
      EvaluationEvidenceRole.CONSIDERED,
    );
  }

  public discardedEvidence():
    readonly EvaluationEvidenceReference[] {
    return this.referencesWithRole(
      EvaluationEvidenceRole.DISCARDED,
    );
  }

  public influentialEvidence():
    readonly EvaluationEvidenceReference[] {
    return this.props.evidenceReferences.filter(
      (reference) =>
        reference.influencedEvaluation(),
    );
  }

  public totalInfluenceWeight():
    number {
    return this.influentialEvidence().reduce(
      (
        total,
        reference,
      ) =>
        total +
        reference.weight.value,
      0,
    );
  }

  public isSupported(): boolean {
    return (
      this.disposition ===
      EvaluationDisposition.SUPPORTED
    );
  }

  public isOpposed(): boolean {
    return (
      this.disposition ===
      EvaluationDisposition.OPPOSED
    );
  }

  public isMixed(): boolean {
    return (
      this.disposition ===
      EvaluationDisposition.MIXED
    );
  }

  public isInsufficient(): boolean {
    return (
      this.disposition ===
      EvaluationDisposition.INSUFFICIENT
    );
  }

  private referencesWithRole(
    role: EvaluationEvidenceRole,
  ):
    readonly EvaluationEvidenceReference[] {
    return this.props.evidenceReferences.filter(
      (reference) =>
        reference.role === role,
    );
  }
}

function normalizeEvidenceReferences(
  input: EvaluationInput,
): readonly EvaluationEvidenceReference[] {
  const references:
    EvaluationEvidenceReference[] = [];

  for (
    const reference of
    input.evidenceReferences ?? []
  ) {
    addEvidenceReference(
      references,
      reference instanceof
        EvaluationEvidenceReference
        ? reference
        : EvaluationEvidenceReference.create(
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
      EvaluationEvidenceReference.create({
        evidenceId,
        role:
          EvaluationEvidenceRole.SUPPORTING,
        weight: 1,
      }),
    );
  }

  return references;
}

function addEvidenceReference(
  references:
    EvaluationEvidenceReference[],
  candidate:
    EvaluationEvidenceReference,
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

function toConfidenceSnapshot(
  confidence: ConfidenceAssessment,
): ConfidenceSnapshot {
  return {
    score:
      confidence.score.value,
    level:
      confidence.level,
    rationale: [
      ...confidence.rationale,
    ],
  };
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

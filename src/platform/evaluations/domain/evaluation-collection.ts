import {
  type ClaimId,
} from "../../claims";

import {
  type EvidenceId,
} from "../../evidence";

import {
  ConfidenceLevel,
} from "../../scoring";

import {
  Evaluation,
} from "./evaluation";

import {
  EvaluationDisposition,
} from "./evaluation-disposition";

import {
  type EvaluationId,
} from "./evaluation-id";

import {
  type EvaluationType,
} from "./evaluation-type";

/**
 * Immutable collection of canonical platform Evaluations.
 *
 * The collection owns identity safety, querying, grouping, chronology, and
 * traceability lookups. It does not evaluate Claims, calculate confidence,
 * assign Evidence influence, or produce Recommendations or Decisions.
 */
export class EvaluationCollection {
  private readonly values:
    readonly Evaluation[];

  private constructor(
    evaluations:
      readonly Evaluation[],
  ) {
    assertUniqueEvaluationIds(
      evaluations,
    );

    this.values = Object.freeze([
      ...evaluations,
    ]);
  }

  public static empty():
    EvaluationCollection {
    return new EvaluationCollection(
      [],
    );
  }

  public static create(
    evaluations:
      readonly Evaluation[],
  ): EvaluationCollection {
    return new EvaluationCollection(
      evaluations,
    );
  }

  public get size(): number {
    return this.values.length;
  }

  public get isEmpty(): boolean {
    return this.size === 0;
  }

  public get isNotEmpty(): boolean {
    return !this.isEmpty;
  }

  public has(
    id: EvaluationId,
  ): boolean {
    return (
      this.get(id) !== undefined
    );
  }

  public get(
    id: EvaluationId,
  ): Evaluation | undefined {
    return this.values.find(
      (evaluation) =>
        evaluation.id.equals(id),
    );
  }

  public require(
    id: EvaluationId,
  ): Evaluation {
    const evaluation =
      this.get(id);

    if (!evaluation) {
      throw new RangeError(
        `Evaluation not found: ${id.value}.`,
      );
    }

    return evaluation;
  }

  public add(
    evaluation: Evaluation,
  ): EvaluationCollection {
    if (
      this.has(evaluation.id)
    ) {
      throw new RangeError(
        `Evaluation already exists: ${evaluation.id.value}.`,
      );
    }

    return new EvaluationCollection([
      ...this.values,
      evaluation,
    ]);
  }

  public addMany(
    evaluations:
      readonly Evaluation[],
  ): EvaluationCollection {
    return new EvaluationCollection([
      ...this.values,
      ...evaluations,
    ]);
  }

  public remove(
    id: EvaluationId,
  ): EvaluationCollection {
    return new EvaluationCollection(
      this.values.filter(
        (evaluation) =>
          !evaluation.id.equals(id),
      ),
    );
  }

  public filter(
    predicate: (
      evaluation: Evaluation,
    ) => boolean,
  ): EvaluationCollection {
    return new EvaluationCollection(
      this.values.filter(
        predicate,
      ),
    );
  }

  public ofType(
    type: EvaluationType,
  ): EvaluationCollection {
    const normalized =
      requireText(
        type,
        "Evaluation type",
      );

    return this.filter(
      (evaluation) =>
        evaluation.type ===
        normalized,
    );
  }

  public ofDisposition(
    disposition:
      EvaluationDisposition,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.disposition ===
        disposition,
    );
  }

  public supported():
    EvaluationCollection {
    return this.ofDisposition(
      EvaluationDisposition.SUPPORTED,
    );
  }

  public opposed():
    EvaluationCollection {
    return this.ofDisposition(
      EvaluationDisposition.OPPOSED,
    );
  }

  public mixed():
    EvaluationCollection {
    return this.ofDisposition(
      EvaluationDisposition.MIXED,
    );
  }

  public insufficient():
    EvaluationCollection {
    return this.ofDisposition(
      EvaluationDisposition.INSUFFICIENT,
    );
  }

  public evaluatingClaim(
    claimId: ClaimId,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.evaluates(
          claimId,
        ),
    );
  }

  public fromCapability(
    capability: string,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.source
          .isFromCapability(
            capability,
          ),
    );
  }

  public fromSource(
    capability: string,
    name: string,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.source.isFrom(
          capability,
          name,
        ),
    );
  }

  public withConfidenceLevel(
    level: ConfidenceLevel,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.confidence
          .level === level,
    );
  }

  public withMinimumConfidence(
    minimumScore: number,
  ): EvaluationCollection {
    const normalized =
      requireScore(
        minimumScore,
      );

    return this.filter(
      (evaluation) =>
        evaluation.confidence
          .score.value >=
        normalized,
    );
  }

  public referencingEvidence(
    evidenceId: EvidenceId,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation.referencesEvidence(
          evidenceId,
        ),
    );
  }

  public withSupportingEvidence(
    evidenceId: EvidenceId,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation
          .supportingEvidence()
          .some(
            (reference) =>
              reference.references(
                evidenceId,
              ),
          ),
    );
  }

  public withContradictingEvidence(
    evidenceId: EvidenceId,
  ): EvaluationCollection {
    return this.filter(
      (evaluation) =>
        evaluation
          .contradictingEvidence()
          .some(
            (reference) =>
              reference.references(
                evidenceId,
              ),
          ),
    );
  }

  public evaluatedBetween(
    start: Date,
    end: Date,
  ): EvaluationCollection {
    const normalizedStart =
      copyValidDate(
        start,
        "Evaluation collection start date",
      );

    const normalizedEnd =
      copyValidDate(
        end,
        "Evaluation collection end date",
      );

    if (
      normalizedEnd.getTime() <
      normalizedStart.getTime()
    ) {
      throw new RangeError(
        "Evaluation collection end date cannot precede start date.",
      );
    }

    return this.filter(
      (evaluation) => {
        const evaluatedAt =
          evaluation.evaluatedAt
            .getTime();

        return (
          evaluatedAt >=
            normalizedStart.getTime() &&
          evaluatedAt <=
            normalizedEnd.getTime()
        );
      },
    );
  }

  public newestFirst():
    EvaluationCollection {
    return new EvaluationCollection(
      [...this.values].sort(
        compareNewestFirst,
      ),
    );
  }

  public oldestFirst():
    EvaluationCollection {
    return new EvaluationCollection(
      [...this.values].sort(
        compareOldestFirst,
      ),
    );
  }

  public highestConfidenceFirst():
    EvaluationCollection {
    return new EvaluationCollection(
      [...this.values].sort(
        compareHighestConfidenceFirst,
      ),
    );
  }

  public lowestConfidenceFirst():
    EvaluationCollection {
    return new EvaluationCollection(
      [...this.values].sort(
        compareLowestConfidenceFirst,
      ),
    );
  }

  public latest():
    Evaluation | undefined {
    return this
      .newestFirst()
      .values[0];
  }

  public highestConfidence():
    Evaluation | undefined {
    return this
      .highestConfidenceFirst()
      .values[0];
  }

  public groupByType():
    ReadonlyMap<
      EvaluationType,
      EvaluationCollection
    > {
    return groupEvaluations(
      this.values,
      (evaluation) =>
        evaluation.type,
    );
  }

  public groupByDisposition():
    ReadonlyMap<
      EvaluationDisposition,
      EvaluationCollection
    > {
    return groupEvaluations(
      this.values,
      (evaluation) =>
        evaluation.disposition,
    );
  }

  public groupByClaim():
    ReadonlyMap<
      string,
      EvaluationCollection
    > {
    return groupEvaluations(
      this.values,
      (evaluation) =>
        evaluation.claimId.value,
    );
  }

  public groupByCapability():
    ReadonlyMap<
      string,
      EvaluationCollection
    > {
    return groupEvaluations(
      this.values,
      (evaluation) =>
        evaluation.source.capability,
    );
  }

  public groupByConfidenceLevel():
    ReadonlyMap<
      ConfidenceLevel,
      EvaluationCollection
    > {
    return groupEvaluations(
      this.values,
      (evaluation) =>
        evaluation.confidence.level,
    );
  }

  public toArray():
    readonly Evaluation[] {
    return [
      ...this.values,
    ];
  }
}

function assertUniqueEvaluationIds(
  evaluations:
    readonly Evaluation[],
): void {
  const ids =
    evaluations.map(
      (evaluation) =>
        evaluation.id.value,
    );

  if (
    new Set(ids).size !== ids.length
  ) {
    throw new RangeError(
      "Evaluation IDs must be unique.",
    );
  }
}

function compareNewestFirst(
  first: Evaluation,
  second: Evaluation,
): number {
  const dateDifference =
    second.evaluatedAt.getTime() -
    first.evaluatedAt.getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function compareOldestFirst(
  first: Evaluation,
  second: Evaluation,
): number {
  const dateDifference =
    first.evaluatedAt.getTime() -
    second.evaluatedAt.getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function compareHighestConfidenceFirst(
  first: Evaluation,
  second: Evaluation,
): number {
  const scoreDifference =
    second.confidence.score.value -
    first.confidence.score.value;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return compareNewestFirst(
    first,
    second,
  );
}

function compareLowestConfidenceFirst(
  first: Evaluation,
  second: Evaluation,
): number {
  const scoreDifference =
    first.confidence.score.value -
    second.confidence.score.value;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return compareNewestFirst(
    first,
    second,
  );
}

function groupEvaluations<TKey>(
  evaluations:
    readonly Evaluation[],
  keySelector: (
    evaluation: Evaluation,
  ) => TKey,
): ReadonlyMap<
  TKey,
  EvaluationCollection
> {
  const groups =
    new Map<
      TKey,
      Evaluation[]
    >();

  for (
    const evaluation of
    evaluations
  ) {
    const key =
      keySelector(evaluation);

    const group =
      groups.get(key) ?? [];

    group.push(evaluation);
    groups.set(key, group);
  }

  return new Map(
    [...groups.entries()].map(
      ([key, values]) => [
        key,
        EvaluationCollection.create(
          values,
        ),
      ] as const,
    ),
  );
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

function requireScore(
  value: number,
): number {
  if (
    !Number.isFinite(value)
  ) {
    throw new TypeError(
      "Minimum confidence score must be finite.",
    );
  }

  if (
    value < 0 ||
    value > 100
  ) {
    throw new RangeError(
      "Minimum confidence score must be between 0 and 100.",
    );
  }

  return value;
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (
    normalized.length === 0
  ) {
    throw new TypeError(
      `${field} cannot be empty.`,
    );
  }

  return normalized;
}

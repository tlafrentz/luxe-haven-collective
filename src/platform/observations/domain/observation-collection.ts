import type {
  Observation,
} from "./observation";
import type {
  ObservationId,
} from "./observation-id";
import type {
  ObservationType,
} from "./observation-type";
import type {
  ObservationValue,
} from "./observation-value";

export type AnyObservation =
  Observation<ObservationValue>;

export type ObservationCollectionInput<
  TObservation extends AnyObservation =
    AnyObservation,
> = readonly TObservation[];

/**
 * Immutable collection boundary for canonical platform observations.
 *
 * The collection owns identity safety, deterministic querying, chronology,
 * and grouping. It does not score, interpret, or resolve contradictory facts.
 */
export class ObservationCollection<
  TObservation extends AnyObservation =
    AnyObservation,
> implements Iterable<TObservation> {
  private readonly observations:
    readonly TObservation[];

  private constructor(
    observations: readonly TObservation[],
  ) {
    assertUniqueObservationIds(observations);
    this.observations = Object.freeze([
      ...observations,
    ]);
  }

  public static empty<
    TObservation extends AnyObservation =
      AnyObservation,
  >(): ObservationCollection<TObservation> {
    return new ObservationCollection<TObservation>(
      [],
    );
  }

  public static create<
    TObservation extends AnyObservation =
      AnyObservation,
  >(
    observations:
      ObservationCollectionInput<TObservation>,
  ): ObservationCollection<TObservation> {
    return new ObservationCollection(
      observations,
    );
  }

  public get size(): number {
    return this.observations.length;
  }

  public get isEmpty(): boolean {
    return this.size === 0;
  }

  public get isNotEmpty(): boolean {
    return !this.isEmpty;
  }

  public toArray(): readonly TObservation[] {
    return [...this.observations];
  }

  public [Symbol.iterator]():
    Iterator<TObservation> {
    return this.observations[Symbol.iterator]();
  }

  public has(
    id: ObservationId,
  ): boolean {
    return this.observations.some(
      (observation) =>
        observation.id.equals(id),
    );
  }

  public get(
    id: ObservationId,
  ): TObservation | undefined {
    return this.observations.find(
      (observation) =>
        observation.id.equals(id),
    );
  }

  public require(
    id: ObservationId,
  ): TObservation {
    const observation = this.get(id);

    if (!observation) {
      throw new Error(
        "Observation collection does not contain the requested observation.",
      );
    }

    return observation;
  }

  public add(
    observation: TObservation,
  ): ObservationCollection<TObservation> {
    if (this.has(observation.id)) {
      throw new Error(
        "Observation collection cannot contain duplicate observation ids.",
      );
    }

    return new ObservationCollection([
      ...this.observations,
      observation,
    ]);
  }

  public addMany(
    observations: readonly TObservation[],
  ): ObservationCollection<TObservation> {
    return new ObservationCollection([
      ...this.observations,
      ...observations,
    ]);
  }

  public remove(
    id: ObservationId,
  ): ObservationCollection<TObservation> {
    return new ObservationCollection(
      this.observations.filter(
        (observation) =>
          !observation.id.equals(id),
      ),
    );
  }

  public filter(
    predicate: (
      observation: TObservation,
      index: number,
    ) => boolean,
  ): ObservationCollection<TObservation> {
    return new ObservationCollection(
      this.observations.filter(predicate),
    );
  }

  public ofType(
    type: ObservationType,
  ): ObservationCollection<TObservation> {
    return this.filter(
      (observation) =>
        observation.isType(type),
    );
  }

  public concerning(
    subjectType: string,
    subjectId: string,
  ): ObservationCollection<TObservation> {
    const normalizedType = requireText(
      subjectType,
      "Observation subject type",
    );
    const normalizedId = requireText(
      subjectId,
      "Observation subject id",
    );

    return this.filter(
      (observation) =>
        observation.concerns(
          normalizedType,
          normalizedId,
        ),
    );
  }

  public withProvenance():
    ObservationCollection<TObservation> {
    return this.filter(
      (observation) =>
        observation.hasProvenance,
    );
  }

  public derived():
    ObservationCollection<TObservation> {
    return this.filter(
      (observation) =>
        observation.isDerived,
    );
  }

  public retrievedBetween(
    start: Date,
    end: Date,
  ): ObservationCollection<TObservation> {
    const validStart = copyValidDate(
      start,
      "Observation retrieval range start",
    );
    const validEnd = copyValidDate(
      end,
      "Observation retrieval range end",
    );

    if (
      validStart.getTime() >
      validEnd.getTime()
    ) {
      throw new RangeError(
        "Observation retrieval range start cannot be after range end.",
      );
    }

    return this.filter(
      (observation) => {
        const retrievedAt =
          observation.provenance
            ?.retrievedAt
            .getTime();

        return (
          retrievedAt !== undefined &&
          retrievedAt >= validStart.getTime() &&
          retrievedAt <= validEnd.getTime()
        );
      },
    );
  }

  public fromSource(
    sourceType: string,
    sourceName?: string,
  ): ObservationCollection<TObservation> {
    const normalizedType = requireText(
      sourceType,
      "Observation source type",
    );
    const normalizedName =
      sourceName === undefined
        ? undefined
        : requireText(
            sourceName,
            "Observation source name",
          );

    return this.filter(
      (observation) =>
        observation.source.type ===
          normalizedType &&
        (
          normalizedName === undefined ||
          observation.source.name ===
            normalizedName
        ),
    );
  }

  public observedBetween(
    start: Date,
    end: Date,
  ): ObservationCollection<TObservation> {
    const validStart = copyValidDate(
      start,
      "Observation range start",
    );
    const validEnd = copyValidDate(
      end,
      "Observation range end",
    );

    if (
      validStart.getTime() >
      validEnd.getTime()
    ) {
      throw new RangeError(
        "Observation range start cannot be after range end.",
      );
    }

    return this.filter(
      (observation) => {
        const observedAt =
          observation.observedAt.getTime();

        return (
          observedAt >= validStart.getTime() &&
          observedAt <= validEnd.getTime()
        );
      },
    );
  }

  public recordedBetween(
    start: Date,
    end: Date,
  ): ObservationCollection<TObservation> {
    const validStart = copyValidDate(
      start,
      "Recording range start",
    );
    const validEnd = copyValidDate(
      end,
      "Recording range end",
    );

    if (
      validStart.getTime() >
      validEnd.getTime()
    ) {
      throw new RangeError(
        "Recording range start cannot be after range end.",
      );
    }

    return this.filter(
      (observation) => {
        const recordedAt =
          observation.recordedAt.getTime();

        return (
          recordedAt >= validStart.getTime() &&
          recordedAt <= validEnd.getTime()
        );
      },
    );
  }

  public newestObservedFirst():
    ObservationCollection<TObservation> {
    return new ObservationCollection(
      [...this.observations].sort(
        compareObservedAtDescending,
      ),
    );
  }

  public oldestObservedFirst():
    ObservationCollection<TObservation> {
    return new ObservationCollection(
      [...this.observations].sort(
        compareObservedAtAscending,
      ),
    );
  }

  public latestObserved():
    TObservation | undefined {
    return this.newestObservedFirst()
      .observations[0];
  }

  public earliestObserved():
    TObservation | undefined {
    return this.oldestObservedFirst()
      .observations[0];
  }

  public latestOfType(
    type: ObservationType,
  ): TObservation | undefined {
    return this.ofType(type)
      .latestObserved();
  }

  public groupByType():
    ReadonlyMap<
      ObservationType,
      ObservationCollection<TObservation>
    > {
    return groupObservations(
      this.observations,
      (observation) =>
        observation.type,
    );
  }

  public groupBySubject():
    ReadonlyMap<
      string,
      ObservationCollection<TObservation>
    > {
    return groupObservations(
      this.observations,
      (observation) =>
        createSubjectKey(
          observation.subject.type,
          observation.subject.id,
        ),
    );
  }

  public groupBySource():
    ReadonlyMap<
      string,
      ObservationCollection<TObservation>
    > {
    return groupObservations(
      this.observations,
      (observation) =>
        createSourceKey(
          observation.source.type,
          observation.source.name,
        ),
    );
  }
}

export function createSubjectKey(
  type: string,
  id: string,
): string {
  return `${encodeURIComponent(type)}:${encodeURIComponent(id)}`;
}

export function createSourceKey(
  type: string,
  name: string,
): string {
  return `${encodeURIComponent(type)}:${encodeURIComponent(name)}`;
}

function groupObservations<
  TObservation extends AnyObservation,
>(
  observations: readonly TObservation[],
  selectKey: (
    observation: TObservation,
  ) => string,
): ReadonlyMap<
  string,
  ObservationCollection<TObservation>
> {
  const groups =
    new Map<string, TObservation[]>();

  for (const observation of observations) {
    const key = selectKey(observation);
    const group = groups.get(key) ?? [];

    group.push(observation);
    groups.set(key, group);
  }

  return new Map(
    [...groups.entries()].map(
      ([key, group]) => [
        key,
        ObservationCollection.create(group),
      ],
    ),
  );
}

function assertUniqueObservationIds<
  TObservation extends AnyObservation,
>(
  observations: readonly TObservation[],
): void {
  for (
    let currentIndex = 0;
    currentIndex < observations.length;
    currentIndex += 1
  ) {
    for (
      let comparisonIndex =
        currentIndex + 1;
      comparisonIndex <
        observations.length;
      comparisonIndex += 1
    ) {
      if (
        observations[currentIndex].id.equals(
          observations[comparisonIndex].id,
        )
      ) {
        throw new Error(
          "Observation collection cannot contain duplicate observation ids.",
        );
      }
    }
  }
}

function compareObservedAtAscending<
  TObservation extends AnyObservation,
>(
  left: TObservation,
  right: TObservation,
): number {
  return (
    left.observedAt.getTime() -
    right.observedAt.getTime()
  );
}

function compareObservedAtDescending<
  TObservation extends AnyObservation,
>(
  left: TObservation,
  right: TObservation,
): number {
  return compareObservedAtAscending(
    right,
    left,
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

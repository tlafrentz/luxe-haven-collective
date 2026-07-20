import type {
  ObservationId,
} from "../../observations";

import type {
  Evidence,
} from "./evidence";

import {
  EvidenceDirection,
} from "./evidence-direction";

import type {
  EvidenceId,
} from "./evidence-id";

import {
  EvidenceStrength,
} from "./evidence-strength";

import type {
  EvidenceType,
} from "./evidence-type";

export type EvidenceCollectionInput =
  readonly Evidence[];

/**
 * Immutable collection boundary for canonical platform evidence.
 *
 * The collection owns identity safety, deterministic querying, chronology,
 * and grouping. It does not derive, score, rank, or interpret evidence.
 */
export class EvidenceCollection
  implements Iterable<Evidence> {
  private readonly evidenceItems:
    readonly Evidence[];

  private constructor(
    evidenceItems: readonly Evidence[],
  ) {
    assertUniqueEvidenceIds(
      evidenceItems,
    );

    this.evidenceItems =
      Object.freeze([
        ...evidenceItems,
      ]);
  }

  public static empty():
    EvidenceCollection {
    return new EvidenceCollection([]);
  }

  public static create(
    evidenceItems:
      EvidenceCollectionInput,
  ): EvidenceCollection {
    return new EvidenceCollection(
      evidenceItems,
    );
  }

  public get size(): number {
    return this.evidenceItems.length;
  }

  public get isEmpty(): boolean {
    return this.size === 0;
  }

  public get isNotEmpty(): boolean {
    return !this.isEmpty;
  }

  public toArray():
    readonly Evidence[] {
    return [...this.evidenceItems];
  }

  public [Symbol.iterator]():
    Iterator<Evidence> {
    return this.evidenceItems[
      Symbol.iterator
    ]();
  }

  public has(
    id: EvidenceId,
  ): boolean {
    return this.evidenceItems.some(
      (evidence) =>
        evidence.id.equals(id),
    );
  }

  public get(
    id: EvidenceId,
  ): Evidence | undefined {
    return this.evidenceItems.find(
      (evidence) =>
        evidence.id.equals(id),
    );
  }

  public require(
    id: EvidenceId,
  ): Evidence {
    const evidence = this.get(id);

    if (!evidence) {
      throw new Error(
        "Evidence collection does not contain the requested evidence.",
      );
    }

    return evidence;
  }

  public add(
    evidence: Evidence,
  ): EvidenceCollection {
    if (this.has(evidence.id)) {
      throw new Error(
        "Evidence collection cannot contain duplicate evidence ids.",
      );
    }

    return new EvidenceCollection([
      ...this.evidenceItems,
      evidence,
    ]);
  }

  public addMany(
    evidenceItems:
      readonly Evidence[],
  ): EvidenceCollection {
    return new EvidenceCollection([
      ...this.evidenceItems,
      ...evidenceItems,
    ]);
  }

  public remove(
    id: EvidenceId,
  ): EvidenceCollection {
    return new EvidenceCollection(
      this.evidenceItems.filter(
        (evidence) =>
          !evidence.id.equals(id),
      ),
    );
  }

  public filter(
    predicate: (
      evidence: Evidence,
      index: number,
    ) => boolean,
  ): EvidenceCollection {
    return new EvidenceCollection(
      this.evidenceItems.filter(
        predicate,
      ),
    );
  }

  public ofType(
    type: EvidenceType,
  ): EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.type === type,
    );
  }

  public supporting():
    EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.supports(),
    );
  }

  public opposing():
    EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.opposes(),
    );
  }

  public neutral():
    EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.isNeutral(),
    );
  }

  public mixed():
    EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.isMixed(),
    );
  }

  public ofDirection(
    direction: EvidenceDirection,
  ): EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.direction ===
        direction,
    );
  }

  public ofStrength(
    strength: EvidenceStrength,
  ): EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.strength ===
        strength,
    );
  }

  public concerning(
    subjectType: string,
    subjectId: string,
  ): EvidenceCollection {
    const normalizedType =
      requireText(
        subjectType,
        "Evidence subject type",
      );
    const normalizedId =
      requireText(
        subjectId,
        "Evidence subject id",
      );

    return this.filter(
      (evidence) =>
        evidence.concerns(
          normalizedType,
          normalizedId,
        ),
    );
  }

  public fromCapability(
    capability: string,
  ): EvidenceCollection {
    const normalized =
      requireText(
        capability,
        "Evidence capability",
      );

    return this.filter(
      (evidence) =>
        evidence.source.capability ===
        normalized,
    );
  }

  public fromSource(
    capability: string,
    name?: string,
  ): EvidenceCollection {
    const normalizedCapability =
      requireText(
        capability,
        "Evidence source capability",
      );

    const normalizedName =
      name === undefined
        ? undefined
        : requireText(
            name,
            "Evidence source name",
          );

    return this.filter(
      (evidence) =>
        evidence.source.capability ===
          normalizedCapability &&
        (
          normalizedName ===
            undefined ||
          evidence.source.name ===
            normalizedName
        ),
    );
  }

  public forObservation(
    observationId: ObservationId,
  ): EvidenceCollection {
    return this.filter(
      (evidence) =>
        evidence.referencesObservation(
          observationId,
        ),
    );
  }

  /**
   * Alias retained for the PF-004.2 collection contract.
   */
  public references(
    observationId: ObservationId,
  ): EvidenceCollection {
    return this.forObservation(
      observationId,
    );
  }

  public createdBetween(
    start: Date,
    end: Date,
  ): EvidenceCollection {
    const validStart =
      copyValidDate(
        start,
        "Evidence range start",
      );
    const validEnd =
      copyValidDate(
        end,
        "Evidence range end",
      );

    if (
      validStart.getTime() >
      validEnd.getTime()
    ) {
      throw new RangeError(
        "Evidence range start cannot be after range end.",
      );
    }

    return this.filter(
      (evidence) => {
        const createdAt =
          evidence.createdAt.getTime();

        return (
          createdAt >=
            validStart.getTime() &&
          createdAt <=
            validEnd.getTime()
        );
      },
    );
  }

  public newestFirst():
    EvidenceCollection {
    return new EvidenceCollection(
      [...this.evidenceItems].sort(
        compareCreatedAtDescending,
      ),
    );
  }

  public oldestFirst():
    EvidenceCollection {
    return new EvidenceCollection(
      [...this.evidenceItems].sort(
        compareCreatedAtAscending,
      ),
    );
  }

  public latest():
    Evidence | undefined {
    return this.newestFirst()
      .evidenceItems[0];
  }

  public groupByType():
    ReadonlyMap<
      EvidenceType,
      EvidenceCollection
    > {
    return groupEvidence(
      this.evidenceItems,
      (evidence) =>
        evidence.type,
    );
  }

  public groupBySubject():
    ReadonlyMap<
      string,
      EvidenceCollection
    > {
    return groupEvidence(
      this.evidenceItems,
      (evidence) =>
        createEvidenceSubjectKey(
          evidence.subject.type,
          evidence.subject.id,
        ),
    );
  }

  public groupByDirection():
    ReadonlyMap<
      EvidenceDirection,
      EvidenceCollection
    > {
    return groupEvidence(
      this.evidenceItems,
      (evidence) =>
        evidence.direction,
    );
  }

  public groupByStrength():
    ReadonlyMap<
      EvidenceStrength,
      EvidenceCollection
    > {
    return groupEvidence(
      this.evidenceItems,
      (evidence) =>
        evidence.strength,
    );
  }

  public groupByCapability():
    ReadonlyMap<
      string,
      EvidenceCollection
    > {
    return groupEvidence(
      this.evidenceItems,
      (evidence) =>
        evidence.source.capability,
    );
  }
}

export function createEvidenceSubjectKey(
  subjectType: string,
  subjectId: string,
): string {
  return [
    requireText(
      subjectType,
      "Evidence subject type",
    ),
    requireText(
      subjectId,
      "Evidence subject id",
    ),
  ].join(":");
}

function assertUniqueEvidenceIds(
  evidenceItems:
    readonly Evidence[],
): void {
  const ids = new Set<string>();

  for (const evidence of evidenceItems) {
    const id = evidence.id.value;

    if (ids.has(id)) {
      throw new Error(
        "Evidence collection cannot contain duplicate evidence ids.",
      );
    }

    ids.add(id);
  }
}

function groupEvidence<TKey>(
  evidenceItems:
    readonly Evidence[],
  selectKey: (
    evidence: Evidence,
  ) => TKey,
): ReadonlyMap<
  TKey,
  EvidenceCollection
> {
  const groups =
    new Map<TKey, Evidence[]>();

  for (const evidence of evidenceItems) {
    const key =
      selectKey(evidence);
    const group =
      groups.get(key) ?? [];

    group.push(evidence);
    groups.set(key, group);
  }

  return new Map(
    [...groups.entries()].map(
      ([key, group]) => [
        key,
        EvidenceCollection.create(
          group,
        ),
      ],
    ),
  );
}

function compareCreatedAtAscending(
  left: Evidence,
  right: Evidence,
): number {
  const difference =
    left.createdAt.getTime() -
    right.createdAt.getTime();

  if (difference !== 0) {
    return difference;
  }

  return left.id.value.localeCompare(
    right.id.value,
  );
}

function compareCreatedAtDescending(
  left: Evidence,
  right: Evidence,
): number {
  return compareCreatedAtAscending(
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

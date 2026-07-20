import {
  type EvidenceId,
} from "../../evidence";

import {
  Claim,
} from "./claim";

import {
  type ClaimId,
} from "./claim-id";

import {
  ClaimStatus,
} from "./claim-status";

import {
  type ClaimType,
} from "./claim-type";

/**
 * Immutable collection of canonical platform Claims.
 *
 * The collection owns identity safety, querying, grouping, and chronology.
 * It does not formulate Claims, evaluate them, score them, or produce
 * recommendations or decisions.
 */
export class ClaimCollection {
  private readonly values:
    readonly Claim[];

  private constructor(
    claims: readonly Claim[],
  ) {
    assertUniqueClaimIds(claims);

    this.values = Object.freeze([
      ...claims,
    ]);
  }

  public static empty():
    ClaimCollection {
    return new ClaimCollection([]);
  }

  public static create(
    claims: readonly Claim[],
  ): ClaimCollection {
    return new ClaimCollection(
      claims,
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
    id: ClaimId,
  ): boolean {
    return (
      this.get(id) !== undefined
    );
  }

  public get(
    id: ClaimId,
  ): Claim | undefined {
    return this.values.find(
      (claim) =>
        claim.id.equals(id),
    );
  }

  public require(
    id: ClaimId,
  ): Claim {
    const claim = this.get(id);

    if (!claim) {
      throw new RangeError(
        `Claim not found: ${id.value}.`,
      );
    }

    return claim;
  }

  public add(
    claim: Claim,
  ): ClaimCollection {
    if (this.has(claim.id)) {
      throw new RangeError(
        `Claim already exists: ${claim.id.value}.`,
      );
    }

    return new ClaimCollection([
      ...this.values,
      claim,
    ]);
  }

  public addMany(
    claims: readonly Claim[],
  ): ClaimCollection {
    return new ClaimCollection([
      ...this.values,
      ...claims,
    ]);
  }

  public remove(
    id: ClaimId,
  ): ClaimCollection {
    return new ClaimCollection(
      this.values.filter(
        (claim) =>
          !claim.id.equals(id),
      ),
    );
  }

  public filter(
    predicate: (
      claim: Claim,
    ) => boolean,
  ): ClaimCollection {
    return new ClaimCollection(
      this.values.filter(
        predicate,
      ),
    );
  }

  public ofType(
    type: ClaimType,
  ): ClaimCollection {
    const normalized =
      requireText(
        type,
        "Claim type",
      );

    return this.filter(
      (claim) =>
        claim.type === normalized,
    );
  }

  public ofStatus(
    status: ClaimStatus,
  ): ClaimCollection {
    return this.filter(
      (claim) =>
        claim.status === status,
    );
  }

  public proposed():
    ClaimCollection {
    return this.ofStatus(
      ClaimStatus.PROPOSED,
    );
  }

  public active():
    ClaimCollection {
    return this.ofStatus(
      ClaimStatus.ACTIVE,
    );
  }

  public concerning(
    subjectType: string,
    subjectId: string,
  ): ClaimCollection {
    return this.filter(
      (claim) =>
        claim.concerns(
          subjectType,
          subjectId,
        ),
    );
  }

  public fromCapability(
    capability: string,
  ): ClaimCollection {
    return this.filter(
      (claim) =>
        claim.source.isFromCapability(
          capability,
        ),
    );
  }

  public fromSource(
    capability: string,
    name: string,
  ): ClaimCollection {
    return this.filter(
      (claim) =>
        claim.source.isFrom(
          capability,
          name,
        ),
    );
  }

  public referencingEvidence(
    evidenceId: EvidenceId,
  ): ClaimCollection {
    return this.filter(
      (claim) =>
        claim.referencesEvidence(
          evidenceId,
        ),
    );
  }

  public createdBetween(
    start: Date,
    end: Date,
  ): ClaimCollection {
    const normalizedStart =
      copyValidDate(
        start,
        "Claim collection start date",
      );

    const normalizedEnd =
      copyValidDate(
        end,
        "Claim collection end date",
      );

    if (
      normalizedEnd.getTime() <
      normalizedStart.getTime()
    ) {
      throw new RangeError(
        "Claim collection end date cannot precede start date.",
      );
    }

    return this.filter(
      (claim) => {
        const createdAt =
          claim.createdAt.getTime();

        return (
          createdAt >=
            normalizedStart.getTime() &&
          createdAt <=
            normalizedEnd.getTime()
        );
      },
    );
  }

  public updatedBetween(
    start: Date,
    end: Date,
  ): ClaimCollection {
    const normalizedStart =
      copyValidDate(
        start,
        "Claim collection start date",
      );

    const normalizedEnd =
      copyValidDate(
        end,
        "Claim collection end date",
      );

    if (
      normalizedEnd.getTime() <
      normalizedStart.getTime()
    ) {
      throw new RangeError(
        "Claim collection end date cannot precede start date.",
      );
    }

    return this.filter(
      (claim) => {
        const updatedAt =
          claim.updatedAt.getTime();

        return (
          updatedAt >=
            normalizedStart.getTime() &&
          updatedAt <=
            normalizedEnd.getTime()
        );
      },
    );
  }

  public newestFirst():
    ClaimCollection {
    return new ClaimCollection(
      [...this.values].sort(
        compareNewestFirst,
      ),
    );
  }

  public oldestFirst():
    ClaimCollection {
    return new ClaimCollection(
      [...this.values].sort(
        compareOldestFirst,
      ),
    );
  }

  public latest():
    Claim | undefined {
    return this
      .newestFirst()
      .values[0];
  }

  public groupByType():
    ReadonlyMap<
      ClaimType,
      ClaimCollection
    > {
    return groupClaims(
      this.values,
      (claim) => claim.type,
    );
  }

  public groupBySubject():
    ReadonlyMap<
      string,
      ClaimCollection
    > {
    return groupClaims(
      this.values,
      (claim) =>
        subjectKey(claim),
    );
  }

  public groupByStatus():
    ReadonlyMap<
      ClaimStatus,
      ClaimCollection
    > {
    return groupClaims(
      this.values,
      (claim) =>
        claim.status,
    );
  }

  public groupByCapability():
    ReadonlyMap<
      string,
      ClaimCollection
    > {
    return groupClaims(
      this.values,
      (claim) =>
        claim.source.capability,
    );
  }

  public toArray():
    readonly Claim[] {
    return [
      ...this.values,
    ];
  }
}

function assertUniqueClaimIds(
  claims: readonly Claim[],
): void {
  const ids = claims.map(
    (claim) => claim.id.value,
  );

  if (
    new Set(ids).size !== ids.length
  ) {
    throw new RangeError(
      "Claim IDs must be unique.",
    );
  }
}

function compareNewestFirst(
  first: Claim,
  second: Claim,
): number {
  const dateDifference =
    second.createdAt.getTime() -
    first.createdAt.getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function compareOldestFirst(
  first: Claim,
  second: Claim,
): number {
  const dateDifference =
    first.createdAt.getTime() -
    second.createdAt.getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function subjectKey(
  claim: Claim,
): string {
  return [
    claim.subject.type,
    claim.subject.id,
  ].join(":");
}

function groupClaims<TKey>(
  claims: readonly Claim[],
  keySelector: (
    claim: Claim,
  ) => TKey,
): ReadonlyMap<
  TKey,
  ClaimCollection
> {
  const groups =
    new Map<TKey, Claim[]>();

  for (const claim of claims) {
    const key =
      keySelector(claim);

    const group =
      groups.get(key) ?? [];

    group.push(claim);
    groups.set(key, group);
  }

  return new Map(
    [...groups.entries()].map(
      ([key, values]) => [
        key,
        ClaimCollection.create(
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

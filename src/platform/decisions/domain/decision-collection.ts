import type { ClaimId } from "../../claims";
import type { EvaluationId } from "../../evaluations";
import type { EvidenceId } from "../../evidence";
import type { Identifier } from "../../kernel";
import type { ObservationId } from "../../observations";
import type { RecommendationId } from "../../recommendations";
import {
  RECOMMENDATION_PRIORITY_RANK,
  RecommendationPriority,
} from "../../recommendations";
import { Decision } from "./decision";
import { DecisionMode } from "./decision-mode";
import type { DecisionOutcome } from "./decision-outcome";

export class DecisionCollection implements Iterable<Decision<DecisionOutcome>> {
  private readonly values: readonly Decision<DecisionOutcome>[];

  private constructor(values: readonly Decision<DecisionOutcome>[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Decision IDs must be unique.");
    this.values = Object.freeze([...values]);
  }

  public static empty(): DecisionCollection { return new DecisionCollection([]); }
  public static create(values: readonly Decision<DecisionOutcome>[]): DecisionCollection {
    return new DecisionCollection(values);
  }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get isNotEmpty(): boolean { return !this.isEmpty; }
  public get(id: Identifier): Decision<DecisionOutcome> | undefined {
    return this.values.find((value) => value.id.equals(id));
  }
  public require(id: Identifier): Decision<DecisionOutcome> {
    const value = this.get(id);
    if (!value) throw new RangeError(`Decision not found: ${id.value}.`);
    return value;
  }
  public add(value: Decision<DecisionOutcome>): DecisionCollection {
    return DecisionCollection.create([...this.values, value]);
  }
  public filter(predicate: (value: Decision<DecisionOutcome>) => boolean): DecisionCollection {
    return DecisionCollection.create(this.values.filter(predicate));
  }
  public ofMode(mode: DecisionMode): DecisionCollection {
    return this.filter((value) => value.mode === mode);
  }
  public ofPriority(priority: RecommendationPriority): DecisionCollection {
    return this.filter((value) => value.priority === priority);
  }
  public selectingRecommendation(id: RecommendationId): DecisionCollection {
    return this.filter((value) => value.recommendationIds.some((entry) => entry.equals(id)));
  }
  public tracingEvaluation(id: EvaluationId): DecisionCollection {
    return this.filter((value) => value.evaluationIds.some((entry) => entry.equals(id)));
  }
  public tracingClaim(id: ClaimId): DecisionCollection {
    return this.filter((value) => value.claimIds.some((entry) => entry.equals(id)));
  }
  public tracingEvidence(id: EvidenceId): DecisionCollection {
    return this.filter((value) => value.evidenceIds.some((entry) => entry.equals(id)));
  }
  public tracingObservation(id: ObservationId): DecisionCollection {
    return this.filter((value) => value.observationIds.some((entry) => entry.equals(id)));
  }
  public priorityFirst(): DecisionCollection {
    return DecisionCollection.create([...this.values].sort((a, b) =>
      RECOMMENDATION_PRIORITY_RANK[b.priority] - RECOMMENDATION_PRIORITY_RANK[a.priority] ||
      b.decidedAt.getTime() - a.decidedAt.getTime(),
    ));
  }
  public newestFirst(): DecisionCollection {
    return DecisionCollection.create([...this.values].sort((a, b) =>
      b.decidedAt.getTime() - a.decidedAt.getTime(),
    ));
  }
  public groupByMode(): ReadonlyMap<DecisionMode, DecisionCollection> {
    return group(this.values, (value) => value.mode);
  }
  public groupByPriority(): ReadonlyMap<RecommendationPriority, DecisionCollection> {
    return group(this.values, (value) => value.priority);
  }
  public countByMode(): ReadonlyMap<DecisionMode, number> {
    return new Map([...this.groupByMode()].map(([mode, values]) => [mode, values.size]));
  }
  public toArray(): readonly Decision<DecisionOutcome>[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<Decision<DecisionOutcome>> {
    return this.values[Symbol.iterator]();
  }
}

function group<TKey>(
  values: readonly Decision<DecisionOutcome>[],
  key: (value: Decision<DecisionOutcome>) => TKey,
): ReadonlyMap<TKey, DecisionCollection> {
  const result = new Map<TKey, Decision<DecisionOutcome>[]>();
  for (const value of values) result.set(key(value), [...(result.get(key(value)) ?? []), value]);
  return new Map([...result].map(([entryKey, entries]) => [entryKey, DecisionCollection.create(entries)]));
}

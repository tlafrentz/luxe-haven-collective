import type { EvaluationId } from "../../evaluations";
import type { EvidenceId } from "../../evidence";
import { ConfidenceLevel } from "../../scoring";
import { Recommendation } from "./recommendation";
import type { RecommendationId } from "./recommendation-id";
import {
  RECOMMENDATION_PRIORITY_RANK,
  RecommendationPriority,
} from "./recommendation-priority";

/** Immutable query and aggregation boundary for Recommendations. */
export class RecommendationCollection implements Iterable<Recommendation> {
  private readonly values: readonly Recommendation[];

  private constructor(values: readonly Recommendation[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) {
      throw new RangeError("Recommendation IDs must be unique.");
    }
    this.values = Object.freeze([...values]);
  }

  public static empty(): RecommendationCollection {
    return new RecommendationCollection([]);
  }

  public static create(values: readonly Recommendation[]): RecommendationCollection {
    return new RecommendationCollection(values);
  }

  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get isNotEmpty(): boolean { return !this.isEmpty; }
  public has(id: RecommendationId): boolean { return this.get(id) !== undefined; }
  public get(id: RecommendationId): Recommendation | undefined {
    return this.values.find((value) => value.id.equals(id));
  }
  public require(id: RecommendationId): Recommendation {
    const value = this.get(id);
    if (!value) throw new RangeError(`Recommendation not found: ${id.value}.`);
    return value;
  }
  public add(value: Recommendation): RecommendationCollection {
    return RecommendationCollection.create([...this.values, value]);
  }
  public filter(predicate: (value: Recommendation) => boolean): RecommendationCollection {
    return RecommendationCollection.create(this.values.filter(predicate));
  }
  public ofPriority(priority: RecommendationPriority): RecommendationCollection {
    return this.filter((value) => value.priority === priority);
  }
  public ofCategory(category: string): RecommendationCollection {
    const normalized = category.trim();
    if (!normalized) throw new TypeError("Recommendation category cannot be empty.");
    return this.filter((value) => value.category === normalized);
  }
  public withConfidenceLevel(level: ConfidenceLevel): RecommendationCollection {
    return this.filter((value) => value.confidence.level === level);
  }
  public supportingEvaluation(id: EvaluationId): RecommendationCollection {
    return this.filter((value) => value.supportedByEvaluation(id));
  }
  public supportingEvidence(id: EvidenceId): RecommendationCollection {
    return this.filter((value) => value.supportedByEvidence(id));
  }
  public priorityFirst(): RecommendationCollection {
    return RecommendationCollection.create([...this.values].sort((a, b) =>
      RECOMMENDATION_PRIORITY_RANK[b.priority] - RECOMMENDATION_PRIORITY_RANK[a.priority] ||
      a.id.value.localeCompare(b.id.value),
    ));
  }
  public groupByPriority(): ReadonlyMap<RecommendationPriority, RecommendationCollection> {
    return group(this.values, (value) => value.priority);
  }
  public groupByCategory(): ReadonlyMap<string, RecommendationCollection> {
    return group(this.values, (value) => value.category);
  }
  public countByPriority(): Readonly<Record<RecommendationPriority, number>> {
    return Object.freeze({
      [RecommendationPriority.LOW]: this.ofPriority(RecommendationPriority.LOW).size,
      [RecommendationPriority.MEDIUM]: this.ofPriority(RecommendationPriority.MEDIUM).size,
      [RecommendationPriority.HIGH]: this.ofPriority(RecommendationPriority.HIGH).size,
      [RecommendationPriority.CRITICAL]: this.ofPriority(RecommendationPriority.CRITICAL).size,
    });
  }
  public toArray(): readonly Recommendation[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<Recommendation> { return this.values[Symbol.iterator](); }
}

function group<TKey>(
  values: readonly Recommendation[],
  key: (value: Recommendation) => TKey,
): ReadonlyMap<TKey, RecommendationCollection> {
  const grouped = new Map<TKey, Recommendation[]>();
  for (const value of values) grouped.set(key(value), [...(grouped.get(key(value)) ?? []), value]);
  return new Map([...grouped].map(([entryKey, entries]) => [entryKey, RecommendationCollection.create(entries)]));
}

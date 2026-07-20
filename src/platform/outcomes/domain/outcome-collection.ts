import type { Identifier } from "../../kernel";
import { Outcome } from "./outcome";
import type { OutcomeId } from "./outcome-id";
import type { OutcomeStatus } from "./outcome-status";
import type { OutcomeType } from "./outcome-type";

export class OutcomeCollection implements Iterable<Outcome> {
  private constructor(private readonly values: readonly Outcome[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Outcome IDs must be unique.");
    this.values = Object.freeze([...values]);
  }
  public static empty(): OutcomeCollection { return new OutcomeCollection([]); }
  public static create(values: readonly Outcome[]): OutcomeCollection { return new OutcomeCollection(values); }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get(id: OutcomeId): Outcome | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: OutcomeId): Outcome { const value = this.get(id); if (!value) throw new RangeError(`Outcome not found: ${id.value}.`); return value; }
  public add(value: Outcome): OutcomeCollection { return OutcomeCollection.create([...this.values, value]); }
  public filter(predicate: (value: Outcome) => boolean): OutcomeCollection { return OutcomeCollection.create(this.values.filter(predicate)); }
  public ofStatus(status: OutcomeStatus): OutcomeCollection { return this.filter((value) => value.status === status); }
  public ofType(type: OutcomeType): OutcomeCollection { const normalized = type.trim(); if (!normalized) throw new TypeError("Outcome type cannot be empty."); return this.filter((value) => value.type === normalized); }
  public successful(): OutcomeCollection { return this.filter((value) => value.successful); }
  public tracing(id: Identifier): OutcomeCollection { return this.filter((value) => value.traces(id)); }
  public groupByStatus(): ReadonlyMap<OutcomeStatus, OutcomeCollection> { return group(this.values, (value) => value.status); }
  public groupByType(): ReadonlyMap<OutcomeType, OutcomeCollection> { return group(this.values, (value) => value.type); }
  public sumMetric(name: string): number { const key = name.trim(); if (!key) throw new TypeError("Outcome metric name cannot be empty."); return this.values.reduce((total, value) => total + (value.metrics[key] ?? 0), 0); }
  public averageMetric(name: string): number | undefined { const key = name.trim(); if (!key) throw new TypeError("Outcome metric name cannot be empty."); const values = this.values.flatMap((value) => value.metrics[key] === undefined ? [] : [value.metrics[key]]); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined; }
  public toArray(): readonly Outcome[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<Outcome> { return this.values[Symbol.iterator](); }
}
function group<TKey>(values: readonly Outcome[], key: (value: Outcome) => TKey): ReadonlyMap<TKey, OutcomeCollection> {
  const groups = new Map<TKey, Outcome[]>(); for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value]);
  return new Map([...groups].map(([entry, outcomes]) => [entry, OutcomeCollection.create(outcomes)]));
}

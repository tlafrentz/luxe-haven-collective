import type { Identifier } from "../../kernel";
import { LegacyAction } from "./legacy-action";
import { mapLegacyActionPriorityToPlatformPriority, type LegacyActionPriority } from "./legacy-action-priority";
import type { LegacyActionStatus } from "./legacy-action-status";
import { ACTION_PRIORITY_RANK } from "../domain/action-priority";
export class LegacyActionCollection implements Iterable<LegacyAction> {
  private constructor(private readonly values: readonly LegacyAction[]) { const ids = values.map((value) => value.id.value); if (new Set(ids).size !== ids.length) throw new RangeError("Action IDs must be unique."); this.values = Object.freeze([...values]); Object.freeze(this); }
  public static empty(): LegacyActionCollection { return new LegacyActionCollection([]); } public static create(values: readonly LegacyAction[]): LegacyActionCollection { return new LegacyActionCollection(values); }
  public get size(): number { return this.values.length; } public get isEmpty(): boolean { return this.size === 0; } public get isNotEmpty(): boolean { return !this.isEmpty; }
  public get(id: Identifier): LegacyAction | undefined { return this.values.find((value) => value.id.equals(id)); } public require(id: Identifier): LegacyAction { const result = this.get(id); if (!result) throw new RangeError(`Action not found: ${id.value}.`); return result; }
  public add(value: LegacyAction): LegacyActionCollection { return LegacyActionCollection.create([...this.values, value]); } public filter(predicate: (action: LegacyAction) => boolean): LegacyActionCollection { return LegacyActionCollection.create(this.values.filter(predicate)); }
  public ofStatus(status: LegacyActionStatus): LegacyActionCollection { return this.filter((value) => value.status === status); } public ofPriority(priority: LegacyActionPriority): LegacyActionCollection { return this.filter((value) => value.priority === priority); } public ofType(type: string): LegacyActionCollection { return this.filter((value) => value.type === type); }
  public priorityFirst(): LegacyActionCollection { return LegacyActionCollection.create([...this.values].sort((a, b) => ACTION_PRIORITY_RANK[mapLegacyActionPriorityToPlatformPriority(b.priority)] - ACTION_PRIORITY_RANK[mapLegacyActionPriorityToPlatformPriority(a.priority)] || b.createdAt.getTime() - a.createdAt.getTime())); }
  public toArray(): readonly LegacyAction[] { return [...this.values]; } public [Symbol.iterator](): Iterator<LegacyAction> { return this.values[Symbol.iterator](); }
}

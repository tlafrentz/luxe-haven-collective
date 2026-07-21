import type { Identifier } from "../../kernel";
import { PlatformAction } from "./action";
import { sameActionActor, type ActionActor } from "./action-actor";
import { ACTION_PRIORITY_RANK, type ActionPriority } from "./action-priority";
import { actionSourceKey, type PlatformActionSource } from "./action-source";
import type { ActionStatus } from "./action-status";

export class PlatformActionCollection implements Iterable<PlatformAction> {
  private constructor(private readonly values: readonly PlatformAction[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Action IDs must be unique.");
    this.values = Object.freeze([...values]); Object.freeze(this);
  }
  public static empty(): PlatformActionCollection { return new PlatformActionCollection([]); }
  public static create(values: readonly PlatformAction[]): PlatformActionCollection { return new PlatformActionCollection(values); }
  public all(): readonly PlatformAction[] { return [...this.values]; }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get isNotEmpty(): boolean { return !this.isEmpty; }
  public findById(id: Identifier): PlatformAction | undefined { return this.values.find((value) => value.id.equals(id)); }
  public get(id: Identifier): PlatformAction | undefined { return this.findById(id); }
  public require(id: Identifier): PlatformAction { const action = this.findById(id); if (!action) throw new RangeError(`Action not found: ${id.value}.`); return action; }
  public add(action: PlatformAction): PlatformActionCollection { return PlatformActionCollection.create([...this.values, action]); }
  public filter(predicate: (action: PlatformAction) => boolean): PlatformActionCollection { return PlatformActionCollection.create(this.values.filter(predicate)); }
  public filterByStatus(status: ActionStatus): PlatformActionCollection { return this.filter((value) => value.status === status); }
  public ofStatus(status: ActionStatus): PlatformActionCollection { return this.filterByStatus(status); }
  public filterByOwner(owner: ActionActor): PlatformActionCollection { return this.filter((value) => sameActionActor(value.owner, owner)); }
  public filterByAssignee(assignee: ActionActor): PlatformActionCollection { return this.filter((value) => value.activeAssignment?.assigneeType === assignee.type && value.activeAssignment?.assigneeId === assignee.id); }
  public filterBySource(source: PlatformActionSource): PlatformActionCollection { const key = actionSourceKey(source); return this.filter((value) => value.sources.some((candidate) => actionSourceKey(candidate) === key)); }
  public ofPriority(priority: ActionPriority): PlatformActionCollection { return this.filter((value) => value.priority === priority); }
  public ofType(type: string): PlatformActionCollection { return this.filter((value) => value.actionType === type); }
  public active(): PlatformActionCollection { return this.filter((value) => !["completed", "cancelled", "archived"].includes(value.status)); }
  public completed(): PlatformActionCollection { return this.filterByStatus("completed"); }
  public overdue(now: Date): PlatformActionCollection { const time = now.getTime(); return this.active().filter((value) => Boolean(value.scheduleValue.due && value.scheduleValue.due.getTime() < time)); }
  public dueBefore(date: Date): PlatformActionCollection { const time = date.getTime(); return this.filter((value) => Boolean(value.scheduleValue.due && value.scheduleValue.due.getTime() < time)); }
  public priorityFirst(): PlatformActionCollection { return PlatformActionCollection.create([...this.values].sort((a, b) => ACTION_PRIORITY_RANK[b.priority] - ACTION_PRIORITY_RANK[a.priority] || b.createdAt.getTime() - a.createdAt.getTime())); }
  public toArray(): readonly PlatformAction[] { return this.all(); }
  public [Symbol.iterator](): Iterator<PlatformAction> { return this.values[Symbol.iterator](); }
}

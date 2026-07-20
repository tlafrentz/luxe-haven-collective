import type { Identifier } from "../../kernel";
import { Action } from "./action";
import { ACTION_PRIORITY_RANK, type ActionPriority } from "./action-priority";
import type { ActionStatus } from "./action-status";
import type { ActionType } from "./action-type";

export class ActionCollection implements Iterable<Action> {
  private constructor(private readonly values: readonly Action[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Action IDs must be unique.");
    this.values = Object.freeze([...values]);
  }
  public static empty(): ActionCollection { return new ActionCollection([]); }
  public static create(values: readonly Action[]): ActionCollection { return new ActionCollection(values); }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get isNotEmpty(): boolean { return !this.isEmpty; }
  public get(id: Identifier): Action | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: Identifier): Action {
    const action = this.get(id);
    if (!action) throw new RangeError(`Action not found: ${id.value}.`);
    return action;
  }
  public add(action: Action): ActionCollection { return ActionCollection.create([...this.values, action]); }
  public filter(predicate: (action: Action) => boolean): ActionCollection {
    return ActionCollection.create(this.values.filter(predicate));
  }
  public ofStatus(status: ActionStatus): ActionCollection { return this.filter((value) => value.status === status); }
  public ofPriority(priority: ActionPriority): ActionCollection { return this.filter((value) => value.priority === priority); }
  public ofType(type: ActionType): ActionCollection { return this.filter((value) => value.type === type); }
  public priorityFirst(): ActionCollection {
    return ActionCollection.create([...this.values].sort((a, b) =>
      ACTION_PRIORITY_RANK[b.priority] - ACTION_PRIORITY_RANK[a.priority] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
    ));
  }
  public toArray(): readonly Action[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<Action> { return this.values[Symbol.iterator](); }
}

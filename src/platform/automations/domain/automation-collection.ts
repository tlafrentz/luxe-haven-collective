import type { AutomationRuleId } from "./automation-id";
import { AutomationRule } from "./automation-rule";
import type { AutomationTriggerType } from "./automation-trigger";

export class AutomationCollection implements Iterable<AutomationRule> {
  private constructor(private readonly values: readonly AutomationRule[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Automation rule IDs must be unique.");
    this.values = Object.freeze([...values]);
  }
  public static empty(): AutomationCollection { return new AutomationCollection([]); }
  public static create(values: readonly AutomationRule[]): AutomationCollection { return new AutomationCollection(values); }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get(id: AutomationRuleId): AutomationRule | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: AutomationRuleId): AutomationRule { const value = this.get(id); if (!value) throw new RangeError(`Automation rule not found: ${id.value}.`); return value; }
  public add(value: AutomationRule): AutomationCollection { return AutomationCollection.create([...this.values, value]); }
  public filter(predicate: (value: AutomationRule) => boolean): AutomationCollection { return AutomationCollection.create(this.values.filter(predicate)); }
  public enabled(): AutomationCollection { return this.filter((value) => value.enabled); }
  public forTrigger(type: AutomationTriggerType): AutomationCollection { return this.filter((value) => value.trigger.type === type); }
  public groupByTrigger(): ReadonlyMap<AutomationTriggerType, AutomationCollection> {
    const groups = new Map<AutomationTriggerType, AutomationRule[]>();
    for (const rule of this.values) groups.set(rule.trigger.type, [...(groups.get(rule.trigger.type) ?? []), rule]);
    return new Map([...groups].map(([type, rules]) => [type, AutomationCollection.create(rules)]));
  }
  public toArray(): readonly AutomationRule[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<AutomationRule> { return this.values[Symbol.iterator](); }
}

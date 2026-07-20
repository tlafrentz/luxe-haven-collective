import type { AutomationExecutionId, AutomationRuleId } from "./automation-id";
import { AutomationExecution } from "./automation-execution";

export class AutomationHistory implements Iterable<AutomationExecution> {
  private constructor(private readonly values: readonly AutomationExecution[]) {
    const ids = values.map((value) => value.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Automation execution IDs must be unique.");
    this.values = Object.freeze([...values].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()));
  }
  public static empty(): AutomationHistory { return new AutomationHistory([]); }
  public static create(values: readonly AutomationExecution[]): AutomationHistory { return new AutomationHistory(values); }
  public get size(): number { return this.values.length; }
  public append(value: AutomationExecution): AutomationHistory { return AutomationHistory.create([...this.values, value]); }
  public get(id: AutomationExecutionId): AutomationExecution | undefined { return this.values.find((value) => value.id.equals(id)); }
  public forRule(id: AutomationRuleId): AutomationHistory { return AutomationHistory.create(this.values.filter((value) => value.ruleId.equals(id))); }
  public failures(): AutomationHistory { return AutomationHistory.create(this.values.filter((value) => value.status === "failed")); }
  public toArray(): readonly AutomationExecution[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<AutomationExecution> { return this.values[Symbol.iterator](); }
}

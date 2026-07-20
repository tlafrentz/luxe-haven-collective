import type { Identifier } from "../../kernel";
import { Workflow } from "./workflow";
import type { WorkflowDefinitionId } from "./workflow-definition-id";
import type { WorkflowStatus } from "./workflow-status";

export class WorkflowCollection implements Iterable<Workflow> {
  private constructor(private readonly values: readonly Workflow[]) {
    const ids = values.map((workflow) => workflow.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Workflow IDs must be unique.");
    this.values = Object.freeze([...values]);
  }
  public static empty(): WorkflowCollection { return new WorkflowCollection([]); }
  public static create(values: readonly Workflow[]): WorkflowCollection { return new WorkflowCollection(values); }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get isNotEmpty(): boolean { return !this.isEmpty; }
  public get(id: Identifier): Workflow | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: Identifier): Workflow {
    const workflow = this.get(id);
    if (!workflow) throw new RangeError(`Workflow not found: ${id.value}.`);
    return workflow;
  }
  public add(workflow: Workflow): WorkflowCollection { return WorkflowCollection.create([...this.values, workflow]); }
  public filter(predicate: (workflow: Workflow) => boolean): WorkflowCollection {
    return WorkflowCollection.create(this.values.filter(predicate));
  }
  public ofStatus(status: WorkflowStatus): WorkflowCollection { return this.filter((value) => value.status === status); }
  public ofDefinition(id: WorkflowDefinitionId): WorkflowCollection { return this.filter((value) => value.definitionId.equals(id)); }
  public groupByStatus(): ReadonlyMap<WorkflowStatus, WorkflowCollection> {
    const groups = new Map<WorkflowStatus, Workflow[]>();
    for (const workflow of this.values) groups.set(workflow.status, [...(groups.get(workflow.status) ?? []), workflow]);
    return new Map([...groups].map(([status, workflows]) => [status, WorkflowCollection.create(workflows)]));
  }
  public countByStatus(): ReadonlyMap<WorkflowStatus, number> {
    return new Map([...this.groupByStatus()].map(([status, workflows]) => [status, workflows.size]));
  }
  public toArray(): readonly Workflow[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<Workflow> { return this.values[Symbol.iterator](); }
}

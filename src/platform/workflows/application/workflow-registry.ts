import type { WorkflowDefinition, WorkflowDefinitionId } from "../domain";

export class WorkflowRegistry implements Iterable<WorkflowDefinition> {
  private constructor(private readonly definitions: readonly WorkflowDefinition[]) {
    const ids = definitions.map((definition) => definition.id.value);
    if (new Set(ids).size !== ids.length) throw new RangeError("Workflow definition IDs must be unique.");
    this.definitions = Object.freeze([...definitions]);
  }
  public static empty(): WorkflowRegistry { return new WorkflowRegistry([]); }
  public static create(definitions: readonly WorkflowDefinition[]): WorkflowRegistry { return new WorkflowRegistry(definitions); }
  public get size(): number { return this.definitions.length; }
  public register(definition: WorkflowDefinition): WorkflowRegistry {
    return new WorkflowRegistry([...this.definitions, definition]);
  }
  public get(id: WorkflowDefinitionId): WorkflowDefinition | undefined {
    return this.definitions.find((definition) => definition.id.equals(id));
  }
  public require(id: WorkflowDefinitionId): WorkflowDefinition {
    const definition = this.get(id);
    if (!definition) throw new RangeError(`Workflow definition not found: ${id.value}.`);
    return definition;
  }
  public toArray(): readonly WorkflowDefinition[] { return [...this.definitions]; }
  public [Symbol.iterator](): Iterator<WorkflowDefinition> { return this.definitions[Symbol.iterator](); }
}

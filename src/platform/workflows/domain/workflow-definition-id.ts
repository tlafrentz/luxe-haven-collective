import { Identifier } from "../../kernel";

export type WorkflowDefinitionId = Identifier;
export function createWorkflowDefinitionId(value: string): WorkflowDefinitionId {
  return Identifier.create(value);
}

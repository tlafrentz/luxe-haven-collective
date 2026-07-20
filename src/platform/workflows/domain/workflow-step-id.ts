import { Identifier } from "../../kernel";

export type WorkflowStepId = Identifier;
export function createWorkflowStepId(value: string): WorkflowStepId {
  return Identifier.create(value);
}

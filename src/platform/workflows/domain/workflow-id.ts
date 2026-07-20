import { Identifier } from "../../kernel";

export type WorkflowId = Identifier;
export function createWorkflowId(value?: string): WorkflowId {
  return Identifier.create(value ?? `workflow-${crypto.randomUUID()}`);
}

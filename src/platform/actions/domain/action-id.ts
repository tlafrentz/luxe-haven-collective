import { Identifier } from "../../kernel";
export type ActionId = Identifier;
export type WorkspaceId = Identifier;
export function createActionId(value?: string): ActionId {
  return Identifier.create(value ?? `action-${crypto.randomUUID()}`);
}
export function createWorkspaceId(value: string): WorkspaceId { return Identifier.create(value); }

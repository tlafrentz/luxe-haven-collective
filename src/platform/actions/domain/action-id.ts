import { Identifier } from "../../kernel";
export type ActionId = Identifier;
export function createActionId(value?: string): ActionId {
  return Identifier.create(value ?? `action-${crypto.randomUUID()}`);
}

import { Identifier } from "../../kernel";

export type OutcomeId = Identifier;
export function createOutcomeId(value?: string): OutcomeId {
  return Identifier.create(value ?? `outcome-${crypto.randomUUID()}`);
}

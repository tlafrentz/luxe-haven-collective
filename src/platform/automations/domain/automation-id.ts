import { Identifier } from "../../kernel";

export type AutomationRuleId = Identifier;
export type AutomationExecutionId = Identifier;
export function createAutomationRuleId(value: string): AutomationRuleId { return Identifier.create(value); }
export function createAutomationExecutionId(value?: string): AutomationExecutionId {
  return Identifier.create(value ?? `automation-${crypto.randomUUID()}`);
}

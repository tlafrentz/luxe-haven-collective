import type { Action } from "../../actions";
import type { ObservationValue } from "../../observations";
import type { Workflow } from "../../workflows";
import type { PlatformEvent } from "./automation-trigger";

export type AutomationConditionSource = "event" | "action" | "workflow";
export type AutomationConditionOperator = "equals" | "not-equals" | "greater-than-or-equal" | "less-than-or-equal" | "includes" | "exists";
export type AutomationConditionInput = Readonly<{
  source: AutomationConditionSource;
  field: string;
  operator: AutomationConditionOperator;
  expected?: ObservationValue;
}>;
export type AutomationConditionContext = Readonly<{
  event: PlatformEvent;
  action?: Action;
  workflow?: Workflow;
}>;

export class AutomationCondition {
  public readonly source: AutomationConditionSource;
  public readonly field: string;
  public readonly operator: AutomationConditionOperator;
  public readonly expected?: ObservationValue;
  private constructor(input: AutomationConditionInput) {
    this.source = input.source;
    this.field = text(input.field);
    this.operator = input.operator;
    if (input.operator !== "exists" && input.expected === undefined) {
      throw new TypeError(`Automation condition "${this.field}" requires an expected value.`);
    }
    this.expected = input.expected;
    Object.freeze(this);
  }
  public static create(input: AutomationConditionInput): AutomationCondition { return new AutomationCondition(input); }
  public evaluate(context: AutomationConditionContext): boolean {
    const actual = value(this.source, this.field, context);
    switch (this.operator) {
      case "exists": return actual !== undefined && actual !== null;
      case "equals": return equal(actual, this.expected);
      case "not-equals": return !equal(actual, this.expected);
      case "greater-than-or-equal": return typeof actual === "number" && typeof this.expected === "number" && actual >= this.expected;
      case "less-than-or-equal": return typeof actual === "number" && typeof this.expected === "number" && actual <= this.expected;
      case "includes": return Array.isArray(actual) && actual.some((entry) => equal(entry, this.expected));
    }
  }
}
function value(source: AutomationConditionSource, field: string, context: AutomationConditionContext): unknown {
  if (source === "event") return field === "type" || field === "name" || field === "occurredAt"
    ? context.event[field]
    : context.event.data?.[field];
  const target = source === "action" ? context.action : context.workflow;
  if (!target) return undefined;
  return (target as unknown as Record<string, unknown>)[field];
}
function equal(left: unknown, right: unknown): boolean {
  if (left instanceof Date && typeof right === "string") return left.toISOString() === right;
  return JSON.stringify(left) === JSON.stringify(right);
}
function text(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("Automation condition field cannot be empty.");
  return normalized;
}

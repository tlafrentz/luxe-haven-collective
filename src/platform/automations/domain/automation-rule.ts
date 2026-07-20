import type { ObservationValue } from "../../observations";
import type { ActionId } from "../../actions";
import type { WorkflowId } from "../../workflows";
import type { AutomationCondition } from "./automation-condition";
import type { AutomationRuleId } from "./automation-id";
import type { AutomationTrigger } from "./automation-trigger";

export type AutomationTarget = Readonly<{ type: "action"; id: ActionId }> | Readonly<{ type: "workflow"; id: WorkflowId }>;
export type AutomationExecutionPolicy = Readonly<{
  maxAttempts?: number;
  maxConcurrency?: number;
  notBefore?: Date;
  notAfter?: Date;
}>;
export type AutomationRuleInput = Readonly<{
  id: AutomationRuleId;
  title: string;
  description: string;
  enabled?: boolean;
  trigger: AutomationTrigger;
  conditions?: readonly AutomationCondition[];
  target: AutomationTarget;
  executionPolicy?: AutomationExecutionPolicy;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class AutomationRule {
  public readonly id: AutomationRuleId;
  public readonly title: string;
  public readonly description: string;
  public readonly enabled: boolean;
  public readonly trigger: AutomationTrigger;
  public readonly conditions: readonly AutomationCondition[];
  public readonly target: AutomationTarget;
  public readonly executionPolicy: AutomationExecutionPolicy;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: AutomationRuleInput) {
    this.id = input.id;
    this.title = text(input.title, "Automation rule title");
    this.description = text(input.description, "Automation rule description");
    this.enabled = input.enabled ?? true;
    this.trigger = input.trigger;
    this.conditions = Object.freeze([...(input.conditions ?? [])]);
    this.target = Object.freeze({ ...input.target });
    this.executionPolicy = normalizePolicy(input.executionPolicy);
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: AutomationRuleInput): AutomationRule { return new AutomationRule(input); }
  public isScheduledFor(at: Date): boolean {
    return (!this.executionPolicy.notBefore || at >= this.executionPolicy.notBefore) &&
      (!this.executionPolicy.notAfter || at <= this.executionPolicy.notAfter);
  }
}
function normalizePolicy(value: AutomationExecutionPolicy = {}): AutomationExecutionPolicy {
  const maxAttempts = value.maxAttempts ?? 1, maxConcurrency = value.maxConcurrency ?? 1;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new RangeError("Automation max attempts must be a positive integer.");
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1) throw new RangeError("Automation max concurrency must be a positive integer.");
  const notBefore = value.notBefore ? date(value.notBefore, "Automation start window") : undefined;
  const notAfter = value.notAfter ? date(value.notAfter, "Automation end window") : undefined;
  if (notBefore && notAfter && notAfter < notBefore) throw new RangeError("Automation execution window is invalid.");
  return Object.freeze({ maxAttempts, maxConcurrency, ...(notBefore ? { notBefore } : {}), ...(notAfter ? { notAfter } : {}) });
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
function text(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${field} cannot be empty.`); return normalized; }

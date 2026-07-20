import type { Action } from "../../actions";
import type { Workflow } from "../../workflows";
import type { AutomationRule, PlatformEvent } from "../domain";

export type AutomationPolicyContext = Readonly<{
  rule: AutomationRule;
  event: PlatformEvent;
  action?: Action;
  workflow?: Workflow;
}>;
export type AutomationPolicyResult = Readonly<{
  allowed: boolean;
  reason?: string;
  maxAttempts?: number;
  maxConcurrency?: number;
}>;
export interface AutomationPolicy {
  readonly name: string;
  readonly version?: string;
  supports(context: AutomationPolicyContext): boolean | Promise<boolean>;
  govern(context: AutomationPolicyContext): AutomationPolicyResult | Promise<AutomationPolicyResult>;
}

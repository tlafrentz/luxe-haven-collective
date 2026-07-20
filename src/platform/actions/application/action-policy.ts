import type { Decision, DecisionCollection } from "../../decisions";
import type { ObservationValue } from "../../observations";
import type { ActionOutcome, ActionOwner, ActionPriority, ActionStatus, ActionType } from "../domain";

export type ActionPolicyContext = Readonly<{ decisions: DecisionCollection }>;
export type ActionPolicyResult = Readonly<{
  title: string;
  summary: string;
  type: ActionType;
  priority: ActionPriority;
  owner: ActionOwner;
  sourceDecisions: readonly Decision<string>[];
  status?: ActionStatus;
  scheduledFor?: Date;
  outcome?: ActionOutcome;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export interface ActionPolicy {
  readonly name: string;
  readonly version?: string;
  supports(context: ActionPolicyContext): boolean | Promise<boolean>;
  create(context: ActionPolicyContext): ActionPolicyResult | undefined | Promise<ActionPolicyResult | undefined>;
}

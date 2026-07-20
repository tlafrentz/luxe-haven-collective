import type { Action } from "../../actions";
import type { AutomationExecution } from "../../automations";
import type { ObservationValue } from "../../observations";
import type { Workflow } from "../../workflows";
import type { OutcomeLineage, OutcomeStatus, OutcomeType } from "../domain";

export type OutcomeSource =
  | Readonly<{ type: "action"; action: Action }>
  | Readonly<{ type: "workflow"; workflow: Workflow }>
  | Readonly<{ type: "automation"; automation: AutomationExecution }>;
export type OutcomePolicyContext = Readonly<{ source: OutcomeSource }>;
export type OutcomePolicyResult = Readonly<{
  title: string;
  summary: string;
  type?: OutcomeType;
  status: OutcomeStatus;
  successful: boolean;
  metrics?: Readonly<Record<string, number>>;
  result?: Readonly<Record<string, ObservationValue>>;
  notes?: readonly string[];
  lineage: OutcomeLineage;
  timeoutMs?: number;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export interface OutcomePolicy {
  readonly name: string;
  readonly version?: string;
  supports(context: OutcomePolicyContext): boolean | Promise<boolean>;
  measure(context: OutcomePolicyContext): OutcomePolicyResult | undefined | Promise<OutcomePolicyResult | undefined>;
}

import type { ObservationValue } from "../../observations";
import { Action } from "../compatibility";
import type { ActionId } from "../domain";
import type { ActionPolicyResult } from "./action-policy";

export type ActionBuilderInput = Readonly<{
  result: ActionPolicyResult;
  createdAt: Date;
  id?: ActionId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class ActionBuilder {
  public build(input: ActionBuilderInput): Action {
    const decisions = [...new Map(input.result.sourceDecisions.map((value) => [value.id.value, value])).values()];
    if (decisions.length === 0) throw new TypeError("Policy-created Actions require a source Decision.");
    return Action.create({
      ...(input.id ? { id: input.id } : {}),
      title: input.result.title,
      summary: input.result.summary,
      type: input.result.type,
      priority: input.result.priority,
      status: input.result.status,
      owner: input.result.owner,
      decisionIds: decisions.map((value) => value.id),
      createdAt: input.createdAt,
      ...(input.result.scheduledFor ? { scheduledFor: input.result.scheduledFor } : {}),
      ...(input.result.outcome ? { outcome: input.result.outcome } : {}),
      metadata: { ...input.result.metadata, ...input.metadata },
    });
  }
}

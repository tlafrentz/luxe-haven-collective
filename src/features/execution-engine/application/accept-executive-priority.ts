import type { ExecutivePriority } from "@/features/executive-intelligence";
import { Action, createActionId, type ActionOwner } from "@/platform/actions";
import type { ExecutiveAction } from "../compatibility";
import { toExecutiveAction } from "../compatibility";
import { executivePriorityMetadata, mapExecutivePriorityActionType, mapExecutivePrioritySeverity } from "./mappers";

export type AcceptExecutivePriorityInput = { priority: ExecutivePriority; actionId: string; owner: ActionOwner; acceptedAt: string };

export function acceptExecutivePriority({ priority, actionId, owner, acceptedAt }: AcceptExecutivePriorityInput): ExecutiveAction {
  if (priority.status !== "open") throw new Error(`Cannot accept executive priority with status "${priority.status}".`);
  const createdAt = new Date(acceptedAt);
  const action = Action.create({
    id: createActionId(actionId), title: priority.title, summary: priority.action.summary,
    type: mapExecutivePriorityActionType(priority.action.type), priority: mapExecutivePrioritySeverity(priority.severity),
    owner, decisionIds: [], createdAt,
    metadata: { ...executivePriorityMetadata(priority), legacyCreatedAt: acceptedAt, legacyAcceptedAt: acceptedAt },
  }).accept(createdAt);
  return toExecutiveAction(action);
}

import { Identifier } from "../../kernel";
import { createActionActor, type ActionActor, type ActionActorType } from "./action-actor";

export type ActionAssignmentId = Identifier;
export function createActionAssignmentId(value?: string): ActionAssignmentId { return Identifier.create(value ?? `action-assignment-${crypto.randomUUID()}`); }
export const ACTION_ASSIGNMENT_STATUSES = ["assigned", "queued", "claimed", "released"] as const;
export type ActionAssignmentStatus = (typeof ACTION_ASSIGNMENT_STATUSES)[number];
export type PlatformActionAssignment = Readonly<{
  id: ActionAssignmentId;
  assigneeType: ActionActorType;
  assigneeId?: string;
  queue?: string;
  status: ActionAssignmentStatus;
  assignedAt: Date;
  assignedBy: ActionActor;
  claimedAt?: Date;
  releasedAt?: Date;
}>;

export function createActionAssignment(input: PlatformActionAssignment): PlatformActionAssignment {
  const assignee = createActionActor({ type: input.assigneeType, ...(input.assigneeId ? { id: input.assigneeId } : {}) });
  const queue = input.queue?.trim();
  if (input.status === "queued" && !queue) throw new TypeError("Queued Action assignments require a queue.");
  return Object.freeze({ ...input, assigneeType: assignee.type, ...(assignee.id ? { assigneeId: assignee.id } : {}), ...(queue ? { queue } : {}), assignedAt: validDate(input.assignedAt, "Action assignment date"), assignedBy: createActionActor(input.assignedBy), ...(input.claimedAt ? { claimedAt: validDate(input.claimedAt, "Action claim date") } : {}), ...(input.releasedAt ? { releasedAt: validDate(input.releasedAt, "Action release date") } : {}) });
}
export function isActiveAssignment(value: PlatformActionAssignment): boolean { return value.status !== "released"; }
function validDate(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }

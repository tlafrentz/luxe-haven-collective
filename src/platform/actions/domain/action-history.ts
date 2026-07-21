import { Identifier } from "../../kernel";
import { createActionActor, type ActionActor } from "./action-actor";
import type { ActionId } from "./action-id";
import type { ActionStatus } from "./action-status";
import { ActionVersion } from "./action-version";
export type ActionHistoryId = Identifier;
export function createActionHistoryId(value?: string): ActionHistoryId { return Identifier.create(value ?? `action-history-${crypto.randomUUID()}`); }
export const ACTION_HISTORY_OPERATIONS = ["created", "committed", "owner-changed", "priority-changed", "assigned", "assignment-released", "claimed", "scheduled", "marked-ready", "started", "blocked", "unblocked", "completed", "cancelled", "archived", "outcome-linked"] as const;
export type ActionHistoryOperation = (typeof ACTION_HISTORY_OPERATIONS)[number];
export type PlatformActionHistory = Readonly<{ id: ActionHistoryId; actionId: ActionId; version: ActionVersion; operation: ActionHistoryOperation; previousStatus?: ActionStatus; resultingStatus?: ActionStatus; occurredAt: Date; actor: ActionActor; reason?: string; commandId?: string; externalEventId?: string }>;
export function createActionHistory(input: PlatformActionHistory): PlatformActionHistory {
  const occurredAt = new Date(input.occurredAt); if (Number.isNaN(occurredAt.getTime())) throw new TypeError("Action history date must be valid.");
  return Object.freeze({ ...input, occurredAt, actor: createActionActor(input.actor), reason: clean(input.reason), commandId: clean(input.commandId), externalEventId: clean(input.externalEventId) });
}
function clean(value?: string): string | undefined { const result = value?.trim(); return result || undefined; }

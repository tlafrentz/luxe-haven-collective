import { Identifier } from "../../../kernel";
import { PlatformAction, createActionId, createWorkspaceId } from "../../domain";

const actor = { type: "user", id: "operator-1" } as const;
export function persistedAction(workspace = "workspace-1", id = "action-1") {
  const createdAt = new Date("2026-07-20T10:00:00.000Z");
  let action = PlatformAction.createDraft({ id: createActionId(id), workspaceId: createWorkspaceId(workspace), title: "Prepare operating plan", description: "Prepare and publish the plan.", actionType: "operations", priority: "high", owner: { type: "team", id: "operations" }, sources: [{ type: "manual", recordedAt: createdAt, recordedBy: actor }, { type: "recommendation", sourceId: "recommendation-1", capability: "revenue-intelligence", recordedAt: createdAt, recordedBy: actor }], createdAt, createdBy: actor });
  const context = (minute: number) => ({ workspaceId: action.workspaceId, expectedVersion: action.version, actor, occurredAt: new Date(`2026-07-20T10:${String(minute).padStart(2, "0")}:00.000Z`) });
  action = action.schedule({ ...context(1), startAfter: new Date("2026-07-21T10:00:00.000Z"), due: new Date("2026-07-22T10:00:00.000Z") });
  action = action.assign({ ...context(2), assigneeType: "unknown", queue: "operations" });
  action = action.claim({ ...context(3), assigneeType: "user", assigneeId: "operator-2" });
  action = action.commit(context(4)); action = action.markReady(context(5)); action = action.start(context(6)); action = action.complete(context(7));
  action = action.linkOutcome({ ...context(8), outcomeId: Identifier.create("outcome-1"), linkType: "result" });
  return action;
}

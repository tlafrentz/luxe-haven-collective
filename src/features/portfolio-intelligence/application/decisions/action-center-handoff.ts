import { PRIVILEGE_IDS } from "@/features/platform-access";
import {
  createActionId, createWorkspaceId, type PlatformActionProvider,
} from "@/platform/actions";
import type { DecisionExecutionPlan, PortfolioStrategicDecision } from "./contracts";
import { buildDecisionExecutionPlan, PortfolioDecisionError } from "./decision-workflow";

export async function createApprovedDecisionActions(input: Readonly<{
  decision: PortfolioStrategicDecision; provider: PlatformActionProvider;
  actorProfileId: string; commandId: string; occurredAt: string;
}>): Promise<DecisionExecutionPlan> {
  if (input.decision.status !== "approved") {
    throw new PortfolioDecisionError("invalid-command", "Action Center handoff requires an approved decision.");
  }
  const plan = buildDecisionExecutionPlan(input.decision);
  const actor = { type: "user" as const, id: input.actorProfileId };
  for (const action of plan.actions) {
    await input.provider.createDraft({
      actionId: createActionId(action.id),
      workspaceId: createWorkspaceId(input.decision.workspaceId),
      title: action.title,
      description: `Execution plan for ${input.decision.question}`,
      actionType: action.type,
      priority: "high",
      owner: { type: "user", id: input.decision.ownerProfileId },
      sources: [
        {
          type: "decision", sourceId: input.decision.canonicalDecisionId ?? input.decision.decisionId,
          capability: "portfolio", sourceModule: "portfolio", requiredPrivilege: PRIVILEGE_IDS.portfolioDecisionApprove,
          recordedAt: new Date(input.occurredAt), recordedBy: actor,
        },
        ...input.decision.sourceFindingIds.map((sourceId) => ({
          type: "recommendation" as const, sourceId, capability: "portfolio",
          sourceModule: "portfolio", requiredPrivilege: PRIVILEGE_IDS.portfolioDecisionApprove,
          recordedAt: new Date(input.occurredAt), recordedBy: actor,
        })),
      ],
      actor, occurredAt: new Date(input.occurredAt),
      commandId: `${input.commandId}:action:${action.id}`,
    });
  }
  return plan;
}

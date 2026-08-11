import type {
  ActionPlanProps,
  ExecuteCommandResult,
} from "@/platform/actions";
import type { ExecuteDraftPlanAutomationBoundary } from "./execute-draft-plan-automation-port";

export type ExecuteDraftPlanService = Readonly<{
  createManualDraft(input: Readonly<{
    id: string;
    workspaceId: string;
    title: string;
    description?: string;
    scope: Readonly<{
      type: "property" | "multiple-properties";
      propertyIds: readonly string[];
    }>;
    owner: Readonly<{ type: "automation"; id: string }>;
    priority: "low" | "normal" | "high" | "critical";
    actor: Readonly<{ type: "automation"; id: string }>;
    occurredAt: Date;
  }>): Promise<ExecuteCommandResult<ActionPlanProps>>;
  getPlan(
    workspaceId: string,
    planId: string,
    actor: Readonly<{ type: "automation"; id: string }>,
  ): Promise<ExecuteCommandResult<ActionPlanProps>>;
}>;

export type ExecuteDraftPlanCohort = Readonly<{
  workspaceId: string;
  propertyIds: readonly string[];
  serviceActorId: string;
}>;

/**
 * The production owning-capability boundary. The automation command ID is the
 * Execute plan ID, which makes a replay observable and idempotent without a
 * second command ledger. This adapter cannot activate a plan or create Actions.
 */
export function createProductionExecuteDraftPlanBoundary(input: Readonly<{
  service: ExecuteDraftPlanService;
  cohort: ExecuteDraftPlanCohort;
}>): ExecuteDraftPlanAutomationBoundary {
  const actor = Object.freeze({
    type: "automation" as const,
    id: input.cohort.serviceActorId,
  });

  function allowed(command: Readonly<{
    workspaceId: string;
    propertyIds: readonly string[];
    serviceActorId: string;
  }>) {
    return (
      command.workspaceId === input.cohort.workspaceId &&
      command.serviceActorId === input.cohort.serviceActorId &&
      command.propertyIds.length > 0 &&
      command.propertyIds.every((propertyId) =>
        input.cohort.propertyIds.includes(propertyId),
      )
    );
  }

  const boundary: ExecuteDraftPlanAutomationBoundary = {
    async authorize(command) {
      return allowed(command)
        ? Object.freeze({ allowed: true })
        : Object.freeze({
            allowed: false,
            classification: "COMMAND_AUTHORIZATION_DENIED" as const,
          });
    },
    async createDraftPlan(command) {
      if (!allowed(command))
        return Object.freeze({ classification: "authorization_rejected" });

      const existing = await input.service.getPlan(
        command.workspaceId,
        command.commandId,
        actor,
      );
      if (existing.ok)
        return Object.freeze({
          classification: "duplicate",
          owningCommandId: command.commandId,
          safeResultReference: `execute-plan:${command.commandId}`,
        });
      if (existing.code !== "PLAN_NOT_FOUND")
        return Object.freeze({ classification: mapFailure(existing.code) });

      const result = await input.service.createManualDraft({
        id: command.commandId,
        workspaceId: command.workspaceId,
        title: command.title,
        ...(command.description ? { description: command.description } : {}),
        scope: {
          type:
            command.propertyIds.length === 1
              ? "property"
              : "multiple-properties",
          propertyIds: command.propertyIds,
        },
        owner: actor,
        priority: command.priority,
        actor,
        occurredAt: new Date(command.occurredAt),
      });
      if (!result.ok) {
        // A racing replay may have committed after the initial read.
        const replay = await input.service.getPlan(
          command.workspaceId,
          command.commandId,
          actor,
        );
        if (replay.ok)
          return Object.freeze({
            classification: "duplicate",
            owningCommandId: command.commandId,
            safeResultReference: `execute-plan:${command.commandId}`,
          });
        return Object.freeze({ classification: mapFailure(result.code) });
      }
      return Object.freeze({
        classification: "succeeded_sync",
        owningCommandId: result.value.id,
        safeResultReference: `execute-plan:${result.value.id}`,
      });
    },
    async getCommandStatus(commandId) {
      const result = await input.service.getPlan(
        input.cohort.workspaceId,
        commandId,
        actor,
      );
      if (result.ok)
        return Object.freeze({
          classification: "succeeded_sync",
          owningCommandId: result.value.id,
          safeResultReference: `execute-plan:${result.value.id}`,
        });
      return Object.freeze({
        classification:
          result.code === "PLAN_NOT_FOUND"
            ? "known_not_accepted_timeout"
            : mapFailure(result.code),
      });
    },
  };
  return Object.freeze(boundary);
}

function mapFailure(code: string) {
  if (code === "PROPERTY_ACCESS_DENIED" || code === "ACTION_ASSIGNMENT_UNAUTHORIZED")
    return "authorization_rejected" as const;
  if (code === "PLAN_VERSION_CONFLICT" || code === "CONCURRENT_MODIFICATION")
    return "version_conflict" as const;
  if (code === "PLAN_ACTIVATION_INVALID")
    return "validation_rejected" as const;
  return "retryable_failure" as const;
}

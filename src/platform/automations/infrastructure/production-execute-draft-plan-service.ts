import {
  ExecutePlanApplicationService,
  SupabaseExecuteActivityRepository,
  SupabaseExecutePlanRepository,
  SupabaseExecuteUnitOfWork,
  SupabasePlatformActionRepository,
  type ExecuteAuthorization,
  type ExecuteSupabaseClient,
} from "@/platform/actions";
import type { ExecuteDraftPlanCohort } from "./production-execute-draft-plan-boundary";

/**
 * Composes Execute for the dedicated authenticated automation identity. The
 * supplied client must carry that user's JWT; a service-role client is not an
 * acceptable substitute for this owning-capability boundary.
 */
export function createExecuteDraftPlanService(input: Readonly<{
  client: ExecuteSupabaseClient;
  cohort: ExecuteDraftPlanCohort;
  authenticatedUserId: string;
  clock?: () => Date;
  id?: () => string;
}>): ExecutePlanApplicationService {
  if (input.authenticatedUserId !== input.cohort.serviceActorId)
    throw new Error("Execute automation identity does not match its cohort policy.");
  if (!input.cohort.propertyIds.length)
    throw new Error("Execute automation identity requires property-scoped access.");

  const actorAllowed = (actor: Readonly<{ id?: string }>) =>
    actor.id === input.authenticatedUserId;
  const authorization: ExecuteAuthorization = Object.freeze({
    canManagePlans: async (
      value: Parameters<ExecuteAuthorization["canManagePlans"]>[0],
    ) => {
      const { workspaceId, actor } = value;
      return workspaceId === input.cohort.workspaceId && actorAllowed(actor);
    },
    canAccessProperty: async (
      value: Parameters<ExecuteAuthorization["canAccessProperty"]>[0],
    ) => {
      const { workspaceId, propertyId, actor } = value;
      return (
        workspaceId === input.cohort.workspaceId &&
        actorAllowed(actor) &&
        input.cohort.propertyIds.includes(propertyId)
      );
    },
    canAssign: async (
      value: Parameters<ExecuteAuthorization["canAssign"]>[0],
    ) => {
      const { workspaceId, propertyId, owner, actor } = value;
      return (
        workspaceId === input.cohort.workspaceId &&
        actorAllowed(actor) &&
        (!propertyId || input.cohort.propertyIds.includes(propertyId)) &&
        owner?.type === "automation" &&
        owner.id === input.cohort.serviceActorId
      );
    },
  });
  const plans = new SupabaseExecutePlanRepository(input.client),
    activity = new SupabaseExecuteActivityRepository(input.client),
    actions = new SupabasePlatformActionRepository(input.client as never),
    unitOfWork = new SupabaseExecuteUnitOfWork({
      client: input.client,
      plans,
      actions,
      activity,
    });
  return new ExecutePlanApplicationService({
    unitOfWork,
    authorization,
    createId: input.id ?? (() => `execute-${crypto.randomUUID()}`),
    now: input.clock ?? (() => new Date()),
  });
}

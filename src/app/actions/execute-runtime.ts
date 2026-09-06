import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { authorizeWithLegacyFallback, evaluatePrivilege, PRIVILEGE_IDS, type PlatformAccessClient, type PrivilegeId } from "@/features/platform-access";
import {
  ExecuteControlsService,
  ExecutePlanApplicationService,
  SupabaseExecuteActivityRepository,
  SupabaseExecuteControlRepository,
  SupabaseExecutePlanRepository,
  SupabaseExecuteUnitOfWork,
  SupabasePlatformActionRepository,
  createActionId,
  createWorkspaceId,
  type ExecuteAuthorization,
  type ExecuteControlAuthorization,
  type ExecuteSupabaseClient,
  type PlatformAction,
} from "@/platform/actions";
import { SupabasePortfolioDecisionRepository } from "@/features/portfolio-intelligence";

export type ExecuteRuntime = Readonly<{
  service: ExecutePlanApplicationService;
  controls: ExecuteControlsService;
  controlRepository: SupabaseExecuteControlRepository;
  activity: SupabaseExecuteActivityRepository;
  authorization: ExecuteAuthorization;
  controlAuthorization: ExecuteControlAuthorization;
  decisions: SupabasePortfolioDecisionRepository;
  actor: Readonly<{ type: "user"; id: string }>;
  workspaceId: string;
}>;
export type ExecuteRuntimeResult =
  | Readonly<{ ok: true; runtime: ExecuteRuntime }>
  | Readonly<{
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "WORKSPACE_UNAVAILABLE"
        | "DEPENDENCY_UNAVAILABLE";
      message: string;
    }>;

// AUTH-012 Phase 3: a role-based decision that currently allows the actor to
// touch this action is checked a second time against the originating
// module's own required privilege, if the action carries one (see AUTH-012
// Phase 2, execute-application.ts's actionFromProposal -- today this is
// only ever set on actions activated from a portfolio decision). Whether a
// mismatch actually denies the request, or is only logged, is controlled by
// AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED (default off, matching
// this codebase's existing kill-switch convention, e.g.
// AUTOMATION_WORKSPACE_KILL_SWITCH) -- this branch has not yet been
// deployed, so there is no real mismatch telemetry yet to justify
// unconditional enforcement; the flag lets enforcement ship now without
// forcing that decision blind, and gives an instant, deploy-free rollback if
// real traffic surfaces a mapping problem once it's flipped on. An action
// with more than one source carrying different requiredPrivilege values is
// not a case that exists today (every producer stamps exactly one source
// per action) -- picking the first one found is a placeholder, not a
// resolved design, if that ever changes.
function auth012EnforcementEnabled(): boolean {
  return process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED === "true";
}
async function evaluateInheritedPrivilege(
  input: Readonly<{
    action: PlatformAction;
    operation: "work" | "review" | "manage";
    subjectId: string;
    workspaceId: string;
  }>,
): Promise<boolean> {
  const requiredPrivilege = input.action.sources.find(
    (source) => source.requiredPrivilege,
  )?.requiredPrivilege;
  if (!requiredPrivilege) return true;
  const enforcing = auth012EnforcementEnabled();
  try {
    const decision = await evaluatePrivilege(
      createAdminClient() as unknown as PlatformAccessClient,
      {
        subjectId: input.subjectId,
        workspaceId: input.workspaceId,
        privilegeId: requiredPrivilege as PrivilegeId,
      },
    );
    if (!decision.allowed) {
      console.warn(
        enforcing
          ? "auth012_inherited_privilege_denied"
          : "auth012_inherited_privilege_mismatch",
        {
          actionId: input.action.id.value,
          operation: input.operation,
          requiredPrivilege,
          subjectId: input.subjectId,
          workspaceId: input.workspaceId,
          reasonCode: decision.reasonCode,
          enforced: enforcing,
        },
      );
      return !enforcing;
    }
    return true;
  } catch (error) {
    console.warn("auth012_inherited_privilege_check_failed", {
      actionId: input.action.id.value,
      operation: input.operation,
      requiredPrivilege,
      error: error instanceof Error ? error.message : "unknown",
      enforced: enforcing,
    });
    return !enforcing;
  }
}

export async function composeExecuteRuntime(workspaceId?: string): Promise<ExecuteRuntimeResult> {
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return {
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Sign in before using Execute.",
      };
    const team = new SupabaseTeamAccessRepository();
    let access;
    try {
      access = await resolveWorkspaceAccessContext(team, user.id, workspaceId);
    } catch {
      return {
        ok: false,
        code: "WORKSPACE_UNAVAILABLE",
        message: "An active workspace is required to use Execute.",
      };
    }
    const members = await team.members(access);
    const actor = { type: "user" as const, id: user.id };
    const database = client as unknown as ExecuteSupabaseClient;
    const plans = new SupabaseExecutePlanRepository(database);
    const activity = new SupabaseExecuteActivityRepository(database);
    const canonical = new SupabasePlatformActionRepository(
      client as unknown as ConstructorParameters<
        typeof SupabasePlatformActionRepository
      >[0],
    );
    const canProperty = (propertyId: string) =>
      access.propertyAccess.type === "all" ||
      (access.propertyAccess.type === "selected" &&
        access.propertyAccess.propertyIds.includes(propertyId));
    // PA-005: transitional, additive-only migration onto PA-001 privileges.
    // The existing hardcoded-role-list/assignee checks below keep deciding
    // access exactly as they do today -- a PA-001 grant can only ever
    // extend them, never replace or narrow them. See
    // authorizeWithLegacyFallback for the shared rationale.
    const withPrivilegeFallback = (
      legacyAllowed: boolean,
      privilegeId: PrivilegeId,
    ) =>
      legacyAllowed
        ? Promise.resolve(true)
        : authorizeWithLegacyFallback({
            client: createAdminClient() as unknown as PlatformAccessClient,
            subjectId: access.profileId,
            workspaceId: access.workspaceId,
            privilegeId,
            legacyAllowed,
          });
    const authorization: ExecuteAuthorization = {
      canManagePlans: async (input) => {
        if (
          input.workspaceId !== access.workspaceId ||
          input.actor.id !== user.id
        )
          return false;
        const legacyAllowed = ["owner", "administrator", "operator"].includes(
          access.role,
        );
        return withPrivilegeFallback(
          legacyAllowed,
          PRIVILEGE_IDS.actionsActionDismiss,
        );
      },
      canAccessProperty: async (input) =>
        input.workspaceId === access.workspaceId &&
        input.actor.id === user.id &&
        canProperty(input.propertyId),
      canAssign: async (input) => {
        if (
          input.workspaceId !== access.workspaceId ||
          input.actor.id !== user.id
        )
          return false;
        const legacyAllowed = (() => {
          if (input.propertyId && !canProperty(input.propertyId))
            return false;
          if (!input.owner) return true;
          if (input.owner.type !== "user")
            return ["team", "system", "automation"].includes(
              input.owner.type,
            );
          return Boolean(
            input.owner.id &&
              members.some(
                (member) =>
                  member.profileId === input.owner?.id &&
                  member.status === "active" &&
                  (input.propertyId === undefined ||
                    member.propertyAccess.type === "all" ||
                    (member.propertyAccess.type === "selected" &&
                      member.propertyAccess.propertyIds.includes(
                        input.propertyId,
                      ))),
              ),
          );
        })();
        return withPrivilegeFallback(
          legacyAllowed,
          PRIVILEGE_IDS.actionsActionAssign,
        );
      },
    };
    const unitOfWork = new SupabaseExecuteUnitOfWork({
      client: database,
      plans,
      actions: canonical,
      activity,
    });
    let sequence = 0;
    const createId = () => `execute-${crypto.randomUUID()}-${++sequence}`;
    const service = new ExecutePlanApplicationService({
      unitOfWork,
      authorization,
      createId,
      now: () => new Date(),
    });
    const controlAuthorization: ExecuteControlAuthorization = {
      canWork: async ({ workspaceId, action, actor: commandActor }) => {
        if (workspaceId !== access.workspaceId || commandActor.id !== user.id)
          return false;
        const legacyAllowed = Boolean(
          action.activeAssignment?.assigneeId === user.id ||
            action.owner.id === user.id ||
            ["owner", "administrator", "operator"].includes(access.role),
        );
        const decision = await withPrivilegeFallback(
          legacyAllowed,
          PRIVILEGE_IDS.actionsActionExecute,
        );
        if (!decision) return false;
        return evaluateInheritedPrivilege({
          action,
          operation: "work",
          subjectId: access.profileId,
          workspaceId: access.workspaceId,
        });
      },
      canReview: async ({ workspaceId, action, actor: commandActor }) => {
        if (workspaceId !== access.workspaceId || commandActor.id !== user.id)
          return false;
        const legacyAllowed = ["owner", "administrator", "operator"].includes(
          access.role,
        );
        const decision = await withPrivilegeFallback(
          legacyAllowed,
          PRIVILEGE_IDS.actionsActionApprove,
        );
        if (!decision) return false;
        return evaluateInheritedPrivilege({
          action,
          operation: "review",
          subjectId: access.profileId,
          workspaceId: access.workspaceId,
        });
      },
      canManage: async ({ workspaceId, action, actor: commandActor }) => {
        if (workspaceId !== access.workspaceId || commandActor.id !== user.id)
          return false;
        const legacyAllowed = ["owner", "administrator", "operator"].includes(
          access.role,
        );
        const decision = await withPrivilegeFallback(
          legacyAllowed,
          PRIVILEGE_IDS.actionsActionDismiss,
        );
        if (!decision) return false;
        return evaluateInheritedPrivilege({
          action,
          operation: "manage",
          subjectId: access.profileId,
          workspaceId: access.workspaceId,
        });
      },
      canAccessDependency: async ({
        workspaceId,
        actionId,
        actor: commandActor,
      }) =>
        workspaceId === access.workspaceId &&
        commandActor.id === user.id &&
        Boolean(
          await canonical.findById({
            workspaceId: createWorkspaceId(access.workspaceId),
            actionId: createActionId(actionId),
          }),
        ),
    };
    const controlRepository = new SupabaseExecuteControlRepository(
      database,
      canonical,
    );
    const controls = new ExecuteControlsService({
      repository: controlRepository,
      authorization: controlAuthorization,
      createId,
    });
    return {
      ok: true,
      runtime: Object.freeze({
        service,
        controls,
        controlRepository,
        activity,
        authorization,
        controlAuthorization,
        decisions: new SupabasePortfolioDecisionRepository(),
        actor,
        workspaceId: access.workspaceId,
      }),
    };
  } catch {
    return {
      ok: false,
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Execute is temporarily unavailable. No records were changed.",
    };
  }
}

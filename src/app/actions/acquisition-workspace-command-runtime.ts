import "server-only";
import { revalidatePath } from "next/cache";
import {
  createAcquisitionServerCommandBoundary,
  createFailClosedAcquisitionCommandRegistry,
  type AcquisitionServerIdentity,
} from "@/features/investment-opportunity/acquisition-server";
import { noopAcquisitionObservability } from "@/features/investment-opportunity/acquisition-pipeline";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";

// Security fix (flagged during PA-004 research, task_d18a93cd): the previous
// identity/authorization pair checked a global profiles.role (not workspace
// membership) and then compared the resolved actor against itself
// (`actor.id === ownerId`, where `ownerId` was set to `actor.id` moments
// earlier) -- a tautology that always passed regardless of the target
// opportunity's real workspace or the caller's role/property scope. This
// boundary is currently inert (createFailClosedAcquisitionCommandRegistry
// marks every command "not-verified", so no command can execute yet), but
// the check needed to be correct before anything is ever turned on. Reuses
// the same authorizeOpportunity primitive the rest of Investment Analysis
// already relies on (src/app/actions/investment-opportunity-runtime.ts).
export function createProductionAcquisitionServerCommandBoundary() {
  let context: Awaited<ReturnType<typeof getInvestmentOpportunityRequestContext>> | null = null;
  return createAcquisitionServerCommandBoundary({
    identities: {
      resolve: async (): Promise<AcquisitionServerIdentity> => {
        context = await getInvestmentOpportunityRequestContext();
        if (!context.ok) return { authenticated: false };
        return { authenticated: true, actor: { type: "user", id: context.actorId }, ownerId: context.workspaceId };
      },
    },
    authorization: {
      authorize: async ({ opportunityId }) => {
        if (!context?.ok) return { allowed: false, conceal: true };
        const allowed = await context.authorizeOpportunity(opportunityId, "opportunity.modify");
        return { allowed, conceal: false };
      },
    },
    deployment: createFailClosedAcquisitionCommandRegistry(),
    dispatcher: {
      execute: async () => {
        throw new Error("Acquisition commands are not remotely verified.");
      },
    },
    revalidator: {
      revalidate: async (paths) => { for (const path of paths) revalidatePath(path); },
    },
    clock: { now: () => new Date(), monotonicNow: () => performance.now() },
    correlationId: () => crypto.randomUUID(),
    telemetry: {
      record: (entry) => {
        noopAcquisitionObservability.log("acquisition.command", {
          commandType: entry.commandType,
          commandId: entry.commandId,
          correlationId: entry.correlationId,
          actorId: entry.actorId,
          ownerId: entry.ownerId,
          opportunityId: entry.opportunityId,
          pipelineId: entry.pipelineId,
          expectedVersion: entry.expectedVersion,
          status: entry.status,
          durationMs: entry.durationMs,
          replayed: entry.replayed,
          revalidationTargetCount: entry.revalidationTargetCount,
        });
      },
    },
  });
}

import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createAcquisitionServerCommandBoundary,
  createFailClosedAcquisitionCommandRegistry,
  type AcquisitionServerIdentity,
} from "@/features/investment-opportunity/acquisition-server";
import { noopAcquisitionObservability } from "@/features/investment-opportunity/acquisition-pipeline";

export function createProductionAcquisitionServerCommandBoundary() {
  return createAcquisitionServerCommandBoundary({
    identities: {
      resolve: async (): Promise<AcquisitionServerIdentity> => {
        try {
          const { user } = await requireRole(["admin", "owner"]);
          return { authenticated: true, actor: { type: "user", id: user.id }, ownerId: user.id };
        } catch {
          return { authenticated: false };
        }
      },
    },
    authorization: {
      authorize: async ({ actor, ownerId }) => ({ allowed: actor.id === ownerId, conceal: actor.id !== ownerId }),
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

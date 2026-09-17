import {
  PlatformAction,
  createActionHistoryId,
  createActionId,
  createWorkspaceId,
} from "@/platform/actions";

/**
 * LHS-OPS-005: the sole adapter that shapes a Hospitable booking exception
 * as an Action Center task. Pure by design (PF-009 boundary: features may
 * build `PlatformAction` domain objects but must not wire the repository
 * themselves — see tests/architecture/platform-action-provider.test.ts).
 * The caller resolves the workspace and persists via the sanctioned
 * composition point (mirroring src/app/actions/action-center-runtime.ts).
 */
export function buildBookingExceptionAction(
  input: Readonly<{
    workspaceId: string;
    issueType: string;
    reservationExternalId: string | null;
    propertyId: string;
    occurredAt?: Date;
  }>,
): PlatformAction {
  const occurredAt = input.occurredAt ?? new Date();
  const actor = { type: "automation" as const, id: "hospitable-direct-booking" };
  const idempotentId = `booking-exception:${input.issueType}:${input.reservationExternalId ?? input.propertyId}`;

  return PlatformAction.createDraft({
    id: createActionId(idempotentId),
    creationHistoryId: createActionHistoryId(`${idempotentId}-created`),
    workspaceId: createWorkspaceId(input.workspaceId),
    title: "Review a Mesa direct-booking exception",
    description: `A Hospitable reservation event could not be safely reconciled (${input.issueType}${input.reservationExternalId ? `, reservation ${input.reservationExternalId}` : ""}). Review in the booking exception queue before it is resolved automatically.`,
    actionType: "booking.exception",
    priority: "high",
    owner: { type: "system", id: "mesa-direct-booking" },
    sources: [
      {
        type: "automation",
        sourceId: input.reservationExternalId ?? input.propertyId,
        capability: "mesa-direct-booking",
        recordedAt: occurredAt,
        recordedBy: actor,
      },
    ],
    createdAt: occurredAt,
    createdBy: actor,
  });
}

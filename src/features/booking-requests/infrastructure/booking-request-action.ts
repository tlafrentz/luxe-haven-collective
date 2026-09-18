import {
  PlatformAction,
  createActionHistoryId,
  createActionId,
  createWorkspaceId,
} from "@/platform/actions";

/**
 * LHS-OPS-001: every submitted request creates an Action Center item. Pure
 * builder (PF-009 boundary — see tests/architecture/platform-action-provider.test.ts):
 * the caller resolves workspaceId and persists via the sanctioned
 * composition point, same convention as buildBookingExceptionAction in
 * src/features/integrations/hospitable/lib/booking-exception-action.ts.
 */
export function buildBookingRequestReviewAction(
  input: Readonly<{
    workspaceId: string;
    bookingRequestId: string;
    propertyName: string;
    arrival: string;
    departure: string;
    slaDueAt: string;
    occurredAt?: Date;
  }>,
): PlatformAction {
  const occurredAt = input.occurredAt ?? new Date();
  const actor = { type: "automation" as const, id: "mesa-booking-request" };
  const idempotentId = `booking-request-review:${input.bookingRequestId}`;

  return PlatformAction.createDraft({
    id: createActionId(idempotentId),
    creationHistoryId: createActionHistoryId(`${idempotentId}-created`),
    workspaceId: createWorkspaceId(input.workspaceId),
    title: `Review stay request — ${input.propertyName}, ${input.arrival} to ${input.departure}`,
    description: `A guest requested ${input.arrival}–${input.departure} at ${input.propertyName}. Check the shared calendar workflow (including Hospitable) for conflicts, then approve for block, propose alternate dates, or decline. Due ${input.slaDueAt}.`,
    actionType: "booking-request.review",
    priority: "high",
    owner: { type: "system", id: "mesa-booking-requests" },
    sources: [
      {
        type: "automation",
        sourceId: input.bookingRequestId,
        capability: "mesa-booking-request",
        recordedAt: occurredAt,
        recordedBy: actor,
      },
    ],
    createdAt: occurredAt,
    createdBy: actor,
  });
}

/** LHS-BLK-005: decline/withdrawal/expiry/payment-failure creates an owned
 * block-release task rather than silently leaving the hold in place. */
export function buildBlockReleaseAction(
  input: Readonly<{
    workspaceId: string;
    bookingRequestId: string;
    calendarBlockId: string;
    propertyName: string;
    reason: string;
    occurredAt?: Date;
  }>,
): PlatformAction {
  const occurredAt = input.occurredAt ?? new Date();
  const actor = { type: "automation" as const, id: "mesa-booking-request" };
  const idempotentId = `booking-request-block-release:${input.calendarBlockId}`;

  return PlatformAction.createDraft({
    id: createActionId(idempotentId),
    creationHistoryId: createActionHistoryId(`${idempotentId}-created`),
    workspaceId: createWorkspaceId(input.workspaceId),
    title: `Release calendar block — ${input.propertyName}`,
    description: `The request this block was holding for is now terminal (${input.reason}) without confirming. Release the hold in the operational calendar and record the outcome.`,
    actionType: "booking-request.block-release",
    priority: "high",
    owner: { type: "system", id: "mesa-booking-requests" },
    sources: [
      {
        type: "automation",
        sourceId: input.calendarBlockId,
        capability: "mesa-booking-request",
        recordedAt: occurredAt,
        recordedBy: actor,
      },
    ],
    createdAt: occurredAt,
    createdBy: actor,
  });
}

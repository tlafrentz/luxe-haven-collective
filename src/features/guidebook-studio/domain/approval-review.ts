export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "superseded";

export type ApprovalRequestInput = Readonly<{
  id: string;
  guidebookId: string;
  draftRevision: number;
  requestedBy: string;
  status: ApprovalRequestStatus;
  decisionNote?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}>;

export type ReviewCommentInput = Readonly<{
  id: string;
  approvalRequestId: string;
  sectionKey?: string | null;
  comment: string;
  authorId: string;
  createdAt: string;
}>;

/**
 * A pending request is "stale" once the guidebook's working draft has moved
 * on to a later revision than the one the customer was asked to review —
 * their pending decision no longer applies to what's currently in the draft.
 */
export function isApprovalRequestStale(
  request: ApprovalRequestInput,
  currentDraftRevision: number,
): boolean {
  return request.status === "pending" && currentDraftRevision > request.draftRevision;
}

export function latestApprovalRequest(
  requests: readonly ApprovalRequestInput[],
): ApprovalRequestInput | null {
  if (!requests.length) return null;
  return [...requests].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )[0];
}

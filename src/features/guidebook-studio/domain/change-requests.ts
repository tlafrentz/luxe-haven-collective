export type ChangeRequestUrgency = "low" | "normal" | "high";
export type ChangeRequestStatus = "open" | "in_progress" | "resolved" | "declined";

export type ChangeRequestInput = Readonly<{
  id: string;
  guidebookId: string;
  sectionKey?: string | null;
  description: string;
  replacementContent?: string | null;
  imageUrls: readonly string[];
  urgency: ChangeRequestUrgency;
  status: ChangeRequestStatus;
  requestedBy: string;
  createdAt: string;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
}>;

export type ChangeRequestSummary = Readonly<{
  open: number;
  inProgress: number;
  resolved: number;
  declined: number;
  highUrgencyOpen: number;
}>;

export function summarizeChangeRequests(
  requests: readonly ChangeRequestInput[],
): ChangeRequestSummary {
  return Object.freeze({
    open: requests.filter((item) => item.status === "open").length,
    inProgress: requests.filter((item) => item.status === "in_progress").length,
    resolved: requests.filter((item) => item.status === "resolved").length,
    declined: requests.filter((item) => item.status === "declined").length,
    highUrgencyOpen: requests.filter(
      (item) => item.status === "open" && item.urgency === "high",
    ).length,
  });
}

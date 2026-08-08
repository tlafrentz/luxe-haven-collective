import {
  assignGuidebookProducerAction,
  resolveChangeRequestAction,
} from "@/app/actions/guidebook-change-requests";
import { requestCustomerApprovalAction } from "@/app/actions/guidebook-approval-review";
import type {
  ApprovalRequestInput,
  ChangeRequestInput,
  ReviewCommentInput,
} from "@/features/guidebook-studio";

const statusTone: Record<ChangeRequestInput["status"], string> = {
  open: "bg-amber-50 text-amber-900",
  in_progress: "bg-blue-50 text-blue-900",
  resolved: "bg-emerald-50 text-emerald-800",
  declined: "bg-stone-100 text-stone-600",
};

const approvalTone: Record<ApprovalRequestInput["status"], string> = {
  pending: "bg-amber-50 text-amber-900",
  approved: "bg-emerald-50 text-emerald-800",
  changes_requested: "bg-rose-50 text-rose-800",
  superseded: "bg-stone-100 text-stone-600",
};

export function AdminGuidebookProductionPanel({
  guidebookId,
  authoringMode,
  producerId,
  targetPublishDate,
  producers,
  requests,
  approvalRequest,
  approvalComments,
}: {
  guidebookId: string;
  authoringMode: string;
  producerId: string | null;
  targetPublishDate: string | null;
  producers: readonly { id: string; name: string }[];
  requests: readonly ChangeRequestInput[];
  approvalRequest: ApprovalRequestInput | null;
  approvalComments: readonly ReviewCommentInput[];
}) {
  return (
    <section className="grid gap-6 rounded-2xl border bg-white p-6 lg:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Production assignment
        </p>
        <form action={assignGuidebookProducerAction} className="mt-4 space-y-4">
          <input type="hidden" name="guidebookId" value={guidebookId} />
          <label className="block text-sm font-medium text-stone-700">
            Authoring mode
            <select
              name="authoringMode"
              defaultValue={authoringMode}
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            >
              <option value="self">Self-authoring (customer edits directly)</option>
              <option value="managed">Managed service (Luxe Haven produces it)</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Assigned producer
            <select
              name="producerId"
              defaultValue={producerId ?? ""}
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            >
              <option value="">Unassigned</option>
              {producers.map((producer) => (
                <option key={producer.id} value={producer.id}>
                  {producer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Target publish date
            <input
              type="date"
              name="targetPublishDate"
              defaultValue={targetPublishDate ?? ""}
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
          </label>
          <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Save assignment
          </button>
        </form>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Open change requests
        </p>
        {requests.length ? (
          <ol className="mt-4 space-y-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-xl border border-stone-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-800">
                    {request.sectionKey || "General"} ·{" "}
                    <span className="capitalize text-stone-500">
                      {request.urgency} urgency
                    </span>
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusTone[request.status]}`}
                  >
                    {request.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {request.description}
                </p>
                {request.replacementContent ? (
                  <p className="mt-2 rounded-lg bg-stone-50 p-3 text-xs text-stone-700">
                    {request.replacementContent}
                  </p>
                ) : null}
                {request.status === "open" || request.status === "in_progress" ? (
                  <form
                    action={resolveChangeRequestAction}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="guidebookId" value={guidebookId} />
                    <input
                      name="resolutionNote"
                      placeholder="Note back to the customer (optional)"
                      className="min-w-[16rem] flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs"
                    />
                    {request.status === "open" ? (
                      <button
                        name="status"
                        value="in_progress"
                        className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                      >
                        Start work
                      </button>
                    ) : null}
                    <button
                      name="status"
                      value="resolved"
                      className="rounded-full bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Mark resolved
                    </button>
                    <button
                      name="status"
                      value="declined"
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                    >
                      Decline
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-stone-500">
            No change requests from the customer yet.
          </p>
        )}
      </div>
      <div className="lg:col-span-2 border-t border-stone-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Customer approval
          </p>
          {approvalRequest ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${approvalTone[approvalRequest.status]}`}
            >
              {approvalRequest.status.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
        {approvalRequest?.status === "pending" ? (
          <p className="mt-2 text-sm text-stone-600">
            Waiting on the customer to review draft revision{" "}
            {approvalRequest.draftRevision}, requested{" "}
            {new Date(approvalRequest.createdAt).toLocaleDateString()}.
          </p>
        ) : approvalRequest?.status === "approved" ? (
          <p className="mt-2 text-sm text-emerald-800">
            Approved {new Date(approvalRequest.decidedAt ?? approvalRequest.createdAt).toLocaleDateString()}.
            {approvalRequest.decisionNote ? ` "${approvalRequest.decisionNote}"` : ""}
          </p>
        ) : approvalRequest?.status === "changes_requested" ? (
          <p className="mt-2 text-sm text-rose-800">
            Changes requested{" "}
            {new Date(approvalRequest.decidedAt ?? approvalRequest.createdAt).toLocaleDateString()}.
            {approvalRequest.decisionNote ? ` "${approvalRequest.decisionNote}"` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            No approval requested yet.
          </p>
        )}
        {approvalComments.length ? (
          <ol className="mt-3 space-y-2">
            {approvalComments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg bg-stone-50 p-3 text-xs text-stone-700"
              >
                <span className="font-semibold">
                  {comment.sectionKey || "General"}:
                </span>{" "}
                {comment.comment}
              </li>
            ))}
          </ol>
        ) : null}
        {!approvalRequest || approvalRequest.status !== "pending" ? (
          <form action={requestCustomerApprovalAction} className="mt-4">
            <input type="hidden" name="guidebookId" value={guidebookId} />
            <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
              Request customer approval
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

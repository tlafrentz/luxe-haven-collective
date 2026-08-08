"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  decideGuidebookApprovalAction,
  submitReviewCommentAction,
  type SubmitReviewCommentState,
} from "@/app/actions/guidebook-approval-review";
import { SubmitButton } from "@/components/forms/submit-button";
import type {
  ApprovalRequestInput,
  ReviewCommentInput,
} from "@/features/guidebook-studio";

const initialState: SubmitReviewCommentState = {};

export function GuidebookApprovalReviewPanel({
  guidebookId,
  workspaceId,
  request,
  comments,
}: {
  guidebookId: string;
  workspaceId: string;
  request: ApprovalRequestInput;
  comments: readonly ReviewCommentInput[];
}) {
  const [state, action] = useActionState(submitReviewCommentAction, initialState);

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
        Ready for your review
      </p>
      <h2 className="mt-2 text-2xl font-semibold">
        Your guidebook is ready for approval.
      </h2>
      <p className="mt-2 text-sm text-stone-700">
        Preview the guest experience below, leave comments on anything that
        needs a change, then approve it or ask for revisions.
      </p>

      <Link
        href={`/dashboard/guidebooks/${guidebookId}/preview?mode=draft`}
        className="mt-4 inline-flex rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Open guest preview →
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Comments
          </p>
          {comments.length ? (
            <ol className="mt-3 space-y-3">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-xl border border-stone-200 bg-white p-4"
                >
                  <p className="text-xs font-semibold text-stone-500">
                    {comment.sectionKey || "General"}
                  </p>
                  <p className="mt-1 text-sm text-stone-700">
                    {comment.comment}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No comments yet.</p>
          )}

          {state.message ? (
            <div
              className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
                state.ok
                  ? "border-emerald-200 bg-white text-emerald-800"
                  : "border-red-200 bg-white text-red-700"
              }`}
            >
              {state.message}
            </div>
          ) : null}
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="guidebookId" value={guidebookId} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input
              type="hidden"
              name="approvalRequestId"
              value={request.id}
            />
            <label className="block text-sm font-medium text-stone-700">
              Section (optional)
              <input
                name="sectionKey"
                placeholder="e.g. Wi-Fi, Arrival, Local favorites"
                className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Add a comment
              <textarea
                name="comment"
                required
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <SubmitButton>Add comment</SubmitButton>
          </form>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Your decision
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Approving locks in this exact draft revision (rev.{" "}
            {request.draftRevision}) for publication.
          </p>
          <form action={decideGuidebookApprovalAction} className="mt-4 space-y-3">
            <input type="hidden" name="guidebookId" value={guidebookId} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="approvalRequestId" value={request.id} />
            <label className="block text-sm font-medium text-stone-700">
              Note (optional)
              <textarea
                name="decisionNote"
                rows={2}
                placeholder="Anything specific for the Luxe Haven team?"
                className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                name="decision"
                value="approved"
                className="rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Approve
              </button>
              <button
                name="decision"
                value="changes_requested"
                className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold"
              >
                Request changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

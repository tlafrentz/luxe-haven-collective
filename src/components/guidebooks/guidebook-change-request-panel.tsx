"use client";

import { useActionState } from "react";
import {
  submitGuidebookChangeRequestAction,
  type SubmitChangeRequestState,
} from "@/app/actions/guidebook-change-requests";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ChangeRequestInput } from "@/features/guidebook-studio";

const initialState: SubmitChangeRequestState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-700">{errors[0]}</p>;
}

const statusTone: Record<ChangeRequestInput["status"], string> = {
  open: "bg-amber-50 text-amber-900",
  in_progress: "bg-blue-50 text-blue-900",
  resolved: "bg-emerald-50 text-emerald-800",
  declined: "bg-stone-100 text-stone-600",
};

export function GuidebookChangeRequestPanel({
  guidebookId,
  workspaceId,
  requests,
}: {
  guidebookId: string;
  workspaceId: string;
  requests: readonly ChangeRequestInput[];
}) {
  const [state, action] = useActionState(
    submitGuidebookChangeRequestAction,
    initialState,
  );

  return (
    <section className="rounded-3xl border bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        Managed service
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Request a change</h2>
      <p className="mt-2 text-sm text-stone-600">
        Your guidebook is produced by the Luxe Haven team. Describe what
        you&apos;d like changed, and it&apos;ll appear in our production
        queue.
      </p>

      {state.message ? (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="guidebookId" value={guidebookId} />
        <input type="hidden" name="workspaceId" value={workspaceId} />

        <label className="block text-sm font-medium text-stone-700">
          Section (optional)
          <input
            name="sectionKey"
            placeholder="e.g. Wi-Fi, Arrival, Local favorites"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none ring-brass/20 focus:ring-4"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          What would you like changed?
          <textarea
            name="description"
            required
            rows={4}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none ring-brass/20 focus:ring-4"
          />
          <FieldError errors={state.errors?.description} />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Replacement content (optional)
          <textarea
            name="replacementContent"
            rows={3}
            placeholder="Paste the exact text you'd like used, if you have it."
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none ring-brass/20 focus:ring-4"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Urgency
          <select
            name="urgency"
            defaultValue="normal"
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none ring-brass/20 focus:ring-4"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        <SubmitButton>Submit to Luxe Haven</SubmitButton>
      </form>

      {requests.length ? (
        <div className="mt-8 border-t border-stone-200 pt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Your requests
          </p>
          <ol className="mt-4 space-y-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-xl border border-stone-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-800">
                    {request.sectionKey || "General"}
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
                {request.resolutionNote ? (
                  <p className="mt-2 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
                    <span className="font-semibold">Luxe Haven: </span>
                    {request.resolutionNote}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-stone-400">
                  Submitted {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

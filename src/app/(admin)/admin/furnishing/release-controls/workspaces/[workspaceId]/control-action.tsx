"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReleaseControlV2 } from "../../../activation/actions";
import {
  capabilityLabel,
  validateControlReason,
  type ReleaseCapability,
} from "@/features/furnishing-studio/release-controls";
export default function ControlAction({
  action,
  workspaceId,
  capability,
  releaseVersion,
  targetVersion,
  policyVersion,
  disabledReason,
}: {
  action: "disable" | "recover_workspace";
  workspaceId: string;
  capability?: ReleaseCapability;
  releaseVersion: number;
  targetVersion: number;
  policyVersion: string;
  disabledReason?: string | null;
}) {
  const router = useRouter(),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [resolution, setResolution] = useState(""),
    [message, setMessage] = useState(""),
    [busy, startTransition] = useTransition();
  const recovery = action === "recover_workspace",
    label = recovery
      ? "Begin governed workspace recovery"
      : `Prepare rollback for ${capability ? capabilityLabel(capability) : "capability"}`;
  async function submit() {
    const error = validateControlReason(reason);
    if (error) {
      setMessage(error);
      return;
    }
    if (recovery && validateControlReason(resolution)) {
      setMessage("Document how the triggering risk was resolved or accepted.");
      return;
    }
    const result = await submitReleaseControlV2({
      action,
      workspaceId,
      ...(capability ? { capability } : {}),
      expectedReleaseVersion: releaseVersion,
      expectedTargetVersion: targetVersion,
      policyVersion,
      reason,
      correlationId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      ...(recovery ? { riskResolution: resolution } : {}),
    });
    setMessage(
      result.ok
        ? "Authoritative state updated."
        : `${result.code}: ${result.message}`,
    );
    if (result.ok) {
      setOpen(false);
      startTransition(() => router.refresh());
    }
  }
  return (
    <div>
      {disabledReason ? (
        <p className="text-sm text-amber-900">Unavailable: {disabledReason}</p>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-xl border border-stone-400 px-4 font-semibold"
        >
          {label}…
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-sm">
        {busy ? "Refreshing authoritative state…" : message}
      </p>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="control-action-title"
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <section className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 id="control-action-title" className="text-xl font-semibold">
              {label}
            </h2>
            <p className="mt-2 text-sm">
              {recovery
                ? "The safety control returns to a reconciled state. Capabilities are not enabled automatically and require fresh verification."
                : "Rollback prevents new authorized use and preserves every lifecycle and audit record."}
            </p>
            <label
              htmlFor="control-action-reason"
              className="mt-5 block font-semibold"
            >
              Required reason
            </label>
            <textarea
              id="control-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={12}
              maxLength={500}
              className="mt-2 min-h-24 w-full rounded-xl border p-3"
            />
            {recovery ? (
              <>
                <label
                  htmlFor="control-risk-resolution"
                  className="mt-4 block font-semibold"
                >
                  Risk resolution
                </label>
                <textarea
                  id="control-risk-resolution"
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  minLength={12}
                  maxLength={500}
                  className="mt-2 min-h-24 w-full rounded-xl border p-3"
                />
              </>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                autoFocus
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-xl border px-4 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="min-h-11 rounded-xl bg-stone-900 px-4 font-semibold text-white"
              >
                {recovery
                  ? "Authorize workspace recovery"
                  : "Disable capability"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

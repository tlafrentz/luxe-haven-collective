"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReleaseControlV2 } from "../activation/actions";
import { validateControlReason } from "@/features/furnishing-studio/release-controls";
export default function GlobalEmergencyControl({
  version,
  engaged,
  suspended,
}: {
  releaseId: string;
  version: number;
  engaged: boolean;
  suspended: boolean;
}) {
  const router = useRouter(),
    [action, setAction] = useState<"suspend" | "recover" | null>(null),
    [reason, setReason] = useState(""),
    [resolution, setResolution] = useState(""),
    [message, setMessage] = useState(""),
    [busy, startTransition] = useTransition();
  async function submit() {
    const error = validateControlReason(reason);
    if (error) {
      setMessage(error);
      return;
    }
    if (action === "recover" && validateControlReason(resolution)) {
      setMessage(
        "Document how the triggering risk was resolved or formally accepted.",
      );
      return;
    }
    const result = await submitReleaseControlV2({
      action: action === "recover" ? "recover_global" : "suspend_global",
      expectedReleaseVersion: version,
      expectedTargetVersion: version,
      policyVersion: "fs008a-v1",
      reason,
      correlationId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      ...(action === "recover" ? { riskResolution: resolution } : {}),
    });
    setMessage(
      result.ok
        ? `Global furnishing release ${action === "recover" ? "returned to its protected state" : "is suspended"}.`
        : `${result.code}: ${result.message}`,
    );
    if (result.ok) {
      setAction(null);
      startTransition(() => router.refresh());
    }
  }
  return (
    <section className="rounded-2xl border border-red-300 bg-red-50 p-5">
      <h2 className="text-xl font-semibold">Global emergency controls</h2>
      <p className="mt-2 text-sm">
        Global suspension takes precedence over every workspace and capability
        command. Existing evidence remains preserved.
      </p>
      {suspended ? (
        <button
          onClick={() => setAction("recover")}
          className="mt-4 min-h-11 rounded-xl border border-red-800 px-4 font-semibold text-red-900"
        >
          Begin governed global recovery…
        </button>
      ) : engaged ? (
        <p className="mt-4 font-semibold text-red-900">
          Global safety control is intentionally engaged: Protected.
        </p>
      ) : (
        <button
          onClick={() => setAction("suspend")}
          className="mt-4 min-h-11 rounded-xl bg-red-800 px-4 font-semibold text-white"
        >
          Suspend globally…
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-sm">
        {busy ? "Refreshing authoritative state…" : message}
      </p>
      {action ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-action-title"
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setAction(null);
          }}
        >
          <section className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 id="global-action-title" className="text-xl font-semibold">
              {action === "recover"
                ? "Recover to protected internal state"
                : "Suspend the global furnishing release"}
            </h2>
            <p className="mt-2 text-sm">
              Recovery does not enable disabled capabilities. Enabled
              capabilities require deliberate server verification.
            </p>
            <label
              htmlFor="global-action-reason"
              className="mt-5 block font-semibold"
            >
              Required reason
            </label>
            <textarea
              id="global-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={12}
              maxLength={500}
              className="mt-2 min-h-24 w-full rounded-xl border p-3"
            />
            {action === "recover" ? (
              <>
                <label
                  htmlFor="global-risk-resolution"
                  className="mt-4 block font-semibold"
                >
                  Risk resolution
                </label>
                <textarea
                  id="global-risk-resolution"
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
                onClick={() => setAction(null)}
                className="min-h-11 rounded-xl border px-4 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="min-h-11 rounded-xl bg-red-800 px-4 font-semibold text-white"
              >
                {action === "recover"
                  ? "Authorize protected recovery"
                  : "Suspend global furnishing release"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { publishCanonicalGuidebookAction } from "@/app/actions/guidebook-authoring";
import {
  evaluateGuidebookPublicationReadiness,
  type GuidebookDraft,
  type MediaDimensionMap,
} from "@/features/guidebook-studio";
export function GuidebookPublicationControl({
  draft,
  canPublish,
  publicSlug,
  basePath,
  label = "Publish Guidebook",
  mediaDimensions = {},
}: {
  draft: GuidebookDraft;
  canPublish: boolean;
  publicSlug?: string;
  basePath?: string;
  label?: string;
  mediaDimensions?: MediaDimensionMap;
}) {
  const [state, setState] = useState<
      "idle" | "publishing" | "published" | "failed"
    >("idle"),
    [message, setMessage] = useState(""),
    readiness = evaluateGuidebookPublicationReadiness(draft, mediaDimensions);
  async function publish() {
    const commandId = crypto.randomUUID();
    setState("publishing");
    setMessage("");
    try {
      const result = await Promise.race([
        publishCanonicalGuidebookAction({
          workspaceId: draft.workspaceId,
          guidebookId: draft.guidebookId,
          expectedRevision: draft.revision,
          commandId,
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("timeout")), 8000),
        ),
      ]);
      if (result.ok) {
        setState("published");
        setMessage(
          `Version ${result.value.version} is now live for your guests.`,
        );
      } else {
        setState("failed");
        setMessage(result.message);
      }
    } catch {
      setState("failed");
      setMessage(
        "Publishing timed out. The prior active version remains available.",
      );
    }
  }
  if (state === "published")
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-700" />
        <h2 className="mt-5 text-3xl font-semibold">
          Success! Your Guidebook is Live
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Congratulations! Your guidebook is now live and ready for your
          guests.
        </p>
        {message ? (
          <p role="status" className="mt-2 text-xs text-stone-500">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {publicSlug ? (
            <Link
              href={`/stay/${publicSlug}`}
              className="rounded-full bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
            >
              View Guidebook
            </Link>
          ) : null}
          <Link
            href={basePath ?? "/dashboard/guidebooks"}
            className="rounded-full border border-emerald-800 bg-white px-5 py-3 text-sm font-semibold text-emerald-900"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    );
  return (
    <section className="rounded-3xl border bg-white p-6">
      <h2 className="font-semibold">Publish current draft</h2>
      <p className="mt-2 text-sm text-stone-600">
        {readiness.status === "ready"
          ? "The canonical draft is ready."
          : readiness.status === "ready-with-warnings"
            ? "Review the warnings before publishing."
            : "Resolve publication blockers before publishing."}
      </p>
      {readiness.issues.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {readiness.issues.map((issue) => (
            <li key={`${issue.code}:${issue.target}`}>
              <a href={`#${issue.target}`} className="underline">
                {issue.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        onClick={publish}
        disabled={
          !canPublish ||
          readiness.status === "not-ready" ||
          state === "publishing"
        }
        className="mt-5 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {state === "publishing" ? "Publishing…" : label}
      </button>
      {message && state === "failed" ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

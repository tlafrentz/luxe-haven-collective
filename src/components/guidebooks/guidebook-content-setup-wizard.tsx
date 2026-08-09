"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Circle, PartyPopper } from "lucide-react";
import { guidebookAuthoringCommandAction } from "@/app/actions/guidebook-authoring";
import {
  ESSENTIAL_CONTENT_ITEMS,
  essentialContentGuidance,
} from "@/features/guidebook-builder";
import type { GuidebookDraft } from "@/features/guidebook-studio";

function usedComponentKeys(draft: GuidebookDraft) {
  return new Set(
    draft.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.type === "component")
      .map((block) => block.content.componentKey),
  );
}

export function GuidebookContentSetupWizard({
  initialDraft,
  canEdit,
  basePath = "/dashboard/guidebooks",
}: {
  initialDraft: GuidebookDraft;
  canEdit: boolean;
  basePath?: string;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const usedKeys = usedComponentKeys(draft);
  const total = ESSENTIAL_CONTENT_ITEMS.length;
  const item = step < total ? ESSENTIAL_CONTENT_ITEMS[step] : undefined;
  const complete = item
    ? item.componentKeys.every((key) => usedKeys.has(key))
    : false;
  const targetSectionId = draft.sections[0]?.id;
  const editHref = `${basePath}/${draft.guidebookId}/edit`;

  function addItem() {
    if (!item || !canEdit || !targetSectionId) return;
    setError("");
    startTransition(async () => {
      let latest = draft;
      let failed = false;
      for (const componentKey of item.componentKeys) {
        const result = await guidebookAuthoringCommandAction({
          workspaceId: latest.workspaceId,
          guidebookId: latest.guidebookId,
          expectedRevision: latest.revision,
          commandId: crypto.randomUUID(),
          command: {
            type: "create-block",
            sectionId: targetSectionId,
            blockType: "component",
            componentKey,
          },
        });
        if (result?.ok) latest = result.value;
        else failed = true;
      }
      setDraft(latest);
      if (failed)
        setError(
          "Some details couldn't be saved. You can add them in the full editor.",
        );
      else setStep((value) => value + 1);
    });
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
            Guidebook Studio · Setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{draft.title}</h1>
          <p className="mt-2 text-stone-600">
            Add the essentials guests ask about most — this takes about two
            minutes and you can always add more later.
          </p>
        </div>
        <Link
          href={editHref}
          className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold text-stone-600"
        >
          Skip setup
        </Link>
      </header>
      <ol aria-label="Setup progress" className="flex gap-2">
        {ESSENTIAL_CONTENT_ITEMS.map((entry, index) => (
          <li key={entry.key} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${
                index < step
                  ? "bg-emerald-700"
                  : index === step
                    ? "bg-emerald-300"
                    : "bg-stone-200"
              }`}
            />
          </li>
        ))}
      </ol>
      <section className="min-h-[22rem] rounded-2xl border bg-white p-8">
        {item ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Step {step + 1} of {total}
            </p>
            <div className="mt-4 flex items-start gap-3">
              {complete ? (
                <Check className="mt-1 size-6 shrink-0 text-emerald-700" />
              ) : (
                <Circle className="mt-1 size-6 shrink-0 text-stone-300" />
              )}
              <div>
                <h2 className="text-2xl font-semibold">{item.label}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                  {essentialContentGuidance(item.componentKeys[0]) ||
                    "Guests ask about this often — add it now so it's ready before your first check-in."}
                </p>
              </div>
            </div>
            {complete ? (
              <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                Already added. You can edit the details in the full editor.
              </p>
            ) : !targetSectionId ? (
              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Add a section in the full editor first, then come back to add
                this detail.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-4 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <PartyPopper className="size-6" />
            </span>
            <h2 className="mt-6 text-2xl font-semibold">
              You&apos;re off to a great start.
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Open the full editor any time to fine-tune content, add photos,
              or arrange sections before publishing.
            </p>
          </div>
        )}
      </section>
      <footer className="flex justify-between">
        <button
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={!step}
          className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:invisible"
        >
          Back
        </button>
        {item ? (
          <div className="flex gap-2">
            {!complete ? (
              <button
                onClick={() => setStep((value) => value + 1)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Skip for now
              </button>
            ) : null}
            <button
              onClick={complete ? () => setStep((value) => value + 1) : addItem}
              disabled={pending || (!complete && (!canEdit || !targetSectionId))}
              className="rounded-lg bg-emerald-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Adding…" : complete ? "Continue" : "Add details"}
            </button>
          </div>
        ) : (
          <Link
            href={editHref}
            className="rounded-lg bg-emerald-800 px-5 py-2 text-sm font-semibold text-white"
          >
            Open in Guidebook Studio
          </Link>
        )}
      </footer>
    </main>
  );
}

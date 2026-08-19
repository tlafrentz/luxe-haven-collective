"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, Download, Sparkles, TriangleAlert, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  completeCustomerSourceUploadAction,
  enqueueCustomerExtractionAction,
  enqueueCustomerGenerationAction,
  getCustomerCreationProjectionAction,
  prepareCustomerSourceUploadAction,
  reviewCustomerCreationFactAction,
  reviewCustomerCreationSectionAction,
  uploadCustomerCreationSourceAction,
} from "@/app/actions/guidebook-ai-creation";
import { getGuidebookWorkspaceBrandDefaultsAction } from "@/app/actions/guidebook-brand-defaults";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const SERVER_ACTION_BYTES = 4 * 1024 * 1024;
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const mediaTypeFor = (file: File) =>
  /\.(md|markdown)$/i.test(file.name) ? "text/plain" : file.type || "application/octet-stream";

/** Persistent trust-principle banner shown throughout the AI auto-create path. */
export function AiTrustBanner() {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
      <div>
        <p className="font-semibold">AI creates a draft. Humans review. Nothing auto-publishes.</p>
        <p className="mt-1 text-emerald-900">Your guidebook stays a draft until your team confirms it and submits it for review.</p>
      </div>
    </div>
  );
}

export function AiUploadStep({
  workspaceId,
  propertyId,
  jobId,
  sourceCount,
  onUploaded,
  error,
  setError,
}: Readonly<{
  workspaceId: string;
  propertyId: string;
  jobId: string;
  sourceCount: number;
  onUploaded: () => void;
  error: string;
  setError: (value: string) => void;
}>) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function upload() {
    if (!file || busy || !jobId) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setError(`This file is ${megabytes(file.size)} MB. The maximum source size is 25 MB.`);
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Uploading…");
    try {
      const mediaType = mediaTypeFor(file);
      if (file.size <= SERVER_ACTION_BYTES) {
        const form = new FormData();
        form.set("workspaceId", workspaceId);
        form.set("propertyId", propertyId);
        form.set("jobId", jobId);
        form.set("file", file);
        await uploadCustomerCreationSourceAction(form);
      } else {
        setStatus("Preparing secure upload…");
        const signed = await prepareCustomerSourceUploadAction({ workspaceId, propertyId, jobId, filename: file.name, mediaType, byteSize: file.size });
        setStatus("Uploading…");
        const { error: uploadError } = await createClient()
          .storage.from("guidebook-creation-sources")
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: mediaType });
        if (uploadError) throw new Error("Secure upload failed.");
        setStatus("Validating…");
        await completeCustomerSourceUploadAction({ workspaceId, propertyId, jobId, path: signed.path, filename: file.name, mediaType });
      }
      setStatus("");
      setFile(null);
      onUploaded();
    } catch (uploadFailure) {
      setError(uploadFailure instanceof Error ? uploadFailure.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2 className="text-2xl font-semibold">Upload your content</h2>
      <p className="mt-2 text-sm text-stone-500">Add any documents, text, and photos you have. PDF, DOCX, TXT, or images — up to 25 MB each.</p>
      <a
        href="/templates/guidebook-content-template.docx"
        download
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        <Download className="size-4" aria-hidden="true" />
        Don&apos;t have a document yet? Download a content template to fill in
      </a>
      <AiTrustBanner />
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-6">
        <UploadCloud className="size-6 text-blue-700" aria-hidden="true" />
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,image/jpeg,image/png,image/webp"
          disabled={busy || !jobId}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={!file || busy || !jobId}
          onClick={upload}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
        {status ? <span className="text-sm text-stone-600">{status}</span> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          <TriangleAlert className="mr-1 inline size-4" />
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-sm font-medium text-stone-700">
        {sourceCount} file{sourceCount === 1 ? "" : "s"} uploaded
      </p>
    </>
  );
}

export function AiReviewStep({
  workspaceId,
  propertyId,
  jobId,
  onReadyChange,
}: Readonly<{
  workspaceId: string;
  propertyId: string;
  jobId: string;
  onReadyChange: (ready: boolean) => void;
}>) {
  type Fact = {
    id: string;
    category: string;
    field_key: string;
    display_value: string | null;
    review_status: "confirmed" | "needs_review" | "missing" | "conflicting" | "rejected";
    high_risk: boolean;
  };
  type NarrativeSection = {
    id: string;
    title: string;
    body: string;
    edited_body: string | null;
    review_status: "confirmed" | "needs_review" | "missing" | "conflicting" | "rejected";
  };
  const [facts, setFacts] = useState<Fact[]>([]);
  const [sections, setSections] = useState<NarrativeSection[]>([]);
  const [jobState, setJobState] = useState("");
  const [correction, setCorrection] = useState<Record<string, string>>({});
  const [sectionEdit, setSectionEdit] = useState<Record<string, string>>({});
  const [highRiskAck, setHighRiskAck] = useState<Record<string, boolean>>({});
  const [busyFactId, setBusyFactId] = useState("");
  const [busySectionId, setBusySectionId] = useState("");
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const projection = await getCustomerCreationProjectionAction({ workspaceId, propertyId, jobId });
      if (cancelled || !projection) return;
      setJobState(String(projection.job.state));
      setFacts(projection.facts as Fact[]);
      setSections(projection.narrativeSections as NarrativeSection[]);
      const ready = projection.job.state === "ready_to_generate";
      if (ready !== readyRef.current) {
        readyRef.current = ready;
        onReadyChange(ready);
      }
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, propertyId, jobId]);

  async function review(factId: string, status: "confirmed" | "rejected") {
    setBusyFactId(factId);
    try {
      await reviewCustomerCreationFactAction({
        workspaceId,
        propertyId,
        jobId,
        factId,
        status,
        correctedValue: correction[factId],
        confirmHighRisk: Boolean(highRiskAck[factId]),
      });
      const projection = await getCustomerCreationProjectionAction({ workspaceId, propertyId, jobId });
      if (projection) {
        setFacts(projection.facts as Fact[]);
        setSections(projection.narrativeSections as NarrativeSection[]);
        setJobState(String(projection.job.state));
        const ready = projection.job.state === "ready_to_generate";
        readyRef.current = ready;
        onReadyChange(ready);
      }
    } finally {
      setBusyFactId("");
    }
  }

  async function reviewSection(sectionId: string, status: "confirmed" | "rejected") {
    setBusySectionId(sectionId);
    try {
      await reviewCustomerCreationSectionAction({
        workspaceId,
        propertyId,
        jobId,
        sectionId,
        status,
        correctedBody: sectionEdit[sectionId],
      });
      const projection = await getCustomerCreationProjectionAction({ workspaceId, propertyId, jobId });
      if (projection) {
        setFacts(projection.facts as Fact[]);
        setSections(projection.narrativeSections as NarrativeSection[]);
        setJobState(String(projection.job.state));
        const ready = projection.job.state === "ready_to_generate";
        readyRef.current = ready;
        onReadyChange(ready);
      }
    } finally {
      setBusySectionId("");
    }
  }

  const statusLabel: Record<Fact["review_status"], string> = {
    confirmed: "Confirmed",
    needs_review: "Needs review",
    missing: "Missing",
    conflicting: "Conflicting",
    rejected: "Excluded",
  };
  const statusTone: Record<Fact["review_status"], string> = {
    confirmed: "bg-emerald-50 text-emerald-800",
    needs_review: "bg-amber-50 text-amber-800",
    missing: "bg-stone-100 text-stone-600",
    conflicting: "bg-red-50 text-red-800",
    rejected: "bg-stone-100 text-stone-500",
  };

  return (
    <>
      <h2 className="text-2xl font-semibold">Review extracted information</h2>
      <p className="mt-2 text-sm text-stone-500">Review AI-extracted content. Confirm, edit, or exclude any items before generating your draft.</p>
      <AiTrustBanner />
      {jobState === "extracting" || (!facts.length && jobState !== "awaiting_review" && jobState !== "ready_to_generate") ? (
        <p className="mt-8 text-sm text-stone-500">Extracting information from your uploads…</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {facts.map((fact) => (
            <li key={fact.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{fact.category.replaceAll("_", " ")}</p>
                  <p className="font-medium">{fact.display_value ?? "No value extracted"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[fact.review_status]}`}>{statusLabel[fact.review_status]}</span>
              </div>
              {fact.review_status !== "confirmed" && fact.review_status !== "rejected" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Correct value (optional)"
                    value={correction[fact.id] ?? ""}
                    onChange={(event) => setCorrection((current) => ({ ...current, [fact.id]: event.target.value }))}
                    className="min-h-9 flex-1 rounded-lg border px-2 text-sm"
                  />
                  {fact.high_risk ? (
                    <label className="flex items-center gap-1.5 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={Boolean(highRiskAck[fact.id])}
                        onChange={(event) => setHighRiskAck((current) => ({ ...current, [fact.id]: event.target.checked }))}
                      />
                      Confirm this sensitive detail
                    </label>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyFactId === fact.id || (fact.high_risk && !highRiskAck[fact.id])}
                    onClick={() => review(fact.id, "confirmed")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <CircleCheck className="size-3.5" /> Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busyFactId === fact.id}
                    onClick={() => review(fact.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    <CircleX className="size-3.5" /> Exclude
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {sections.length ? (
        <>
          <h3 className="mt-8 text-lg font-semibold">Review narrative sections</h3>
          <p className="mt-1 text-sm text-stone-500">Whole descriptive content — welcome letters, recommendations, FAQ, safety tips — that doesn&apos;t reduce to a single fact.</p>
          <ul className="mt-4 space-y-3">
            {sections.map((section) => (
              <li key={section.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{section.title}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[section.review_status]}`}>{statusLabel[section.review_status]}</span>
                </div>
                {section.review_status !== "confirmed" && section.review_status !== "rejected" ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={sectionEdit[section.id] ?? section.edited_body ?? section.body}
                      onChange={(event) => setSectionEdit((current) => ({ ...current, [section.id]: event.target.value }))}
                      rows={4}
                      className="w-full rounded-lg border p-2 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busySectionId === section.id}
                        onClick={() => reviewSection(section.id, "confirmed")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <CircleCheck className="size-3.5" /> Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busySectionId === section.id}
                        onClick={() => reviewSection(section.id, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <CircleX className="size-3.5" /> Exclude
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

export function AiStyleStep({
  workspaceId,
  title,
  setTitle,
  toneOfVoice,
  setToneOfVoice,
  language,
  setLanguage,
  primaryColor,
  setPrimaryColor,
  accentColor,
  setAccentColor,
  templateName,
}: Readonly<{
  workspaceId: string;
  title: string;
  setTitle: (value: string) => void;
  toneOfVoice: string;
  setToneOfVoice: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  primaryColor: string;
  setPrimaryColor: (value: string) => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  templateName: string;
}>) {
  useEffect(() => {
    let cancelled = false;
    getGuidebookWorkspaceBrandDefaultsAction(workspaceId).then((defaults) => {
      if (cancelled || !defaults) return;
      if (defaults.toneOfVoice && !toneOfVoice) setToneOfVoice(defaults.toneOfVoice);
      if (defaults.language && !language) setLanguage(defaults.language);
      if (defaults.primaryColor && !primaryColor) setPrimaryColor(defaults.primaryColor);
      if (defaults.accentColor && !accentColor) setAccentColor(defaults.accentColor);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
  return (
    <>
      <h2 className="text-2xl font-semibold">Choose style and preferences</h2>
      <p className="mt-2 text-sm text-stone-500">Set the tone, style, and structure for your guidebook. Defaults come from your workspace Brand Kit.</p>
      <AiTrustBanner />
      <div className="mt-6 grid max-w-2xl gap-5">
        <label className="text-sm font-semibold">
          Guidebook name
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border px-3" />
        </label>
        <p className="text-sm text-stone-600">
          Template: <span className="font-semibold">{templateName || "Default"}</span>
        </p>
        <label className="text-sm font-semibold">
          Tone of voice
          <textarea value={toneOfVoice} onChange={(event) => setToneOfVoice(event.target.value)} rows={2} className="mt-2 block w-full rounded-lg border p-3" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Primary color
            <input type="color" value={primaryColor || "#0b2b24"} onChange={(event) => setPrimaryColor(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border px-2" />
          </label>
          <label className="text-sm font-semibold">
            Accent color
            <input type="color" value={accentColor || "#c78a38"} onChange={(event) => setAccentColor(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border px-2" />
          </label>
        </div>
        <label className="text-sm font-semibold">
          Language
          <input value={language || "en"} onChange={(event) => setLanguage(event.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border px-3" />
        </label>
      </div>
    </>
  );
}

export function AiGeneratingStep({
  workspaceId,
  propertyId,
  jobId,
  basePath,
}: Readonly<{
  workspaceId: string;
  propertyId: string;
  jobId: string;
  basePath: string;
}>) {
  const [jobState, setJobState] = useState("generating");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const projection = await getCustomerCreationProjectionAction({ workspaceId, propertyId, jobId });
      if (cancelled || !projection) return;
      setJobState(String(projection.job.state));
      if (projection.job.state === "failed") {
        setFailed(true);
        return;
      }
      if (projection.job.state === "completed" && projection.job.guidebook_id) {
        window.location.assign(`${basePath}/${String(projection.job.guidebook_id)}/edit`);
        return;
      }
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, propertyId, jobId]);
  const stages = [
    { key: "extracting", label: "Extracting information" },
    { key: "awaiting_review", label: "Organizing content" },
    { key: "ready_to_generate", label: "Matching photos" },
    { key: "generating", label: "Building draft" },
  ];
  const order = ["extracting", "awaiting_review", "ready_to_generate", "generating", "completed"];
  const currentIndex = order.indexOf(jobState);
  return (
    <>
      <h2 className="text-2xl font-semibold">Generating your guidebook</h2>
      <p className="mt-2 text-sm text-stone-500">AI is creating your first organized draft. You can safely leave this page.</p>
      <AiTrustBanner />
      {failed ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mr-1 inline size-4" />
          Draft generation didn&apos;t complete. Your uploaded content and reviewed facts are saved — contact support to retry.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {stages.map((stage, index) => {
            const stageIndex = order.indexOf(stage.key);
            const state = stageIndex < currentIndex ? "Completed" : stageIndex === currentIndex ? "In progress" : "Queued";
            return (
              <li key={stage.key} className="flex items-center justify-between rounded-xl border p-4 text-sm">
                <span className={state === "Completed" ? "font-semibold text-emerald-700" : state === "In progress" ? "font-semibold text-blue-700" : "text-stone-400"}>
                  {index + 1}. {stage.label}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{state}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-sm text-stone-500">We&apos;ll take you straight to the Builder when your draft is ready.</p>
    </>
  );
}

export async function beginAiExtraction(workspaceId: string, propertyId: string, jobId: string) {
  await enqueueCustomerExtractionAction({ workspaceId, propertyId, jobId, idempotencyKey: `extract:${jobId}` });
}
export async function beginAiGeneration(
  workspaceId: string,
  propertyId: string,
  jobId: string,
  title: string,
  preferences: Readonly<{ toneOfVoice?: string; language?: string }> = {},
) {
  await enqueueCustomerGenerationAction({
    workspaceId,
    propertyId,
    jobId,
    idempotencyKey: `generate:${jobId}`,
    title,
    ...preferences,
  });
}

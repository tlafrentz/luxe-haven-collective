"use client";
/**
 * @deprecated GB-001B compatibility surface only. No live Guidebook Studio route
 * imports this component; canonical authoring and publication use the application
 * boundaries in features/guidebook-studio/application/authoring.ts.
 */

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addStructuredGuidebookBlockAction,
  copyGuidebookSectionAction,
  getGuidebookPublishJobAction,
  publishGuidebookAction,
  retryGuidebookPublishAction,
  reviewGuidebookPropertyProjectionAction,
  updateGuidebookBlockAction,
} from "@/app/actions/guidebook-studio";
import {
  blockText,
  guidebookBlockRegistry,
  guidebookSectionRegistry,
  guidebookVariableRegistry,
  resolveGuidebookVariables,
  validateGuidebookComposition,
  type CompositionSection,
  type GuidebookVariableContext,
} from "@/features/guidebook-studio";
import {
  propertyProjectionVariables,
  type CanonicalPropertyProjection,
  type PropertyProjectionDrift,
} from "@/features/property-projection";

type Block = {
  id: string;
  block_type: string;
  position: number;
  content: Record<string, unknown>;
  revision: number;
};
type Section = {
  id: string;
  section_key: string;
  title: string;
  position: number;
  visible: boolean;
  guidebook_blocks: Block[];
};
type Props = {
  guidebook: {
    id: string;
    title: string;
    description: string;
    revision: number;
    status: string;
    updated_at: string;
    public_slug: string;
    current_version: number;
    brand: Record<string, unknown>;
  };
  propertyProjection: CanonicalPropertyProjection;
  propertyDrift: PropertyProjectionDrift;
  sections: Section[];
  canEdit: boolean;
  canPublish: boolean;
  copyTargets: { id: string; title: string }[];
  initialPublishJob?: PublishJob | null;
};
type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict";
type PublishJob = {
  id: string;
  status: string;
  stage: string;
  failure_message?: string | null;
  retryable?: boolean | null;
  published_version_id?: string | null;
  validation_result?: {
    status: string;
    issues?: {
      code: string;
      severity: string;
      message: string;
      recovery?: string;
    }[];
  } | null;
};

export function GuidebookRichEditor({
  guidebook,
  propertyProjection,
  propertyDrift,
  sections: initialSections,
  canEdit,
  canPublish,
  copyTargets,
  initialPublishJob,
}: Props) {
  const [sections, setSections] = useState(() => normalize(initialSections)),
    [selectedId, setSelectedId] = useState(initialSections[0]?.id ?? ""),
    [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
      "desktop",
    ),
    [query, setQuery] = useState(""),
    [revision, setRevision] = useState(guidebook.revision),
    [saveState, setSaveState] = useState<SaveState>("idle"),
    [lastSaved, setLastSaved] = useState(guidebook.updated_at),
    [publishingNotes, setPublishingNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [warningOverride, setWarningOverride] = useState(false),
    [publishJob, setPublishJob] = useState<PublishJob | null>(
      initialPublishJob ?? null,
    ),
    [publishError, setPublishError] = useState(""),
    [pending, startTransition] = useTransition(),
    sequence = useRef(0),
    recovered = useRef(false);
  const selected =
      sections.find((section) => section.id === selectedId) ?? sections[0],
    variables = propertyProjectionVariables(
      propertyProjection,
      `/g/${guidebook.public_slug}`,
    ),
    contentValidation = validateGuidebookComposition(
      sections.map(toComposition),
      variables,
    ),
    validation = {
      ...contentValidation,
      ready: contentValidation.ready && propertyProjection.health.publishable,
    };
  const visibleSections = sections.filter(
    (section) =>
      !query ||
      section.title.toLowerCase().includes(query.toLowerCase()) ||
      section.guidebook_blocks.some((block) =>
        blockText(toBlock(block)).toLowerCase().includes(query.toLowerCase()),
      ),
  );
  useEffect(() => {
    if (recovered.current) return;
    recovered.current = true;
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(`guidebook-draft:${guidebook.id}`);
      if (!stored) return;
      try {
        const value = JSON.parse(stored) as {
          revision: number;
          sections: Section[];
        };
        if (value.revision >= revision && value.sections?.length) {
          setSections(normalize(value.sections));
          setSaveState("dirty");
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, [guidebook.id, revision]);
  useEffect(() => {
    if (saveState === "dirty")
      localStorage.setItem(
        `guidebook-draft:${guidebook.id}`,
        JSON.stringify({ revision, sections, at: new Date().toISOString() }),
      );
  }, [guidebook.id, revision, saveState, sections]);
  useEffect(() => {
    if (
      !publishJob ||
      ["completed", "failed", "cancelled"].includes(publishJob.status)
    )
      return;
    const timer = window.setInterval(async () => {
      const result = await getGuidebookPublishJobAction(publishJob.id);
      if (result.ok) setPublishJob(result.job as PublishJob);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [publishJob]);

  function changeBlock(blockId: string, content: Record<string, unknown>) {
    setSections((current) =>
      current.map((section) => ({
        ...section,
        guidebook_blocks: section.guidebook_blocks.map((block) =>
          block.id === blockId ? { ...block, content } : block,
        ),
      })),
    );
    setSaveState("dirty");
    const request = ++sequence.current;
    window.setTimeout(() => {
      if (request !== sequence.current) return;
      setSaveState("saving");
      startTransition(async () => {
        const result = await updateGuidebookBlockAction({
          guidebookId: guidebook.id,
          blockId,
          content,
          expectedRevision: revision,
        });
        if (result.ok) {
          setRevision(result.revision);
          setLastSaved(result.savedAt);
          setSaveState("saved");
          localStorage.removeItem(`guidebook-draft:${guidebook.id}`);
        } else
          setSaveState(
            result.code === "revision_conflict" ? "conflict" : "failed",
          );
      });
    }, 900);
  }
  function insertVariable(key: string) {
    const block = selected?.guidebook_blocks.find(
      (item) => !["image", "gallery", "divider"].includes(item.block_type),
    );
    if (!block) return;
    const field = block.content.markdown !== undefined ? "markdown" : "text",
      current = String(block.content[field] ?? ""),
      space = current && !current.endsWith(" ") ? " " : "";
    changeBlock(block.id, {
      ...block.content,
      [field]: `${current}${space}{{${key}}}`,
    });
  }
  function addBlock(type: string, variant?: string) {
    if (!selected) return;
    startTransition(async () => {
      const result = await addStructuredGuidebookBlockAction({
        guidebookId: guidebook.id,
        sectionId: selected.id,
        blockType: type,
        variant,
        expectedRevision: revision,
      });
      if (result.ok) {
        setRevision(result.revision);
        setLastSaved(result.savedAt);
        setSections((current) =>
          current.map((section) =>
            section.id === selected.id
              ? {
                  ...section,
                  guidebook_blocks: [
                    ...section.guidebook_blocks,
                    result.block as Block,
                  ],
                }
              : section,
          ),
        );
        setSaveState("saved");
      } else
        setSaveState(
          result.code === "revision_conflict" ? "conflict" : "failed",
        );
    });
  }
  function publish() {
    const formData = new FormData();
    formData.set("guidebookId", guidebook.id);
    formData.set("revision", String(revision));
    formData.set("commandId", crypto.randomUUID());
    formData.set("notes", publishingNotes);
    formData.set("warningOverride", String(warningOverride));
    setPublishError("");
    startTransition(async () => {
      const result = await publishGuidebookAction(formData);
      if (result.ok)
        setPublishJob({
          id: result.jobId,
          status: result.status,
          stage: "queued",
        });
      else setPublishError(result.message);
    });
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[16rem_minmax(25rem,1fr)_20rem]">
      <aside className="self-start rounded-3xl border bg-white p-4 xl:sticky xl:top-5">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Search content
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Sections, text, variables…"
          />
        </label>
        <h2 className="mt-5 px-2 font-semibold">Guidebook outline</h2>
        <nav aria-label="Guidebook sections" className="mt-2 space-y-1">
          {visibleSections.map((section) => {
            const definition = guidebookSectionRegistry.find(
                (item) => item.key === section.section_key,
              ),
              incomplete = validation.issues.some(
                (issue) => issue.sectionKey === section.section_key,
              );
            return (
              <button
                type="button"
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-amber-600 ${selected?.id === section.id ? "bg-stone-950 text-white" : "hover:bg-stone-100"}`}
              >
                <span>{section.title}</span>
                <span aria-label={incomplete ? "Incomplete" : "Complete"}>
                  {incomplete ? "!" : "✓"}
                  {definition?.required ? " *" : ""}
                </span>
              </button>
            );
          })}
        </nav>
        <p className="mt-4 px-2 text-xs text-stone-500">
          * Required sections remain part of every published experience.
        </p>
      </aside>
      <main className="space-y-5">
        <section className="rounded-3xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Focused section
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                {selected?.title ?? "No section"}
              </h2>
            </div>
            <SaveStatus
              state={saveState}
              pending={pending}
              lastSaved={lastSaved}
            />
          </div>
          {!canEdit ? (
            <p
              role="status"
              className="mt-4 rounded-xl bg-amber-50 p-3 text-sm"
            >
              Your access is read-only. Preview and content health remain
              available.
            </p>
          ) : null}
          <div className="mt-6 space-y-4">
            {selected?.guidebook_blocks.length ? (
              selected.guidebook_blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  variables={variables}
                  disabled={!canEdit}
                  onChange={(content) => changeBlock(block.id, content)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="font-semibold">
                  This section needs guest-facing content.
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Add a structured experience block below.
                </p>
              </div>
            )}
          </div>
        </section>
        {canEdit ? (
          <section className="rounded-3xl border bg-white p-5">
            <h2 className="font-semibold">Add experience block</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {guidebookBlockRegistry.map((item) => (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => addBlock(item.type, item.variant)}
                  key={`${item.type}-${item.label}`}
                  className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-stone-50 disabled:opacity-40"
                >
                  {item.label}
                </button>
              ))}
            </div>
            {copyTargets.length && selected ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Copy this section to another guidebook
                </summary>
                <form
                  action={async (formData) => {
                    await copyGuidebookSectionAction(formData);
                  }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  <input
                    type="hidden"
                    name="sourceGuidebookId"
                    value={guidebook.id}
                  />
                  <input
                    type="hidden"
                    name="sourceSectionId"
                    value={selected.id}
                  />
                  <select
                    name="targetGuidebookId"
                    required
                    className="min-w-48 rounded-xl border px-3 py-2 text-sm"
                  >
                    <option value="">Select guidebook</option>
                    {copyTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.title}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-full border px-4 py-2 text-sm font-semibold">
                    Copy section
                  </button>
                </form>
              </details>
            ) : null}
          </section>
        ) : null}
      </main>
      <aside className="space-y-5 self-start xl:sticky xl:top-5">
        <section className="rounded-3xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Live preview</h2>
            <span className="text-xs text-stone-500">Current projection</span>
          </div>
          <div className="mt-3 flex gap-1" aria-label="Preview size">
            {(["desktop", "tablet", "mobile"] as const).map((mode) => (
              <button
                type="button"
                onClick={() => setViewport(mode)}
                aria-pressed={viewport === mode}
                key={mode}
                className={`rounded-full px-2 py-1 text-xs capitalize ${viewport === mode ? "bg-stone-950 text-white" : "border"}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl bg-stone-100 p-2">
            <div
              className={`mx-auto min-h-64 rounded-lg bg-[#fbf8f1] p-3 shadow ${viewport === "desktop" ? "w-full" : viewport === "tablet" ? "w-[85%]" : "w-[65%]"}`}
            >
              <p className="text-xs font-semibold uppercase text-amber-800">
                {propertyProjection.identity.name}
              </p>
              <h3 className="mt-2 font-serif text-xl">{selected?.title}</h3>
              <div className="mt-3 space-y-2">
                {selected?.guidebook_blocks.map((block) => (
                  <BlockPreview
                    key={block.id}
                    block={block}
                    variables={variables}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
        <PublishingPanel
          validation={validation}
          propertyProjection={propertyProjection}
          currentVersion={guidebook.current_version}
          canPublish={canPublish}
          pending={pending}
          saveState={saveState}
          notes={publishingNotes}
          setNotes={setPublishingNotes}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          warningOverride={warningOverride}
          setWarningOverride={setWarningOverride}
          publish={publish}
          job={publishJob}
          error={publishError}
        />
        <section
          className={`rounded-3xl border p-5 ${propertyDrift.reviewRecommended ? "border-blue-200 bg-blue-50" : "bg-white"}`}
        >
          <h2 className="font-semibold">Property synchronization</h2>
          <p className="mt-2 text-sm">{propertyDrift.summary}</p>
          {propertyDrift.changedFields.length ? (
            <ul className="mt-3 space-y-1 text-xs">
              {propertyDrift.changedFields.map((field) => (
                <li key={field.key}>{field.label} changed</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs">
            Projection {propertyProjection.version} · Updated{" "}
            {new Date(propertyProjection.updatedAt).toLocaleString()}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={propertyProjection.navigation.workspace}
              className="text-xs font-semibold underline"
            >
              Property workspace
            </a>
            <a
              href={propertyProjection.navigation.operationalSettings}
              className="text-xs font-semibold underline"
            >
              Operational settings
            </a>
            <a
              href={propertyProjection.navigation.contacts}
              className="text-xs font-semibold underline"
            >
              Contacts
            </a>
          </div>
          {propertyDrift.reviewRecommended && canEdit ? (
            <form
              action={async (formData) => {
                await reviewGuidebookPropertyProjectionAction(formData);
              }}
              className="mt-4"
            >
              <input type="hidden" name="guidebookId" value={guidebook.id} />
              <button className="rounded-full border border-blue-300 bg-white px-3 py-2 text-xs font-semibold">
                Mark property changes reviewed
              </button>
            </form>
          ) : null}
        </section>
        <section className="rounded-3xl border bg-white p-5">
          <h2 className="font-semibold">Property variables</h2>
          <p className="mt-1 text-xs text-stone-500">
            Insert operational values instead of duplicating property data.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guidebookVariableRegistry.map((variable) => (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => insertVariable(variable.key)}
                title={
                  variables[variable.key] || "Operational value unavailable"
                }
                key={variable.key}
                className={`rounded-full px-2 py-1 text-xs font-semibold disabled:opacity-50 ${variables[variable.key] ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
              >{`{{${variable.key}}}`}</button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function BlockEditor({
  block,
  variables,
  disabled,
  onChange,
}: {
  block: Block;
  variables: GuidebookVariableContext;
  disabled: boolean;
  onChange: (content: Record<string, unknown>) => void;
}) {
  const text = String(
      block.content.markdown ?? block.content.text ?? block.content.label ?? "",
    ),
    diagnostics = resolveGuidebookVariables(text, variables).diagnostics.filter(
      (item) => item.status !== "resolved",
    );
  if (block.block_type === "divider")
    return (
      <div className="rounded-2xl border bg-stone-50 p-4">
        <hr />
        <p className="mt-2 text-xs text-stone-500">Divider</p>
      </div>
    );
  if (block.block_type === "image")
    return (
      <div className="rounded-2xl border bg-stone-50 p-4">
        {block.content.url ? (
          <Image
            src={String(block.content.url)}
            alt={String(block.content.alt ?? "")}
            width={900}
            height={600}
            className="h-44 w-full rounded-xl object-cover"
          />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm">
            Upload an image to complete this block.
          </p>
        )}
        <label className="mt-3 block text-xs font-semibold">
          Alt text
          <input
            disabled={disabled}
            value={String(block.content.alt ?? "")}
            onChange={(event) =>
              onChange({ ...block.content, alt: event.target.value })
            }
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold">
          Caption
          <input
            disabled={disabled}
            value={String(block.content.caption ?? "")}
            onChange={(event) =>
              onChange({ ...block.content, caption: event.target.value })
            }
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2"
          />
        </label>
      </div>
    );
  const field = block.content.markdown !== undefined ? "markdown" : "text",
    format = (tool: string) => {
      const next =
        tool === "Bold"
          ? `**${text}**`
          : tool === "Italic"
            ? `_${text}_`
            : tool === "Underline"
              ? `<u>${text}</u>`
              : tool === "Link"
                ? `[${text || "Link label"}](https://)`
                : text
                    .split("\n")
                    .map((line) => `- ${line}`)
                    .join("\n");
      onChange({ ...block.content, [field]: next });
    };
  return (
    <article className="rounded-2xl border bg-stone-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {block.block_type.replaceAll("-", " ")}
        </p>
        <span className="text-xs text-stone-400">Autosaves</span>
      </div>
      <div className="mt-2 flex gap-1" aria-label="Formatting controls">
        {["Bold", "Italic", "Underline", "Link", "List"].map((tool) => (
          <button
            disabled={disabled}
            onClick={() => format(tool)}
            type="button"
            title={`${tool} formatting`}
            key={tool}
            className="rounded border bg-white px-2 py-1 text-xs"
          >
            {tool}
          </button>
        ))}
      </div>
      <textarea
        disabled={disabled}
        value={text}
        onChange={(event) =>
          onChange({ ...block.content, [field]: event.target.value })
        }
        className="mt-2 min-h-28 w-full rounded-xl border bg-white p-3 text-sm"
        aria-label={`Edit ${block.block_type} content`}
      />
      {diagnostics.map((item) => (
        <p
          role="alert"
          className="mt-1 text-xs text-amber-800"
          key={`${item.token}-${item.status}`}
        >
          {item.message}
        </p>
      ))}
    </article>
  );
}
function BlockPreview({
  block,
  variables,
}: {
  block: Block;
  variables: GuidebookVariableContext;
}) {
  if (block.block_type === "divider") return <hr />;
  if (block.block_type === "image" && block.content.url)
    return (
      <Image
        src={String(block.content.url)}
        alt={String(block.content.alt ?? "")}
        width={500}
        height={300}
        className="rounded-lg"
      />
    );
  const text = resolveGuidebookVariables(
    String(
      block.content.markdown ?? block.content.text ?? block.content.label ?? "",
    ),
    variables,
  ).value;
  return block.block_type === "heading" ? (
    <h4 className="font-serif text-lg">{text || "Untitled heading"}</h4>
  ) : block.block_type === "callout" ? (
    <p className="rounded-lg bg-amber-50 p-2 text-xs">
      {text || "Callout content"}
    </p>
  ) : (
    <p className="whitespace-pre-wrap text-xs leading-5 text-stone-700">
      {text || "Add content…"}
    </p>
  );
}
function SaveStatus({
  state,
  pending,
  lastSaved,
}: {
  state: SaveState;
  pending: boolean;
  lastSaved: string;
}) {
  const label =
    pending || state === "saving"
      ? "Saving…"
      : state === "failed"
        ? "Autosave failed — local draft preserved"
        : state === "conflict"
          ? "Draft changed elsewhere — reload to compare"
          : state === "dirty"
            ? "Waiting to save…"
            : `Saved · ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return (
    <p
      role={state === "failed" || state === "conflict" ? "alert" : "status"}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${state === "failed" || state === "conflict" ? "bg-rose-50 text-rose-800" : "bg-stone-100 text-stone-600"}`}
    >
      {label}
    </p>
  );
}
function PublishingPanel({
  validation,
  propertyProjection,
  currentVersion,
  canPublish,
  pending,
  saveState,
  notes,
  setNotes,
  confirmed,
  setConfirmed,
  warningOverride,
  setWarningOverride,
  publish,
  job,
  error,
}: {
  validation: {
    ready: boolean;
    completeRequired: number;
    totalRequired: number;
    issues: readonly { message: string }[];
  };
  propertyProjection: CanonicalPropertyProjection;
  currentVersion: number;
  canPublish: boolean;
  pending: boolean;
  saveState: SaveState;
  notes: string;
  setNotes: (value: string) => void;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  warningOverride: boolean;
  setWarningOverride: (value: boolean) => void;
  publish: () => void;
  job: PublishJob | null;
  error: string;
}) {
  const warnings = [
      ...(propertyProjection.guest.featuredImage.state !== "available"
        ? ["The property has no featured cover image."]
        : []),
      ...(propertyProjection.operational.hostContact.state !== "available"
        ? ["Optional host contact information is unavailable."]
        : []),
    ],
    blocked = !validation.ready,
    active = job && ["queued", "processing"].includes(job.status);
  async function retry() {
    if (!job) return;
    const data = new FormData();
    data.set("jobId", job.id);
    await retryGuidebookPublishAction(data);
    window.location.reload();
  }
  return (
    <section
      className={`rounded-3xl border p-5 ${blocked ? "border-rose-200 bg-rose-50" : warnings.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
    >
      <h2 className="font-semibold">Publishing readiness</h2>
      <p className="mt-2 text-sm font-semibold">
        {blocked ? "Blocked" : warnings.length ? "Warnings" : "Ready"}
      </p>
      <p className="mt-1 text-xs">
        {validation.completeRequired}/{validation.totalRequired} required
        sections complete · Property projection {propertyProjection.version}
      </p>
      {propertyProjection.health.missing.length ? (
        <ul className="mt-3 space-y-1 text-xs">
          {propertyProjection.health.missing.map((field) => (
            <li key={field}>
              ✕ Missing {field.replaceAll(/([A-Z])/g, " $1").toLowerCase()}
            </li>
          ))}
        </ul>
      ) : null}
      {validation.issues.length ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs">
          {validation.issues.map((issue, index) => (
            <li key={index}>✕ {issue.message}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs">
          {warnings.map((item) => (
            <li key={item}>⚠ {item}</li>
          ))}
        </ul>
      ) : !blocked ? (
        <p className="mt-3 text-xs">✓ All required information is available.</p>
      ) : null}
      <details className="mt-4" open={Boolean(job)}>
        <summary className="cursor-pointer text-sm font-semibold">
          Review and confirm publication
        </summary>
        <div className="mt-3 space-y-3 rounded-xl bg-white/70 p-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-stone-500">Next version</dt>
              <dd className="font-semibold">v{currentVersion + 1}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Property</dt>
              <dd className="font-semibold">
                {propertyProjection.identity.name}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Projection</dt>
              <dd className="font-semibold">
                {propertyProjection.projectionVersion}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Public URL</dt>
              <dd className="font-semibold">Activates atomically</dd>
            </div>
          </dl>
          <label className="block text-xs font-semibold">
            Publishing notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              placeholder="What changed in this version?"
              className="mt-1 min-h-20 w-full rounded-xl border bg-white p-2 font-normal"
            />
          </label>
          {warnings.length ? (
            <label className="flex gap-2 text-xs">
              <input
                type="checkbox"
                checked={warningOverride}
                onChange={(event) => setWarningOverride(event.target.checked)}
              />
              <span>I reviewed the warnings and want to publish.</span>
            </label>
          ) : null}
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I confirm this immutable version is ready for guests.</span>
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={
              blocked ||
              !canPublish ||
              pending ||
              active ||
              !confirmed ||
              (warnings.length > 0 && !warningOverride) ||
              saveState === "dirty" ||
              saveState === "saving"
            }
            className="w-full rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {active ? "Publishing…" : "Publish guidebook"}
          </button>
        </div>
      </details>
      {job ? (
        <div role="status" className="mt-4 rounded-xl bg-white p-3 text-xs">
          <p className="font-semibold capitalize">
            {job.status} · {job.stage.replaceAll("-", " ")}
          </p>
          {active ? (
            <progress
              className="mt-2 w-full"
              value={stageProgress(job.stage)}
              max={100}
            />
          ) : null}
          {job.status === "completed" ? (
            <p className="mt-2 text-emerald-800">
              Guidebook successfully published. The newest version is now live.
            </p>
          ) : null}
          {job.status === "failed" ? (
            <>
              <p role="alert" className="mt-2 text-rose-800">
                {job.failure_message ??
                  "Publishing failed. The previous public version remains active."}
              </p>
              {job.validation_result?.issues?.length ? (
                <ul className="mt-2 space-y-1 text-rose-800">
                  {job.validation_result.issues
                    .filter((issue) => issue.severity === "error")
                    .map((issue) => (
                      <li key={issue.code}>
                        {issue.message}
                        {issue.recovery ? ` ${issue.recovery}` : ""}
                      </li>
                    ))}
                </ul>
              ) : null}
              {job.retryable ? (
                <button
                  type="button"
                  onClick={retry}
                  className="mt-2 rounded-full border px-3 py-1 font-semibold"
                >
                  Retry publishing
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
      {!canPublish ? (
        <p className="mt-2 text-xs">
          Publishing and hosting access are required.
        </p>
      ) : null}
    </section>
  );
}
function stageProgress(stage: string) {
  return (
    {
      queued: 5,
      validating: 25,
      snapshotting: 50,
      rendering: 65,
      activating: 85,
      completed: 100,
    }[stage] ?? 0
  );
}
function normalize(sections: Section[]) {
  return sections
    .map((section) => ({
      ...section,
      guidebook_blocks: [...(section.guidebook_blocks ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    }))
    .sort((a, b) => a.position - b.position);
}
function toBlock(block: Block) {
  return {
    id: block.id,
    type: block.block_type,
    position: block.position,
    content: block.content,
  };
}
function toComposition(section: Section): CompositionSection {
  return {
    id: section.id,
    key: section.section_key,
    title: section.title,
    position: section.position,
    visible: section.visible,
    blocks: section.guidebook_blocks.map(toBlock),
  };
}

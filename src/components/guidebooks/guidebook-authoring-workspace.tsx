"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  guidebookAuthoringCommandAction,
  loadGuidebookAuthoringAction,
  uploadGuidebookMediaAction,
} from "@/app/actions/guidebook-authoring";
import {
  type AuthoringBlock,
  type AuthoringBlockType,
  type GuidebookDraft,
  focusAfterAuthoringCommand,
  validateBlock,
} from "@/features/guidebook-studio";

const types: readonly AuthoringBlockType[] = [
  "heading",
  "rich-text",
  "image",
  "instruction",
  "contact",
  "location",
  "link",
  "callout",
  "checklist",
];
type DeleteTarget =
  | { kind: "section"; sectionId: string; label: string; nonempty: boolean }
  | {
      kind: "block";
      sectionId: string;
      blockId: string;
      label: string;
      nonempty: boolean;
    };
export function GuidebookAuthoringWorkspace({
  initialDraft,
  canEdit,
}: {
  initialDraft: GuidebookDraft;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft),
    [selected, setSelected] = useState(initialDraft.sections[0]?.id ?? ""),
    [state, setState] = useState<
      | "saved"
      | "saving"
      | "failed"
      | "conflict"
      | "retrying"
      | "offline"
      | "reconnecting"
    >("saved"),
    [local, setLocal] = useState<GuidebookDraft | null>(null),
    [serverRevision, setServerRevision] = useState<number>(),
    [conflictingCommand, setConflictingCommand] = useState<
      Parameters<typeof guidebookAuthoringCommandAction>[0]["command"] | null
    >(null),
    [reviewedLatest, setReviewedLatest] = useState(false),
    [newSectionError, setNewSectionError] = useState(""),
    [sectionNameError, setSectionNameError] = useState(""),
    [focusTarget, setFocusTarget] = useState<string>(),
    [confirm, setConfirm] = useState<DeleteTarget | null>(null),
    [pending, startTransition] = useTransition(),
    newName = useRef<HTMLInputElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    latestRef = useRef<() => Promise<void>>(latest);
  const section =
    draft.sections.find((item) => item.id === selected) ?? draft.sections[0];
  useEffect(() => {
    latestRef.current = latest;
  });
  useEffect(() => {
    const offline = () => setState("offline"),
      online = () => {
        setState("reconnecting");
        void latestRef.current();
      };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (state !== "saved") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);
  useEffect(() => {
    if (!focusTarget) return;
    workspace.current
      ?.querySelector<HTMLElement>(
        `[data-focus-id="${CSS.escape(focusTarget)}"]`,
      )
      ?.focus();
    queueMicrotask(() => setFocusTarget(undefined));
  }, [focusTarget, draft]);
  function command(
    value: Parameters<typeof guidebookAuthoringCommandAction>[0]["command"],
    optimistic?: GuidebookDraft,
    expectedRevision = draft.revision,
  ) {
    const preserved = optimistic ?? draft;
    if (optimistic) setDraft(optimistic);
    setState("saving");
    startTransition(async () => {
      const result = await guidebookAuthoringCommandAction({
        workspaceId: draft.workspaceId,
        guidebookId: draft.guidebookId,
        expectedRevision,
        commandId: crypto.randomUUID(),
        command: value,
      });
      if (result.ok) {
        setFocusTarget(
          focusAfterAuthoringCommand(value, preserved, result.value),
        );
        setDraft(result.value);
        setLocal(null);
        setConflictingCommand(null);
        setReviewedLatest(false);
        setState("saved");
        router.refresh();
      } else if (result.code === "DRAFT_CONFLICT") {
        setLocal((current) => current ?? preserved);
        setConflictingCommand(value);
        setReviewedLatest(false);
        setServerRevision(result.serverRevision);
        setState("conflict");
      } else {
        setLocal((current) => current ?? preserved);
        setState("failed");
      }
    });
  }
  async function latest() {
    setState("retrying");
    const result = await loadGuidebookAuthoringAction({
      workspaceId: draft.workspaceId,
      guidebookId: draft.guidebookId,
    });
    if (result.ok) {
      setDraft(result.draft);
      setServerRevision(result.draft.revision);
      setReviewedLatest(true);
      setState("conflict");
    } else setState("failed");
  }
  function reapply() {
    if (!conflictingCommand) return;
    command(conflictingCommand, undefined, draft.revision);
  }
  function addSection() {
    const name = newName.current?.value.trim();
    if (!name) {
      setNewSectionError("Enter a section name.");
      return;
    }
    setNewSectionError("");
    command({ type: "create-section", name, afterSectionId: section?.id });
    if (newName.current) newName.current.value = "";
  }
  function remove() {
    if (!confirm) return;
    command(
      confirm.kind === "section"
        ? { type: "delete-section", sectionId: confirm.sectionId }
        : {
            type: "delete-block",
            sectionId: confirm.sectionId,
            blockId: confirm.blockId,
          },
    );
    setConfirm(null);
  }
  return (
    <div
      ref={workspace}
      className="grid w-full max-w-full min-w-0 gap-5 overflow-x-hidden break-words lg:grid-cols-[17rem_minmax(0,1fr)] motion-reduce:scroll-auto [&_*]:motion-reduce:transition-none"
    >
      <aside className="min-w-0 self-start overflow-hidden rounded-3xl border bg-white p-4 lg:sticky lg:top-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Sections</h2>
          <SaveState state={state} pending={pending} />
        </div>
        <nav aria-label="Draft sections" className="mt-3 space-y-2">
          {draft.sections.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-2 ${item.id === section?.id ? "border-stone-900" : ""}`}
            >
              <button
                data-focus-id={`section:${item.id}`}
                onClick={() => setSelected(item.id)}
                className="w-full text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                {item.name}
                {!item.visible ? " · Hidden" : ""}
              </button>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Small
                    label={`Move ${item.name} up`}
                    disabled={item.position === 0}
                    onClick={() =>
                      command({
                        type: "reorder-section",
                        sectionId: item.id,
                        direction: "up",
                      })
                    }
                  >
                    ↑
                  </Small>
                  <Small
                    label={`Move ${item.name} down`}
                    disabled={item.position === draft.sections.length - 1}
                    onClick={() =>
                      command({
                        type: "reorder-section",
                        sectionId: item.id,
                        direction: "down",
                      })
                    }
                  >
                    ↓
                  </Small>
                  <Small
                    label={`${item.visible ? "Hide" : "Show"} ${item.name}`}
                    onClick={() =>
                      command({
                        type: "section-visibility",
                        sectionId: item.id,
                        visible: !item.visible,
                      })
                    }
                  >
                    {item.visible ? "Hide" : "Show"}
                  </Small>
                  <Small
                    label={`Duplicate ${item.name}`}
                    onClick={() =>
                      command({ type: "duplicate-section", sectionId: item.id })
                    }
                  >
                    Copy
                  </Small>
                  <Small
                    label={`Delete ${item.name}`}
                    onClick={() =>
                      setConfirm({
                        kind: "section",
                        sectionId: item.id,
                        label: item.name,
                        nonempty: item.blocks.length > 0,
                      })
                    }
                  >
                    Delete
                  </Small>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        {canEdit ? (
          <div className="mt-4 border-t pt-4">
            <label className="text-xs font-semibold">
              New section name
              <input
                ref={newName}
                data-focus-id="section:new"
                aria-invalid={Boolean(newSectionError)}
                aria-describedby={
                  newSectionError ? "new-section-error" : undefined
                }
                onChange={() => setNewSectionError("")}
                maxLength={200}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              {newSectionError ? (
                <span
                  id="new-section-error"
                  role="alert"
                  className="mt-1 block text-xs text-red-700"
                >
                  {newSectionError}
                </span>
              ) : null}
            </label>
            <button
              onClick={addSection}
              className="mt-2 w-full rounded-xl bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
            >
              Add section
            </button>
          </div>
        ) : null}
      </aside>
      <main className="min-w-0 space-y-5">
        {section ? (
          <>
            <section className="rounded-3xl border bg-white p-5">
              <label className="text-sm font-semibold">
                Section name
                <input
                  disabled={!canEdit}
                  value={section.name}
                  aria-invalid={Boolean(sectionNameError)}
                  aria-describedby={
                    sectionNameError ? "section-name-error" : undefined
                  }
                  maxLength={200}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sections: draft.sections.map((item) =>
                        item.id === section.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    })
                  }
                  onBlur={(event) => {
                    if (!event.target.value.trim()) {
                      setSectionNameError("Enter a section name.");
                      return;
                    }
                    setSectionNameError("");
                    return (
                      event.target.value.trim() &&
                      event.target.value.trim() !==
                        initialDraft.sections.find(
                          (item) => item.id === section.id,
                        )?.name &&
                      command(
                        {
                          type: "rename-section",
                          sectionId: section.id,
                          name: event.target.value,
                        },
                        draft,
                      )
                    );
                  }}
                  className="mt-2 w-full rounded-xl border px-3 py-2"
                />
                {sectionNameError ? (
                  <span
                    id="section-name-error"
                    role="alert"
                    className="mt-1 block text-xs text-red-700"
                  >
                    {sectionNameError}
                  </span>
                ) : null}
              </label>
              <p className="mt-2 text-xs text-stone-500">
                Position {section.position + 1} of {draft.sections.length} ·{" "}
                {section.visible
                  ? "Visible in preview and publication"
                  : "Hidden from preview and publication"}
              </p>
            </section>
            <section className="space-y-4">
              {section.blocks.map((block) => (
                <article
                  key={block.id}
                  data-focus-id={`block:${block.id}`}
                  tabIndex={-1}
                  className="rounded-3xl border bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                      {block.type} · {block.visible ? "Visible" : "Hidden"}
                    </p>
                    {canEdit ? (
                      <div className="flex min-w-0 flex-wrap gap-1">
                        <Small
                          label={`Move ${block.type} up`}
                          disabled={block.position === 0}
                          onClick={() =>
                            command({
                              type: "reorder-block",
                              sectionId: section.id,
                              blockId: block.id,
                              direction: "up",
                            })
                          }
                        >
                          ↑
                        </Small>
                        <Small
                          label={`Move ${block.type} down`}
                          disabled={
                            block.position === section.blocks.length - 1
                          }
                          onClick={() =>
                            command({
                              type: "reorder-block",
                              sectionId: section.id,
                              blockId: block.id,
                              direction: "down",
                            })
                          }
                        >
                          ↓
                        </Small>
                        <Small
                          label={`${block.visible ? "Hide" : "Show"} ${block.type}`}
                          onClick={() =>
                            command({
                              type: "block-visibility",
                              sectionId: section.id,
                              blockId: block.id,
                              visible: !block.visible,
                            })
                          }
                        >
                          {block.visible ? "Hide" : "Show"}
                        </Small>
                        <Small
                          label={`Duplicate ${block.type}`}
                          onClick={() =>
                            command({
                              type: "duplicate-block",
                              sectionId: section.id,
                              blockId: block.id,
                            })
                          }
                        >
                          Copy
                        </Small>
                        <Small
                          label={`Delete ${block.type}`}
                          onClick={() =>
                            setConfirm({
                              kind: "block",
                              sectionId: section.id,
                              blockId: block.id,
                              label: block.type,
                              nonempty: true,
                            })
                          }
                        >
                          Delete
                        </Small>
                      </div>
                    ) : null}
                  </div>
                  <StructuredEditor
                    block={block}
                    guidebookId={draft.guidebookId}
                    workspaceId={draft.workspaceId}
                    disabled={!canEdit || pending}
                    saving={pending}
                    onSave={(next) =>
                      command({
                        type: "update-block",
                        sectionId: section.id,
                        block: next,
                      })
                    }
                  />
                </article>
              ))}
            </section>
            {canEdit ? (
              <section className="rounded-3xl border bg-white p-5">
                <h2 className="font-semibold">Add block</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {types.map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        command({
                          type: "create-block",
                          sectionId: section.id,
                          blockType: type,
                        })
                      }
                      className="rounded-full border px-3 py-2 text-xs font-semibold capitalize"
                    >
                      {type.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="rounded-3xl border border-dashed p-10 text-center">
            Add a section to begin authoring.
          </section>
        )}
      </main>
      {state === "conflict" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-title"
          onKeyDown={trapDialogFocus}
          className="fixed inset-0 z-50 grid max-w-full place-items-center overflow-hidden bg-black/50 p-4"
        >
          <section className="box-border max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-7">
            <h2 id="conflict-title" className="text-xl font-semibold">
              A newer draft exists
            </h2>
            <p className="mt-3 text-sm">
              Your local edits are preserved from revision{" "}
              {local?.revision ?? draft.revision}. The server is at revision{" "}
              {serverRevision ?? draft.revision}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {reviewedLatest ? (
                <button
                  autoFocus
                  onClick={reapply}
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  Reapply my change
                </button>
              ) : (
                <button
                  autoFocus
                  onClick={latest}
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  Review latest
                </button>
              )}
              <button
                onClick={() => {
                  setState("failed");
                  setFocusTarget("save-status");
                }}
                className="rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Keep local work available
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {confirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onKeyDown={trapDialogFocus}
          className="fixed inset-0 z-50 grid max-w-full place-items-center overflow-hidden bg-black/50 p-4"
        >
          <section className="box-border max-h-[90vh] w-full max-w-md overflow-auto rounded-3xl bg-white p-7">
            <h2 id="delete-title" className="text-xl font-semibold">
              Delete {confirm.label}?
            </h2>
            <p className="mt-3 text-sm">
              This removes only the mutable draft content.
              {confirm.nonempty ? " It contains authored content." : ""}{" "}
              Published versions remain unchanged.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                autoFocus
                onClick={remove}
                className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setFocusTarget(
                    confirm.kind === "section"
                      ? `section:${confirm.sectionId}`
                      : `block:${confirm.blockId}`,
                  );
                  setConfirm(null);
                }}
                className="rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
function StructuredEditor({
  block,
  guidebookId,
  workspaceId,
  disabled,
  saving,
  onSave,
}: {
  block: AuthoringBlock;
  guidebookId: string;
  workspaceId: string;
  disabled: boolean;
  saving: boolean;
  onSave: (block: AuthoringBlock) => void;
}) {
  const [value, setValue] = useState(block),
    [error, setError] = useState<string | null>(null),
    [uploading, setUploading] = useState(false),
    content = value.content as Record<string, unknown>;
  const errorId = `block-${block.id}-error`;
  const save = () => {
    try {
      const normalized = normalizeLists(value);
      validateBlock(normalized, "draft");
      setError(null);
      onSave(normalized);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This block is not valid.",
      );
    }
  };
  const field = (
    name: string,
    label: string,
    kind: "input" | "textarea" = "input",
  ) => (
    <label className="mt-3 block text-sm font-semibold">
      {label}
      {kind === "textarea" ? (
        <textarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          value={String(content[name] ?? "")}
          onChange={(event) =>
            setValue({
              ...value,
              content: { ...content, [name]: event.target.value },
            } as AuthoringBlock)
          }
          className="mt-1 min-h-24 w-full rounded-xl border p-3 font-normal"
        />
      ) : (
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          value={String(content[name] ?? "")}
          onChange={(event) =>
            setValue({
              ...value,
              content: { ...content, [name]: event.target.value },
            } as AuthoringBlock)
          }
          className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
        />
      )}
    </label>
  );
  return (
    <div>
      {block.type === "heading" ? (
        <>
          {field("text", "Heading text")}
          <label className="mt-3 block text-sm font-semibold">
            Heading level
            <select
              value={String(content.level ?? 2)}
              onChange={(event) =>
                setValue({
                  ...value,
                  content: { ...content, level: Number(event.target.value) },
                } as AuthoringBlock)
              }
              className="ml-2 rounded border px-2 py-1"
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
        </>
      ) : block.type === "rich-text" ? (
        field("text", "Rich text", "textarea")
      ) : block.type === "image" ? (
        <>
          <label className="mt-3 block text-sm font-semibold">
            Upload image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={disabled || uploading}
              className="mt-1 block w-full text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError(null);
                const data = new FormData();
                data.set("guidebookId", guidebookId);
                data.set("workspaceId", workspaceId);
                data.set("commandId", crypto.randomUUID());
                data.set("file", file);
                const result = await uploadGuidebookMediaAction(data);
                setUploading(false);
                if (result.ok)
                  setValue({
                    ...value,
                    content: { ...content, mediaRef: result.value.id },
                  } as AuthoringBlock);
                else
                  setError(
                    "The image could not be uploaded. Your draft was not changed.",
                  );
              }}
            />
          </label>
          <p className="mt-2 text-xs text-stone-500">
            {uploading
              ? "Uploading privately…"
              : content.mediaRef
                ? "Approved private media attached."
                : "No image attached."}
          </p>
          {field("alt", "Alternative text")}
          {field("caption", "Caption")}
        </>
      ) : block.type === "instruction" ? (
        <>
          {field("title", "Instruction title")}
          {field("steps", "Steps, one per line", "textarea")}
        </>
      ) : block.type === "contact" ? (
        <>
          {field("name", "Display name")}
          {field("role", "Role")}
          {field("phone", "Phone")}
        </>
      ) : block.type === "location" ? (
        <>
          {field("label", "Location label")}
          {field("destination", "Guest-safe destination", "textarea")}
          {field("mapUrl", "Map URL")}
        </>
      ) : block.type === "link" ? (
        <>
          {field("label", "Link label")}
          {field("url", "URL")}
        </>
      ) : block.type === "callout" ? (
        <>
          <label className="mt-3 block text-sm font-semibold">
            Classification
            <select
              value={String(content.kind)}
              onChange={(event) =>
                setValue({
                  ...value,
                  content: { ...content, kind: event.target.value },
                } as AuthoringBlock)
              }
              className="ml-2 rounded border px-2 py-1"
            >
              <option value="information">Information</option>
              <option value="reminder">Reminder</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          {field("title", "Callout title")}
          {field("body", "Callout body", "textarea")}
        </>
      ) : (
        <>
          {field("title", "Checklist title")}
          {field("items", "Items, one per line", "textarea")}
        </>
      )}
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        disabled={disabled}
        onClick={save}
        className="mt-4 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save block"}
      </button>
    </div>
  );
}
function normalizeLists(block: AuthoringBlock): AuthoringBlock {
  const content = block.content as Record<string, unknown>;
  if (block.type === "instruction" && typeof content.steps === "string")
    return {
      ...block,
      content: {
        ...content,
        steps: content.steps
          .split("\n")
          .map((text, index) => ({ id: `step-${index}`, text })),
      },
    } as AuthoringBlock;
  if (block.type === "checklist" && typeof content.items === "string")
    return {
      ...block,
      content: {
        ...content,
        items: content.items
          .split("\n")
          .map((text, index) => ({ id: `item-${index}`, text })),
      },
    } as AuthoringBlock;
  return block;
}
function Small({
  label,
  disabled,
  children,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="min-h-8 rounded border px-2 text-xs disabled:opacity-30"
    >
      {children}
    </button>
  );
}
function SaveState({ state, pending }: { state: string; pending: boolean }) {
  const label =
    pending || state === "saving"
      ? "Saving"
      : state === "saved"
        ? "Saved"
        : state === "conflict"
          ? "Conflict"
          : state === "offline"
            ? "Offline · local work retained"
            : state === "reconnecting"
              ? "Reconnecting"
              : state === "retrying"
                ? "Retrying"
                : "Save failed";
  return (
    <span
      data-focus-id="save-status"
      tabIndex={-1}
      role={state === "failed" || state === "conflict" ? "alert" : "status"}
      className="max-w-full whitespace-normal rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold"
    >
      {label}
    </span>
  );
}
function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ];
  if (!controls.length) return;
  const first = controls[0]!,
    last = controls.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

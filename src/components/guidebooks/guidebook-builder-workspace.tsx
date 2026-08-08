"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Copy,
  EyeOff,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  guidebookAuthoringCommandAction,
  listGuidebookDraftMediaAction,
  uploadGuidebookMediaAction,
} from "@/app/actions/guidebook-authoring";
import {
  blockSummary,
  compatibleComponents,
  guidebookHealth,
  type BuilderPanel,
  type BuilderPreviewMode,
  type BuilderSaveState,
} from "@/features/guidebook-builder";
import { MESA_MODERN_TOKENS } from "@/features/template-library";
import {
  evaluateGuidebookPublicationReadiness,
  type AuthoringBlock,
  type GuidebookDraft,
} from "@/features/guidebook-studio";

type Command = Parameters<typeof guidebookAuthoringCommandAction>[0]["command"];

const essentialContentItems = [
  { label: "Check-in & Check-out", componentKeys: ["arrival_instructions", "departure_checklist"] },
  { label: "WiFi & Internet", componentKeys: ["wifi_card"] },
  { label: "Parking Instructions", componentKeys: ["parking_card"] },
  { label: "House Rules", componentKeys: ["rule_card"] },
  { label: "Emergency Contact", componentKeys: ["emergency_contact_card"] },
  { label: "Amenities", componentKeys: ["appliance_card"] },
] as const;

function usedComponentKeys(draft: GuidebookDraft) {
  return new Set(
    draft.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.type === "component")
      .map((block) => block.content.componentKey),
  );
}

export function GuidebookBuilderWorkspace({
  initialDraft,
  versionId,
  canEdit,
  canPublish,
  basePath = "/dashboard/guidebooks",
  previewVariables = {},
}: {
  initialDraft: GuidebookDraft;
  versionId: string;
  canEdit: boolean;
  canPublish: boolean;
  basePath?: string;
  previewVariables?: Readonly<Record<string, string | null | undefined>>;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [sectionId, setSectionId] = useState(
    initialDraft.sections[0]?.id ?? "",
  );
  const [blockId, setBlockId] = useState("");
  const [panel, setPanel] = useState<BuilderPanel>("content");
  const [preview, setPreview] = useState<BuilderPreviewMode>("desktop");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [save, setSave] = useState<BuilderSaveState>("saved");
  const [, startTransition] = useTransition();
  const section =
    draft.sections.find((item) => item.id === sectionId) ?? draft.sections[0];
  const block = section?.blocks.find((item) => item.id === blockId);
  const health = useMemo(() => guidebookHealth(draft), [draft]);
  const usedKeys = useMemo(() => usedComponentKeys(draft), [draft]);
  const publicationReadiness = useMemo(
    () => evaluateGuidebookPublicationReadiness(draft),
    [draft],
  );
  const components = useMemo(
    () =>
      compatibleComponents(section?.name ?? "").filter((item) =>
        `${item.name} ${item.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [section?.name, query],
  );

  function command(value: Command) {
    if (!canEdit) return;
    setSave("saving");
    startTransition(async () => {
      const result = await guidebookAuthoringCommandAction({
        workspaceId: draft.workspaceId,
        guidebookId: draft.guidebookId,
        expectedRevision: draft.revision,
        commandId: crypto.randomUUID(),
        command: value,
      });
      if (result.ok) {
        setDraft(result.value);
        setSave("saved");
      } else setSave(result.code === "DRAFT_CONFLICT" ? "conflict" : "failed");
    });
  }
  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div>
          <Link
            href={basePath}
            className="text-xs font-semibold text-emerald-800"
          >
            Guidebook Studio / Guidebooks
          </Link>
          <h1 className="font-semibold">{draft.title}</h1>
          <p className="text-xs text-stone-500">
            Draft revision {draft.revision} · Mesa Modern
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SaveStatus value={save} />
          <span>Revision {draft.revision}</span>
          <Link
            href={`/dashboard/guidebooks/${draft.guidebookId}/versions`}
            className="rounded-lg border p-2"
            aria-label="History"
          >
            <History className="size-4" />
          </Link>
          <Link
            href={`/guidebooks/${draft.guidebookId}/preview?viewport=desktop`}
            className="rounded-lg border px-3 py-2"
          >
            Draft preview
          </Link>
          <Link
            aria-disabled={
              !canPublish || publicationReadiness.status === "not-ready"
            }
            href={`${basePath}/${draft.guidebookId}/publish`}
            className={`rounded-lg bg-stone-950 px-4 py-2 font-semibold text-white ${!canPublish || publicationReadiness.status === "not-ready" ? "pointer-events-none opacity-40" : ""}`}
          >
            Publish
          </Link>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[240px_minmax(420px,1fr)_320px]">
        <aside className="border-r bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sections</h2>
            <button
              onClick={() => {
                const name = prompt("Section name");
                if (name)
                  command({
                    type: "create-section",
                    name,
                    afterSectionId: section?.id,
                  });
              }}
              aria-label="Add section"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <nav className="mt-4 space-y-2">
            {draft.sections.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-2 transition-colors ${section?.id === item.id ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-stone-200 hover:bg-stone-50"}`}
              >
                <button
                  onClick={() => {
                    setSectionId(item.id);
                    setBlockId("");
                  }}
                  className="w-full text-left text-sm font-semibold"
                >
                  {item.name}
                  {!item.visible ? " · Hidden" : ""}
                </button>
                {section?.id === item.id && canEdit ? (
                  <div className="mt-2 flex gap-1">
                    <Mini
                      label="Rename"
                      onClick={() => {
                        const name = prompt("Section title", item.name);
                        if (name)
                          command({
                            type: "rename-section",
                            sectionId: item.id,
                            name,
                          });
                      }}
                    >
                      <Pencil />
                    </Mini>
                    <Mini
                      label="Move up"
                      onClick={() =>
                        command({
                          type: "reorder-section",
                          sectionId: item.id,
                          direction: "up",
                        })
                      }
                    >
                      <ArrowUp />
                    </Mini>
                    <Mini
                      label="Move down"
                      onClick={() =>
                        command({
                          type: "reorder-section",
                          sectionId: item.id,
                          direction: "down",
                        })
                      }
                    >
                      <ArrowDown />
                    </Mini>
                    <Mini
                      label="Duplicate"
                      onClick={() =>
                        command({
                          type: "duplicate-section",
                          sectionId: item.id,
                        })
                      }
                    >
                      <Copy />
                    </Mini>
                    <Mini
                      label={item.visible ? "Hide" : "Show"}
                      onClick={() =>
                        command({
                          type: "section-visibility",
                          sectionId: item.id,
                          visible: !item.visible,
                        })
                      }
                    >
                      <EyeOff />
                    </Mini>
                    <Mini
                      label="Remove"
                      onClick={() => {
                        if (confirm(`Remove ${item.name}?`))
                          command({
                            type: "delete-section",
                            sectionId: item.id,
                          });
                      }}
                    >
                      <Trash2 />
                    </Mini>
                  </div>
                ) : null}
              </article>
            ))}
          </nav>
          <button
            disabled={!section || !canEdit}
            onClick={() => setPicker(true)}
            className="mt-4 w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            + Add Component
          </button>
          <section className="mt-6 rounded-xl border bg-stone-50 p-4">
            <div className="flex justify-between text-xs">
              <strong>Guidebook Health</strong>
              <span className="font-semibold">{health.score}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-stone-200">
              <div
                className="h-full bg-emerald-800 transition-[width] duration-300"
                style={{ width: `${health.score}%` }}
              />
            </div>
            <button
              onClick={() => setPanel("validation")}
              className="mt-3 text-left text-xs font-semibold text-emerald-800"
            >
              {health.publishable
                ? health.issues.length
                  ? `${health.issues.length} improvements recommended`
                  : "Ready to publish"
                : `${health.issues.filter((item) => item.blocking).length} items need attention`}
            </button>
          </section>
          <section className="mt-4 rounded-xl border bg-stone-50 p-4">
            <strong className="text-xs">Add Essential Content</strong>
            <div className="mt-3 space-y-2">
              {essentialContentItems.map((item) => {
                const complete = item.componentKeys.every((key) => usedKeys.has(key));
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      {complete ? (
                        <Check className="size-4 text-emerald-700" />
                      ) : (
                        <Circle className="size-4 text-stone-300" />
                      )}
                      {item.label}
                    </span>
                    {complete ? null : (
                      <button
                        disabled={!canEdit || !draft.sections[0]}
                        onClick={() => {
                          const targetSectionId = draft.sections[0]?.id;
                          if (!targetSectionId) return;
                          for (const componentKey of item.componentKeys) {
                            command({
                              type: "create-block",
                              sectionId: targetSectionId,
                              blockType: "component",
                              componentKey,
                            });
                          }
                        }}
                        className="font-semibold text-emerald-800 disabled:opacity-40"
                      >
                        Add details
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
        <section className="min-w-0 p-4">
          <div className="mb-3 flex flex-wrap justify-between gap-2">
            <div className="flex gap-1">
              {(["desktop", "tablet", "mobile"] as BuilderPreviewMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreview(mode)}
                    className={`rounded-lg border px-3 py-2 text-xs capitalize ${preview === mode ? "bg-stone-950 text-white" : "bg-white"}`}
                  >
                    {mode.replaceAll("_", " ")}
                  </button>
                ),
              )}
            </div>
            <span className="rounded-lg border bg-white px-3 py-2 text-xs">
              Mesa Modern · {versionId}
            </span>
          </div>
          <Canvas
            draft={draft}
            sectionId={section?.id}
            selected={blockId}
            mode={preview}
            previewVariables={previewVariables}
            onSelect={(id) => {
              setBlockId(id);
              setPanel("content");
            }}
            onCommand={command}
          />
        </section>
        <aside className="border-l bg-white p-4">
          <h2 className="font-semibold">Properties</h2>
          {panel === "validation" ? (
            <Validation
              issues={health.issues}
              onFix={(issue) => {
                if (issue.sectionId) setSectionId(issue.sectionId);
                if (issue.blockId) setBlockId(issue.blockId);
                setPanel("content");
              }}
            />
          ) : (
            <>
              <div className="mt-4 flex gap-3 overflow-x-auto border-b text-xs">
                {(
                  [
                    "content",
                    "bindings",
                    "media",
                    "actions",
                    "visibility",
                    "layout",
                  ] as BuilderPanel[]
                ).map((item) => (
                  <button
                    key={item}
                    onClick={() => setPanel(item)}
                    className={`pb-2 capitalize ${panel === item ? "border-b-2 border-emerald-800 font-semibold" : ""}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <PropertyPanel
                block={block}
                panel={panel}
                sectionName={section?.name}
                workspaceId={draft.workspaceId}
                guidebookId={draft.guidebookId}
                canEdit={canEdit}
                onUpdate={(value) =>
                  section &&
                  command({
                    type: "update-block",
                    sectionId: section.id,
                    block: value,
                  })
                }
              />
            </>
          )}
        </aside>
      </div>
      {picker ? (
        <Picker
          components={components}
          query={query}
          setQuery={setQuery}
          close={() => setPicker(false)}
          insert={(componentKey) => {
            if (section)
              command({
                type: "create-block",
                sectionId: section.id,
                blockType: "component",
                componentKey,
              });
            setPicker(false);
          }}
        />
      ) : null}
    </main>
  );
}

function Canvas({
  draft,
  sectionId,
  selected,
  mode,
  previewVariables,
  onSelect,
  onCommand,
}: {
  draft: GuidebookDraft;
  sectionId?: string;
  selected: string;
  mode: BuilderPreviewMode;
  previewVariables: Readonly<Record<string, string | null | undefined>>;
  onSelect: (id: string) => void;
  onCommand: (value: Command) => void;
}) {
  const section = draft.sections.find((item) => item.id === sectionId),
    narrow = mode === "mobile" || mode === "guest_portal",
    pdf = mode === "pdf";
  return (
    <div
      className={`mx-auto min-h-[720px] overflow-hidden bg-[#FAFAF8] shadow-xl ${narrow ? "max-w-sm rounded-[2rem] border-[8px] border-stone-950" : pdf ? "aspect-[8.5/11] max-w-2xl" : "max-w-5xl rounded-xl"}`}
    >
      <header className="bg-[#0B2B24] p-5 text-white">
        <strong className="font-serif">{draft.title}</strong>
      </header>
      <div className="p-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">
          {section?.name ?? "Section"}
        </p>
        {section?.blocks.length ? (
          <div className="mt-6 space-y-4">
            {section.blocks.map((item) => (
              <article
                key={item.id}
                hidden={!item.visible}
                onClick={() => onSelect(item.id)}
                className={`group relative cursor-pointer rounded-xl border bg-white p-5 transition-all hover:border-emerald-300 hover:shadow-sm ${selected === item.id ? "ring-2 ring-emerald-600" : ""}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {item.type === "component"
                    ? item.content.componentKey.replaceAll("_", " ")
                    : item.type}
                </span>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {resolvePreview(blockSummary(item), previewVariables)}
                </p>
                {selected === item.id ? (
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Mini
                      label="Move component up"
                      onClick={() =>
                        onCommand({
                          type: "reorder-block",
                          sectionId: section.id,
                          blockId: item.id,
                          direction: "up",
                        })
                      }
                    >
                      <ArrowUp />
                    </Mini>
                    <Mini
                      label="Move component down"
                      onClick={() =>
                        onCommand({
                          type: "reorder-block",
                          sectionId: section.id,
                          blockId: item.id,
                          direction: "down",
                        })
                      }
                    >
                      <ArrowDown />
                    </Mini>
                    <Mini
                      label="Duplicate component"
                      onClick={() =>
                        onCommand({
                          type: "duplicate-block",
                          sectionId: section.id,
                          blockId: item.id,
                        })
                      }
                    >
                      <Copy />
                    </Mini>
                    <Mini
                      label={item.visible ? "Hide component" : "Show component"}
                      onClick={() =>
                        onCommand({
                          type: "block-visibility",
                          sectionId: section.id,
                          blockId: item.id,
                          visible: !item.visible,
                        })
                      }
                    >
                      <EyeOff />
                    </Mini>
                    <Mini
                      label="Delete component"
                      onClick={() => {
                        if (
                          confirm(
                            item.type === "component" &&
                              item.content.source === "content_record"
                              ? "Remove this component? The Content Library record will not be deleted."
                              : "Remove this component and its inline draft content?",
                          )
                        )
                          onCommand({
                            type: "delete-block",
                            sectionId: section.id,
                            blockId: item.id,
                          });
                      }}
                    >
                      <Trash2 />
                    </Mini>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[560px] place-items-center text-center">
            <div>
              <h2 className="text-2xl font-semibold">
                This section doesn&apos;t have any components yet.
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                Add a compatible Mesa Modern component to begin authoring.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyPanel({
  block,
  panel,
  sectionName,
  workspaceId,
  guidebookId,
  canEdit,
  onUpdate,
}: {
  block?: AuthoringBlock;
  panel: BuilderPanel;
  sectionName?: string;
  workspaceId: string;
  guidebookId: string;
  canEdit: boolean;
  onUpdate: (block: AuthoringBlock) => void;
}) {
  if (!block)
    return (
      <p className="mt-5 text-sm text-stone-500">
        Select a component in {sectionName ?? "the canvas"} to configure it.
      </p>
    );
  if (block.type === "component") {
    const update = (content: typeof block.content) =>
      onUpdate({ ...block, content });
    if (panel === "content")
      return (
        <div className="mt-5 space-y-4">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold capitalize text-emerald-800">
            {block.content.source === "content_record" ? "Library" : "Inline"}
          </span>
          <label className="block text-sm font-semibold">
            Heading
            <input
              defaultValue={block.content.fields.title ?? ""}
              onBlur={(event) =>
                update({
                  ...block.content,
                  fields: {
                    ...block.content.fields,
                    title: event.target.value,
                  },
                })
              }
              className="mt-2 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Content
            <textarea
              defaultValue={block.content.fields.body ?? ""}
              onBlur={(event) =>
                update({
                  ...block.content,
                  fields: { ...block.content.fields, body: event.target.value },
                })
              }
              rows={8}
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>
          <VariableButtons
            onInsert={(value) =>
              update({
                ...block.content,
                fields: {
                  ...block.content.fields,
                  body: `${block.content.fields.body ?? ""}${value}`,
                },
              })
            }
          />
          <p className="text-xs text-stone-500">
            Text saves when focus leaves the field. HTML and presentation styles
            are not accepted.
          </p>
        </div>
      );
    if (panel === "bindings")
      return (
        <div className="mt-5 space-y-3">
          <Option
            title="Use Library Content"
            body="Choose a workspace-scoped content record."
          />
          <Option
            title="Enter Content Here"
            body="Keep content inline in this draft."
          />
          <div className="rounded-xl border p-4">
            <strong className="text-sm">Property variables</strong>
            <dl className="mt-2 space-y-1 text-xs">
              {Object.entries(block.content.variableBindings).map(
                ([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        </div>
      );
    if (panel === "media")
      return (
        <MediaPanel
          block={block}
          workspaceId={workspaceId}
          guidebookId={guidebookId}
          canEdit={canEdit}
          onUpdate={update}
        />
      );
    if (panel === "visibility")
      return (
        <label className="mt-5 flex items-center justify-between rounded-xl border p-4 text-sm font-semibold">
          Visible
          <input
            type="checkbox"
            checked={block.visible}
            onChange={(event) =>
              onUpdate({ ...block, visible: event.target.checked })
            }
          />
        </label>
      );
    if (panel === "layout")
      return (
        <div className="mt-5 grid gap-4">
          <label className="text-sm font-semibold">
            Width
            <select
              value={block.content.layout.width}
              onChange={(event) =>
                update({
                  ...block.content,
                  layout: {
                    ...block.content.layout,
                    width: event.target.value as "standard" | "wide",
                  },
                })
              }
              className="mt-2 block min-h-10 w-full rounded-lg border px-3"
            >
              <option value="standard">Standard</option>
              <option value="wide">Wide</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Variant
            <select
              value={block.content.layout.variant}
              onChange={(event) =>
                update({
                  ...block.content,
                  layout: {
                    ...block.content.layout,
                    variant: event.target.value as
                      | "compact"
                      | "standard"
                      | "featured",
                  },
                })
              }
              className="mt-2 block min-h-10 w-full rounded-lg border px-3"
            >
              <option>compact</option>
              <option>standard</option>
              <option>featured</option>
            </select>
          </label>
        </div>
      );
  }
  if (panel === "bindings" || panel === "media")
    return (
      <p className="mt-5 rounded-xl border bg-stone-50 p-4 text-sm leading-6 text-stone-600">
        Add a versioned component to manage its content sources and media.
      </p>
    );
  if (panel === "layout")
    return (
      <div className="mt-5">
        <Option title="Mesa Modern" body="Template-controlled presentation." />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            MESA_MODERN_TOKENS.colors.primary,
            MESA_MODERN_TOKENS.colors.accent,
            MESA_MODERN_TOKENS.colors.highlight,
          ].map((value) => (
            <span
              key={value}
              className="h-12 rounded border"
              style={{ background: value }}
            />
          ))}
        </div>
      </div>
    );
  return (
    <div className="mt-5 space-y-4">
      <label className="text-sm font-semibold">
        Component type
        <input
          value={block.type}
          readOnly
          className="mt-2 block min-h-10 w-full rounded-xl border bg-stone-50 px-3"
        />
      </label>
      <label className="text-sm font-semibold">
        Current content
        <textarea
          value={blockSummary(block)}
          readOnly
          rows={5}
          className="mt-2 block w-full rounded-xl border p-3"
        />
      </label>
      <p className="text-xs text-stone-500">
        Saves are revision-aware; published versions remain immutable.
      </p>
    </div>
  );
}

function MediaPanel({
  block,
  workspaceId,
  guidebookId,
  canEdit,
  onUpdate,
}: {
  block: Extract<AuthoringBlock, { type: "component" }>;
  workspaceId: string;
  guidebookId: string;
  canEdit: boolean;
  onUpdate: (content: typeof block.content) => void;
}) {
  const [media, setMedia] = useState<{ id: string; mimeType: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    listGuidebookDraftMediaAction({ workspaceId, guidebookId })
      .then(setMedia)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, guidebookId]);

  const selected = block.content.mediaRefs[0];
  const selectedMedia = media.find((item) => item.id === selected?.assetId);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("guidebookId", guidebookId);
    formData.set("commandId", crypto.randomUUID());
    formData.set("file", file);
    const result = await uploadGuidebookMediaAction(formData);
    setUploading(false);
    if (!result.ok) {
      setError("That image couldn't be uploaded. Use JPEG, PNG, WebP, or AVIF under 10MB.");
      return;
    }
    refresh();
    onUpdate({
      ...block.content,
      mediaRefs: [{ assetId: result.value.id, versionId: "v1", alt: "", decorative: false }],
    });
  }

  return (
    <div className="mt-5 space-y-4">
      {selected ? (
        <div className="rounded-xl border p-3">
          {selectedMedia ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedMedia.url} alt="" className="h-32 w-full rounded-lg object-cover" />
          ) : null}
          <label className="mt-3 block text-xs font-semibold">
            Alt text
            <input
              defaultValue={selected.alt}
              onBlur={(event) =>
                onUpdate({
                  ...block.content,
                  mediaRefs: [{ ...selected, alt: event.target.value }],
                })
              }
              placeholder="Describe this image for guests using a screen reader"
              className="mt-1 min-h-9 w-full rounded-lg border px-2 text-sm"
            />
          </label>
          {canEdit ? (
            <button
              onClick={() => onUpdate({ ...block.content, mediaRefs: [] })}
              className="mt-2 text-xs font-semibold text-red-700"
            >
              Remove image
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-stone-500">
          No media selected.
        </div>
      )}
      {canEdit ? (
        <label className="block">
          <span className="block w-full cursor-pointer rounded-lg bg-emerald-800 px-3 py-2 text-center text-sm font-semibold text-white">
            {uploading ? "Uploading…" : "Upload Media"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleUpload}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div>
        <strong className="text-xs">Media library</strong>
        {loading ? (
          <p className="mt-2 text-xs text-stone-500">Loading…</p>
        ) : media.length ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {media.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  onUpdate({
                    ...block.content,
                    mediaRefs: [
                      { assetId: item.id, versionId: "v1", alt: selected?.alt ?? "", decorative: false },
                    ],
                  })
                }
                className={`overflow-hidden rounded-lg border-2 ${item.id === selected?.assetId ? "border-emerald-700" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="h-16 w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-stone-500">No uploads yet.</p>
        )}
      </div>
    </div>
  );
}

function Picker({
  components,
  query,
  setQuery,
  close,
  insert,
}: {
  components: ReturnType<typeof compatibleComponents>;
  query: string;
  setQuery: (value: string) => void;
  close: () => void;
  insert: (
    value: ReturnType<typeof compatibleComponents>[number]["key"],
  ) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="component-picker-title"
    >
      <section className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6">
        <div className="flex justify-between">
          <div>
            <h2 id="component-picker-title" className="text-xl font-semibold">
              Add a Component
            </h2>
            <p className="text-sm text-stone-500">
              Compatible with this section and Mesa Modern.
            </p>
          </div>
          <button onClick={close}>Close</button>
        </div>
        <label className="relative mt-5 block">
          <Search className="absolute left-3 top-3 size-4" />
          <span className="sr-only">Search components</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search components…"
            className="min-h-10 w-full rounded-xl border pl-9"
          />
        </label>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {[
            "All",
            "Foundation",
            "Arrival",
            "Stay",
            "Safety",
            "Explore",
            "Departure",
            "Engagement",
            "Media",
          ].map((value) => (
            <span key={value} className="rounded-full border px-3 py-1 text-xs">
              {value}
            </span>
          ))}
        </div>
        {components.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {components.map((item) => (
              <button
                key={item.key}
                onClick={() => insert(item.key)}
                className="rounded-xl border p-5 text-left hover:border-emerald-600"
              >
                <span className="text-xs font-semibold capitalize text-emerald-700">
                  {item.category}
                </span>
                <strong className="mt-2 block">{item.name}</strong>
                <p className="mt-2 text-xs text-stone-500">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-stone-500">
            No compatible components match your search.
          </p>
        )}
      </section>
    </div>
  );
}
function VariableButtons({ onInsert }: { onInsert: (value: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold">Insert property variable</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {[
          "property.name",
          "property.address",
          "stay.check_in_time",
          "stay.check_out_time",
          "wifi.network",
          "wifi.password",
          "host.phone",
          "host.email",
        ].map((key) => (
          <button
            key={key}
            onClick={() => onInsert(`{{${key}}}`)}
            className="rounded border px-2 py-1 text-xs"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
function resolvePreview(
  value: string,
  variables: Readonly<Record<string, string | null | undefined>>,
) {
  return value.replace(
    /\{\{([^}]+)\}\}/g,
    (_match, key: string) => variables[key]?.trim() || `Missing value: ${key}`,
  );
}
function Validation({
  issues,
  onFix,
}: {
  issues: ReturnType<typeof guidebookHealth>["issues"];
  onFix: (issue: ReturnType<typeof guidebookHealth>["issues"][number]) => void;
}) {
  return (
    <div className="mt-5 space-y-2">
      {issues.length ? (
        issues.map((issue, index) => (
          <button
            key={`${issue.code}-${index}`}
            onClick={() => onFix(issue)}
            className={`w-full rounded-xl border p-3 text-left text-sm ${issue.blocking ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
          >
            <strong className="capitalize">{issue.severity}</strong>
            <p>{issue.message}</p>
          </button>
        ))
      ) : (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <Check className="mr-2 inline size-4" />
          Ready to publish.
        </p>
      )}
    </div>
  );
}
function Option({ title, body }: { title: string; body: string }) {
  return (
    <button className="w-full rounded-xl border p-4 text-left">
      <strong className="text-sm">{title}</strong>
      <p className="mt-1 text-xs text-stone-500">{body}</p>
    </button>
  );
}
function Mini({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded border p-1 [&_svg]:size-3"
    >
      {children}
    </button>
  );
}
function SaveStatus({ value }: { value: BuilderSaveState }) {
  return (
    <span
      role="status"
      className={`rounded-full px-2 py-1 font-semibold ${value === "saved" ? "bg-emerald-50 text-emerald-800" : value === "conflict" || value === "failed" ? "bg-rose-50 text-rose-800" : "bg-amber-50"}`}
    >
      {value}
    </span>
  );
}

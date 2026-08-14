"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  GripVertical,
  History,
  Menu,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  guidebookAuthoringCommandAction,
  listGuidebookDraftMediaAction,
  uploadGuidebookMediaAction,
} from "@/app/actions/guidebook-authoring";
import {
  autosaveDelay,
  compatibleComponents,
  ESSENTIAL_CONTENT_ITEMS,
  guidebookHealth,
  type BuilderPanel,
  type BuilderPreviewMode,
  type BuilderSaveState,
} from "@/features/guidebook-builder";
import { MESA_MODERN_TOKENS } from "@/features/template-library";
import { EXPERIENCE_COMPONENT_V1 } from "@/features/experience-components";
import {
  buildMediaDimensionMap,
  evaluateGuidebookPublicationReadiness,
  type AuthoringBlock,
  type AuthoringBlockType,
  type GuidebookDraft,
  type MediaDimensionMap,
} from "@/features/guidebook-studio";

type Command = Parameters<typeof guidebookAuthoringCommandAction>[0]["command"];
type BuilderLifecycleStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";
const HISTORY_LIMIT = 20;

function usedComponentKeys(draft: GuidebookDraft) {
  return new Set(
    draft.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.type === "component")
      .map((block) => block.content.componentKey),
  );
}

const ESSENTIAL_SECTION_NAMES: Record<string, string> = {
  arrival: "Arrival",
  wifi: "Wi-Fi",
  parking: "Parking",
  rules: "House Rules",
  emergency: "Contact",
  amenities: "Amenities",
};
function essentialSectionName(key: string) {
  return ESSENTIAL_SECTION_NAMES[key];
}
function essentialTargetSectionId(draft: GuidebookDraft, key: string) {
  const name = essentialSectionName(key);
  return (
    draft.sections.find((section) => section.name === name)?.id ??
    draft.sections[0]?.id
  );
}

export function GuidebookBuilderWorkspace({
  initialDraft,
  versionId,
  canEdit,
  canPublish,
  surface,
  lifecycleStatus,
  basePath = "/dashboard/guidebooks",
  propertyName = "Property",
  customerLabel,
}: {
  initialDraft: GuidebookDraft;
  versionId: string;
  canEdit: boolean;
  canPublish: boolean;
  surface: "admin" | "dashboard";
  lifecycleStatus: BuilderLifecycleStatus;
  basePath?: string;
  propertyName?: string;
  customerLabel?: string;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [sectionId, setSectionId] = useState(
    initialDraft.sections[0]?.id ?? "",
  );
  const [blockId, setBlockId] = useState("");
  const [heroSelected, setHeroSelected] = useState(false);
  const [panel, setPanel] = useState<BuilderPanel>("content");
  const [railMode, setRailMode] = useState<"outline" | "readiness">(
    "outline",
  );
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [preview, setPreview] = useState<BuilderPreviewMode>("desktop");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [save, setSave] = useState<BuilderSaveState>("saved");
  const [lastFailedCommand, setLastFailedCommand] = useState<Command | null>(null);
  const [history, setHistory] = useState<GuidebookDraft["sections"][]>([]);
  const [future, setFuture] = useState<GuidebookDraft["sections"][]>([]);
  const [mediaDimensions, setMediaDimensions] = useState<MediaDimensionMap>(
    {},
  );
  const [, startTransition] = useTransition();
  const section =
    draft.sections.find((item) => item.id === sectionId) ?? draft.sections[0];
  const block = section?.blocks.find((item) => item.id === blockId);
  const health = useMemo(() => guidebookHealth(draft), [draft]);
  const usedKeys = useMemo(() => usedComponentKeys(draft), [draft]);
  const essentialIncompleteCount = useMemo(
    () =>
      ESSENTIAL_CONTENT_ITEMS.filter(
        (item) => !item.componentKeys.every((key) => usedKeys.has(key)),
      ).length,
    [usedKeys],
  );
  const publicationReadiness = useMemo(
    () => evaluateGuidebookPublicationReadiness(draft, mediaDimensions),
    [draft, mediaDimensions],
  );
  function refreshMediaDimensions() {
    listGuidebookDraftMediaAction({
      workspaceId: draft.workspaceId,
      guidebookId: draft.guidebookId,
    }).then((media) => setMediaDimensions(buildMediaDimensionMap(media)));
  }
  useEffect(() => {
    refreshMediaDimensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.workspaceId, draft.guidebookId]);
  useEffect(() => {
    const selectPreviewBlock = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; blockId?: string } | null;
      if (data?.type !== "guidebook-preview:block-selected" || !data.blockId) return;
      const owner = draft.sections.find((item) =>
        item.blocks.some((candidate) => candidate.id === data.blockId),
      );
      if (!owner) return;
      setSectionId(owner.id);
      setHeroSelected(false);
      setBlockId(data.blockId);
      setPanel("content");
      setMobileInspectorOpen(true);
    };
    const selectPreviewHero = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== "guidebook-preview:hero-selected") return;
      setHeroSelected(true);
      setBlockId("");
      setPanel("content");
      setMobileInspectorOpen(true);
    };
    window.addEventListener("message", selectPreviewBlock);
    window.addEventListener("message", selectPreviewHero);
    return () => {
      window.removeEventListener("message", selectPreviewBlock);
      window.removeEventListener("message", selectPreviewHero);
    };
  }, [draft.sections]);
  const components = useMemo(
    () =>
      compatibleComponents(section?.name ?? "").filter((item) =>
        `${item.name} ${item.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [section?.name, query],
  );

  function runCommand(value: Command, record: boolean): Promise<boolean> {
    if (!canEdit) return Promise.resolve(false);
    const before = draft.sections;
    setSave("saving");
    return new Promise((resolve) => {
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
          setLastFailedCommand(null);
          if (record) {
            setHistory((stack) => [...stack.slice(-(HISTORY_LIMIT - 1)), before]);
            setFuture([]);
          }
          resolve(true);
        } else {
          setLastFailedCommand(value);
          setSave(result.code === "DRAFT_CONFLICT" ? "conflict" : "failed");
          resolve(false);
        }
      });
    });
  }
  function command(value: Command) {
    return runCommand(value, true);
  }
  function undo() {
    const previous = history[history.length - 1];
    if (!previous || !canEdit) return;
    setHistory((stack) => stack.slice(0, -1));
    setFuture((stack) => [...stack, draft.sections]);
    runCommand({ type: "restore-sections", sections: previous }, false);
  }
  function redo() {
    const next = future[future.length - 1];
    if (!next || !canEdit) return;
    setFuture((stack) => stack.slice(0, -1));
    setHistory((stack) => [...stack, draft.sections]);
    runCommand({ type: "restore-sections", sections: next }, false);
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((event.target as HTMLElement | null)?.isContentEditable) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div>
          <Link
            href={basePath}
            className="text-xs font-semibold text-emerald-800"
          >
            ← Back to guidebooks
          </Link>
          <h1 className="font-semibold">{draft.title}</h1>
          <p className="flex items-center gap-2 text-xs text-stone-500">
            {surface === "admin" && customerLabel ? `${customerLabel} · ` : ""}
            {propertyName} · Revision {draft.revision} ·{" "}
            <SaveStatus
              value={save}
              onRetry={lastFailedCommand ? () => runCommand(lastFailedCommand, false) : undefined}
            />
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <LifecycleStatus value={lifecycleStatus} />
            <span className="text-stone-500">
              {surface === "admin" ? "Admin operator" : "Customer workspace"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setMobileRailOpen(true)}
            aria-label="Open guidebook outline"
            className="rounded-lg border p-2 lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <Link
            href={`/dashboard/guidebooks/${draft.guidebookId}/preview?mode=draft&viewport=desktop`}
            className="rounded-lg border px-3 py-2"
          >
            Preview
          </Link>
          <Link
            aria-disabled={
              !canPublish || publicationReadiness.status === "not-ready"
            }
            href={`${basePath}/${draft.guidebookId}/publish`}
            className={`rounded-lg bg-stone-950 px-4 py-2 font-semibold text-white ${!canPublish || publicationReadiness.status === "not-ready" ? "pointer-events-none opacity-40" : ""}`}
          >
            Review & Publish
          </Link>
          <details className="relative">
            <summary
              aria-label="More guidebook actions"
              className="flex cursor-pointer list-none rounded-lg border p-2"
            >
              <Ellipsis className="size-4" />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-44 space-y-1 rounded-xl border bg-white p-2 shadow-2xl">
              <button
                onClick={undo}
                disabled={!canEdit || !history.length}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left disabled:opacity-30"
              >
                <Undo2 className="size-4" /> Undo
              </button>
              <button
                onClick={redo}
                disabled={!canEdit || !future.length}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left disabled:opacity-30"
              >
                <Redo2 className="size-4" /> Redo
              </button>
              <Link
                href={`/dashboard/guidebooks/${draft.guidebookId}/versions`}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2"
              >
                <History className="size-4" /> Version history
              </Link>
            </div>
          </details>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[240px_minmax(420px,1fr)_320px]">
        <aside
          className={`z-40 border-r bg-white p-4 lg:static lg:block ${mobileRailOpen ? "fixed inset-0 overflow-y-auto" : "hidden lg:block"}`}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <strong className="text-sm">Outline</strong>
            <button
              onClick={() => setMobileRailOpen(false)}
              aria-label="Close outline"
              className="rounded-lg border p-2"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              aria-pressed={railMode === "outline"}
              onClick={() => setRailMode("outline")}
              className={`rounded-lg border px-3 py-2 ${railMode === "outline" ? "bg-stone-950 text-white" : "bg-white"}`}
            >
              Outline
            </button>
            <button
              aria-pressed={railMode === "readiness"}
              onClick={() => setRailMode("readiness")}
              className={`rounded-lg border px-3 py-2 ${railMode === "readiness" ? "bg-stone-950 text-white" : "bg-white"}`}
            >
              Readiness
            </button>
          </div>
          {railMode === "outline" ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Guidebook outline</h2>
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
              <nav className="mt-3 space-y-1">
                {draft.sections.map((item) => {
                  const essential = ESSENTIAL_CONTENT_ITEMS.find(
                    (essentialItem) =>
                      essentialSectionName(essentialItem.key) === item.name,
                  );
                  const needsAttention =
                    essential &&
                    !essential.componentKeys.every((key) => usedKeys.has(key));
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${section?.id === item.id ? "bg-emerald-50 font-semibold text-emerald-900" : "hover:bg-stone-50"}`}
                    >
                      <GripVertical className="size-4 shrink-0 text-stone-300" />
                      <button
                        onClick={() => {
                          setSectionId(item.id);
                          setBlockId("");
                          setMobileRailOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate text-left"
                      >
                        {item.name}
                      </button>
                      {needsAttention ? (
                        <span
                          aria-label="Needs attention"
                          className="size-2 shrink-0 rounded-full bg-amber-500"
                        />
                      ) : item.visible ? (
                        <Eye className="size-4 shrink-0 text-stone-400" />
                      ) : (
                        <EyeOff className="size-4 shrink-0 text-stone-400" />
                      )}
                      {section?.id === item.id && canEdit ? (
                        <details className="relative shrink-0">
                          <summary
                            aria-label={`${item.name} section menu`}
                            className="flex cursor-pointer list-none rounded p-1"
                          >
                            <Ellipsis className="size-4" />
                          </summary>
                          <div className="absolute right-0 z-40 mt-1 w-40 space-y-1 rounded-xl border bg-white p-2 text-left text-xs font-normal shadow-2xl">
                            <button
                              onClick={() => {
                                const name = prompt("Section title", item.name);
                                if (name)
                                  command({
                                    type: "rename-section",
                                    sectionId: item.id,
                                    name,
                                  });
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5"
                            >
                              <Pencil className="size-3.5" /> Rename
                            </button>
                            <button
                              onClick={() =>
                                command({
                                  type: "reorder-section",
                                  sectionId: item.id,
                                  direction: "up",
                                })
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5"
                            >
                              <ArrowUp className="size-3.5" /> Move up
                            </button>
                            <button
                              onClick={() =>
                                command({
                                  type: "reorder-section",
                                  sectionId: item.id,
                                  direction: "down",
                                })
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5"
                            >
                              <ArrowDown className="size-3.5" /> Move down
                            </button>
                            <button
                              onClick={() =>
                                command({
                                  type: "duplicate-section",
                                  sectionId: item.id,
                                })
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5"
                            >
                              <Copy className="size-3.5" /> Duplicate
                            </button>
                            <button
                              onClick={() =>
                                command({
                                  type: "section-visibility",
                                  sectionId: item.id,
                                  visible: !item.visible,
                                })
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5"
                            >
                              <EyeOff className="size-3.5" />{" "}
                              {item.visible ? "Hide" : "Show"}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${item.name}?`))
                                  command({
                                    type: "delete-section",
                                    sectionId: item.id,
                                  });
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700"
                            >
                              <Trash2 className="size-3.5" /> Delete
                            </button>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
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
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
              >
                <Plus className="size-4" /> Add section
              </button>
              <section className="mt-6 rounded-xl border bg-stone-50 p-4">
                <div className="flex justify-between text-xs">
                  <strong>Guidebook readiness</strong>
                  <span className="font-semibold">{health.score}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-stone-200">
                  <div
                    className="h-full bg-emerald-800 transition-[width] duration-300"
                    style={{ width: `${health.score}%` }}
                  />
                </div>
                {essentialIncompleteCount ? (
                  <button
                    onClick={() => setRailMode("readiness")}
                    className="mt-3 text-left text-xs font-semibold text-emerald-800"
                  >
                    {essentialIncompleteCount} items need attention →
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-emerald-800">
                    Essential content complete
                  </p>
                )}
              </section>
            </>
          ) : (
            <ReadinessRail
              items={ESSENTIAL_CONTENT_ITEMS}
              usedKeys={usedKeys}
              score={health.score}
              incompleteCount={essentialIncompleteCount}
              canEdit={canEdit}
              onSelect={(item) => {
                const targetSectionId = essentialTargetSectionId(
                  draft,
                  item.key,
                );
                if (!targetSectionId) return;
                const complete = item.componentKeys.every((key) =>
                  usedKeys.has(key),
                );
                setSectionId(targetSectionId);
                setBlockId("");
                setPanel("content");
                setRailMode("outline");
                setMobileRailOpen(false);
                if (!complete && canEdit) setPicker(true);
              }}
            />
          )}
        </aside>
        <section className="min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Preview as:</span>
              <div className="flex gap-1">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as [BuilderPreviewMode, typeof Monitor][]
                ).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setPreview(mode)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs capitalize ${preview === mode ? "bg-stone-950 text-white" : "bg-white"}`}
                  >
                    <Icon className="size-3.5" />
                    {mode.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
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
            canEdit={canEdit}
            onSelect={(id) => {
              setHeroSelected(false);
              setBlockId(id);
              setPanel("content");
              setMobileInspectorOpen(true);
            }}
            onCommand={command}
            onAddBlock={() => setPicker(true)}
          />
        </section>
        <aside
          aria-label="Component properties"
          className={`z-40 border-l bg-white p-4 lg:static lg:block ${mobileInspectorOpen ? "fixed inset-0 overflow-y-auto" : "hidden lg:block"}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Properties</h2>
            <button
              type="button"
              onClick={() => setMobileInspectorOpen(false)}
              aria-label="Close component properties"
              className="grid size-11 place-items-center rounded-lg border lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>
          {heroSelected ? (
            <HeroPanel
              draft={draft}
              propertyName={propertyName}
              canEdit={canEdit}
              onDirty={() => setSave("unsaved")}
              onUpdate={(description, heroHeadline) =>
                command({ type: "update-details", description, heroHeadline })
              }
            />
          ) : panel === "validation" ? (
            <Validation
              issues={health.issues}
              onFix={(issue) => {
                if (issue.sectionId) setSectionId(issue.sectionId);
                if (issue.blockId) setBlockId(issue.blockId);
                setPanel(issue.field === "alt" ? "accessibility" : "content");
              }}
            />
          ) : (
            <>
              <div className="mt-4 grid gap-1 border-b pb-4 text-xs">
                {supportedPanels(block).map((item) => (
                  <button
                    key={item}
                    onClick={() => setPanel(item)}
                    className={`min-h-11 rounded-lg px-3 text-left capitalize ${panel === item ? "bg-emerald-50 font-semibold text-emerald-900" : "hover:bg-stone-50"}`}
                  >
                    {item === "bindings" ? "Data & bindings" : item}
                  </button>
                ))}
              </div>
              {panel === "theme" ? (
                <ThemePanel
                  brand={draft.brand}
                  canEdit={canEdit}
                  onSave={(brand) =>
                    runCommand({ type: "update-brand", brand }, false)
                  }
                />
              ) : (
                <PropertyPanel
                  block={block}
                  panel={panel}
                  sectionName={section?.name}
                  workspaceId={draft.workspaceId}
                  guidebookId={draft.guidebookId}
                  canEdit={canEdit}
                  onDirty={() => setSave("unsaved")}
                  onMediaUploaded={refreshMediaDimensions}
                  onUpdate={(value) =>
                    section &&
                    command({
                      type: "update-block",
                      sectionId: section.id,
                      block: value,
                    })
                  }
                />
              )}
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
          insertBasic={(blockType) => {
            if (section)
              command({ type: "create-block", sectionId: section.id, blockType });
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
  canEdit,
  onSelect,
  onCommand,
  onAddBlock,
}: {
  draft: GuidebookDraft;
  sectionId?: string;
  selected: string;
  mode: BuilderPreviewMode;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onCommand: (value: Command) => void;
  onAddBlock: () => void;
}) {
  const section = draft.sections.find((item) => item.id === sectionId);
  const viewport = mode === "mobile" ? "mobile" : mode === "tablet" ? "tablet" : "desktop";
  const frameWidth = viewport === "mobile" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[834px]" : "max-w-[1280px]";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-stone-600">
            {section?.name ?? "Select a section"} · Draft preview from saved revision {draft.revision}
          </p>
          {section && canEdit ? (
            <button onClick={onAddBlock} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold">
              <Plus className="size-4" /> Add block
            </button>
          ) : null}
        </div>
        {section?.blocks.length ? (
          <div className="mt-3 flex flex-wrap gap-2" aria-label={`${section.name} blocks`}>
            {section.blocks.map((item) => (
              <div key={item.id} className={`flex items-center rounded-lg border ${selected === item.id ? "ring-2 ring-emerald-600" : ""}`}>
                <button type="button" onClick={() => onSelect(item.id)} className="min-h-11 px-3 text-xs font-semibold">
                  {item.type === "component" ? item.content.componentKey.replaceAll("_", " ") : item.type}
                </button>
                {selected === item.id && canEdit ? (
                  <span className="flex border-l">
                    <Mini label="Move block up" onClick={() => onCommand({ type: "reorder-block", sectionId: section.id, blockId: item.id, direction: "up" })}><ArrowUp /></Mini>
                    <Mini label="Move block down" onClick={() => onCommand({ type: "reorder-block", sectionId: section.id, blockId: item.id, direction: "down" })}><ArrowDown /></Mini>
                    <Mini label="Duplicate block" onClick={() => onCommand({ type: "duplicate-block", sectionId: section.id, blockId: item.id })}><Copy /></Mini>
                    <Mini label="Delete block" onClick={() => {
                      if (confirm("Remove this block from the draft?"))
                        onCommand({ type: "delete-block", sectionId: section.id, blockId: item.id });
                    }}><Trash2 /></Mini>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">This section has no blocks yet.</p>
        )}
      </div>
      <div className={`mx-auto overflow-hidden rounded-xl border-4 border-stone-800 bg-white shadow-xl transition-[max-width] motion-reduce:transition-none ${frameWidth}`}>
        <iframe
          key={`${draft.revision}-${viewport}`}
          title={`${draft.title} saved draft preview at ${viewport} width`}
          src={`/dashboard/guidebooks/${draft.guidebookId}/preview?mode=draft&viewport=${viewport}&embed=1`}
          className="h-[760px] w-full bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

function ReadinessRail({
  items,
  usedKeys,
  score,
  incompleteCount,
  canEdit,
  onSelect,
}: {
  items: typeof ESSENTIAL_CONTENT_ITEMS;
  usedKeys: Set<string>;
  score: number;
  incompleteCount: number;
  canEdit: boolean;
  onSelect: (item: (typeof ESSENTIAL_CONTENT_ITEMS)[number]) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong className="text-sm">Publishing readiness</strong>
          <p className="text-xs text-stone-500">
            {incompleteCount
              ? `${incompleteCount} required item${incompleteCount === 1 ? "" : "s"} need attention.`
              : "All essential content is complete."}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold">
          {score}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-stone-200">
        <div
          className="h-full bg-emerald-800 transition-[width] duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-4 space-y-1">
        {items.map((item) => {
          const complete = item.componentKeys.every((key) =>
            usedKeys.has(key),
          );
          return (
            <button
              key={item.key}
              disabled={!canEdit}
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-stone-50 disabled:opacity-40"
            >
              {complete ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-amber-600" />
              )}
              <span className="min-w-0 flex-1">
                <strong className="block truncate font-semibold">
                  {item.label}
                </strong>
                <small className="block text-stone-500">
                  {complete ? "Complete" : "Needs details"}
                </small>
              </span>
              <ChevronRight className="size-4 shrink-0 text-stone-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemePanel({
  brand,
  canEdit,
  onSave,
}: {
  brand?: GuidebookDraft["brand"];
  canEdit: boolean;
  onSave: (brand: NonNullable<GuidebookDraft["brand"]>) => void;
}) {
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    brand?.primaryColor ?? MESA_MODERN_TOKENS.colors.primary,
  );
  const [accentColor, setAccentColor] = useState(
    brand?.accentColor ?? MESA_MODERN_TOKENS.colors.accent,
  );
  return (
    <div className="mt-5 space-y-4">
      <label className="block text-sm font-semibold">
        Logo URL
        <input
          value={logoUrl}
          disabled={!canEdit}
          onChange={(event) => setLogoUrl(event.target.value)}
          onBlur={() => onSave({ logoUrl, primaryColor, accentColor })}
          placeholder="https://…"
          className="mt-2 block min-h-10 w-full rounded-lg border px-3 disabled:opacity-50"
        />
      </label>
      <label className="block text-sm font-semibold">
        Primary color
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            disabled={!canEdit}
            value={primaryColor}
            onChange={(event) => {
              setPrimaryColor(event.target.value);
              onSave({
                logoUrl,
                primaryColor: event.target.value,
                accentColor,
              });
            }}
            className="size-10 rounded-lg border"
          />
          <span className="font-mono text-xs text-stone-500">
            {primaryColor}
          </span>
        </div>
      </label>
      <label className="block text-sm font-semibold">
        Accent color
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            disabled={!canEdit}
            value={accentColor}
            onChange={(event) => {
              setAccentColor(event.target.value);
              onSave({
                logoUrl,
                primaryColor,
                accentColor: event.target.value,
              });
            }}
            className="size-10 rounded-lg border"
          />
          <span className="font-mono text-xs text-stone-500">
            {accentColor}
          </span>
        </div>
      </label>
      <p className="text-xs text-stone-500">
        Applies to the guest-facing guide. Colors save immediately; the logo
        URL saves when you leave the field.
      </p>
    </div>
  );
}

function HeroPanel({
  draft,
  propertyName,
  canEdit,
  onDirty,
  onUpdate,
}: {
  draft: GuidebookDraft;
  propertyName: string;
  canEdit: boolean;
  onDirty: () => void;
  onUpdate: (description: string, heroHeadline: string) => Promise<boolean>;
}) {
  const [headline, setHeadline] = useState(draft.brand?.heroHeadline ?? "Welcome home.");
  const [description, setDescription] = useState(draft.description);
  const committed = useRef({ headline, description });
  const onUpdateRef = useRef(onUpdate);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const [heroSave, setHeroSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  const commit = useCallback(async () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    if (headline === committed.current.headline && description === committed.current.description) return;
    if (savingRef.current) return;
    const pending = { headline, description };
    savingRef.current = true;
    setHeroSave("saving");
    const saved = await onUpdateRef.current(pending.description, pending.headline);
    savingRef.current = false;
    if (saved) {
      committed.current = pending;
      setHeroSave("saved");
    } else {
      setHeroSave("failed");
    }
  }, [description, headline]);
  useEffect(() => {
    if (headline === committed.current.headline && description === committed.current.description) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void commit();
    }, autosaveDelay(true) ?? 650);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [commit, description, headline]);
  return (
    <div className="mt-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Edit hero</p>
      <label className="block text-sm font-semibold">
        Headline
        <input value={headline} disabled={!canEdit} onChange={(event) => { setHeadline(event.target.value); setHeroSave("idle"); onDirty(); }} onBlur={() => void commit()} className="mt-2 min-h-11 w-full rounded-xl border px-3 disabled:bg-stone-100" />
      </label>
      <label className="block text-sm font-semibold">
        Supporting text
        <textarea value={description} disabled={!canEdit} onChange={(event) => { setDescription(event.target.value); setHeroSave("idle"); onDirty(); }} onBlur={() => void commit()} rows={5} className="mt-2 w-full rounded-xl border p-3 disabled:bg-stone-100" />
      </label>
      <div aria-live="polite" className="flex items-center gap-3">
        <button type="button" disabled={!canEdit || heroSave === "saving"} onClick={() => void commit()} className="min-h-11 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {heroSave === "saving" ? "Saving…" : heroSave === "failed" ? "Retry save" : "Save hero"}
        </button>
        <span className={`text-xs ${heroSave === "failed" ? "text-rose-700" : "text-stone-500"}`}>
          {heroSave === "saved" ? "Hero saved to the draft." : heroSave === "failed" ? "Hero was not saved. Retry." : ""}
        </span>
      </div>
      <div className="rounded-xl border bg-stone-50 p-4 text-xs text-stone-600">
        <strong className="block text-stone-900">Property-bound details</strong>
        <span className="mt-1 block">{propertyName}, check-in, and checkout come from the authorized property record.</span>
      </div>
      <p className="text-xs text-stone-500">Changes autosave to the draft. Published versions remain unchanged.</p>
    </div>
  );
}

function ComponentContentFields({
  block,
  canEdit,
  onDirty,
  onUpdate,
}: {
  block: Extract<AuthoringBlock, { type: "component" }>;
  canEdit: boolean;
  onDirty: () => void;
  onUpdate: (content: typeof block.content) => void;
}) {
  const definition = EXPERIENCE_COMPONENT_V1.find(
    (item) => item.key === block.content.componentKey,
  );
  if (!definition)
    return (
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        This existing block is preserved, but it cannot be edited or published until an administrator upgrades it.
      </p>
    );
  if (!definition.content.length)
    return (
      <p className="mt-5 rounded-xl border bg-stone-50 p-4 text-sm text-stone-600">
        This component uses property data or structured collections and has no direct text fields.
      </p>
    );
  return (
    <div className="mt-5 space-y-4">
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold capitalize text-emerald-800">
        {block.content.source === "content_record" ? "Library content" : "Guidebook content"}
      </span>
      {definition.content.map((field) => (
        <AutosaveField
          key={`${block.id}:${field.key}`}
          label={field.label}
          required={field.required}
          multiline={field.type === "rich_text" || field.key === "body" || field.key === "instructions"}
          maxLength={field.validation?.maxLength}
          initialValue={block.content.fields[field.key] ?? ""}
          disabled={!canEdit}
          onDirty={onDirty}
          onCommit={(value) =>
            onUpdate({
              ...block.content,
              fields: { ...block.content.fields, [field.key]: value },
            })
          }
        />
      ))}
      <p className="text-xs text-stone-500">
        Changes save automatically. Scripts and unsupported markup are not accepted.
      </p>
    </div>
  );
}

function AutosaveField({
  label,
  initialValue,
  required,
  multiline,
  maxLength,
  disabled,
  onDirty,
  onCommit,
}: {
  label: string;
  initialValue: string;
  required: boolean;
  multiline: boolean;
  maxLength?: number;
  disabled: boolean;
  onDirty: () => void;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const committed = useRef(initialValue);
  useEffect(() => {
    if (value === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = value;
      onCommit(value);
    }, autosaveDelay(true) ?? 650);
    return () => window.clearTimeout(timer);
  }, [onCommit, value]);
  const common = {
    value,
    required,
    maxLength,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(event.target.value);
      onDirty();
    },
    className: "mt-2 min-h-11 w-full rounded-xl border px-3 py-2 disabled:bg-stone-100",
  };
  return (
    <label className="block text-sm font-semibold">
      {label} {required ? <span aria-hidden="true">*</span> : null}
      {multiline ? <textarea {...common} rows={6} /> : <input {...common} />}
    </label>
  );
}

function PropertyPanel({
  block,
  panel,
  sectionName,
  workspaceId,
  guidebookId,
  canEdit,
  onDirty,
  onUpdate,
  onMediaUploaded,
}: {
  block?: AuthoringBlock;
  panel: BuilderPanel;
  sectionName?: string;
  workspaceId: string;
  guidebookId: string;
  canEdit: boolean;
  onDirty: () => void;
  onUpdate: (block: AuthoringBlock) => void;
  onMediaUploaded: () => void;
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
        <ComponentContentFields
          block={block}
          canEdit={canEdit}
          onDirty={onDirty}
          onUpdate={update}
        />
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
          onMediaUploaded={onMediaUploaded}
        />
      );
    if (panel === "actions")
      return (
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Action label
            <input
              disabled={!canEdit}
              defaultValue={block.content.fields.actionLabel ?? ""}
              onBlur={(event) =>
                update({
                  ...block.content,
                  fields: { ...block.content.fields, actionLabel: event.target.value },
                })
              }
              className="mt-2 min-h-11 w-full rounded-xl border px-3 disabled:bg-stone-100"
            />
          </label>
          <label className="block text-sm font-semibold">
            Destination
            <input
              disabled={!canEdit}
              type="url"
              defaultValue={block.content.fields.actionUrl ?? ""}
              onBlur={(event) =>
                update({
                  ...block.content,
                  fields: { ...block.content.fields, actionUrl: event.target.value },
                })
              }
              placeholder="https://"
              className="mt-2 min-h-11 w-full rounded-xl border px-3 disabled:bg-stone-100"
            />
          </label>
        </div>
      );
    if (panel === "accessibility")
      return block.content.mediaRefs.length ? (
        <p className="mt-5 rounded-xl border bg-stone-50 p-4 text-sm text-stone-600">
          Alternative text is managed with the selected image in Media.
        </p>
      ) : (
        <p className="mt-5 rounded-xl border bg-stone-50 p-4 text-sm text-stone-600">
          This {block.content.componentKey.replaceAll("_", " ")} has no image requiring alternative text.
        </p>
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
  if (panel === "visibility")
    return (
      <label className="mt-5 flex min-h-11 items-center justify-between rounded-xl border p-4 text-sm font-semibold">
        Visible in guidebook
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={block.visible}
          onChange={(event) => onUpdate({ ...block, visible: event.target.checked })}
        />
      </label>
    );
  if (panel === "accessibility")
    return block.type === "image" ? (
      <label className="mt-5 block text-sm font-semibold">
        Image description
        <input
          disabled={!canEdit}
          value={block.content.alt}
          onChange={(event) =>
            onUpdate({ ...block, content: { ...block.content, alt: event.target.value } })
          }
          className="mt-2 min-h-11 w-full rounded-xl border px-3 disabled:bg-stone-100"
        />
      </label>
    ) : (
      <p className="mt-5 rounded-xl border bg-stone-50 p-4 text-sm text-stone-600">
        This {block.type} block does not require additional accessibility settings.
      </p>
    );
  if (block.type !== "component")
    return <LegacyBlockContentFields block={block} canEdit={canEdit} onDirty={onDirty} onUpdate={onUpdate} />;
  return null;
}

function LegacyBlockContentFields({
  block,
  canEdit,
  onDirty,
  onUpdate,
}: {
  block: Exclude<AuthoringBlock, { type: "component" }>;
  canEdit: boolean;
  onDirty: () => void;
  onUpdate: (block: AuthoringBlock) => void;
}) {
  const field = (label: string, value: string, commit: (value: string) => void, multiline = false) => (
    <AutosaveField
      key={`${block.id}:${label}`}
      label={label}
      initialValue={value}
      required={false}
      multiline={multiline}
      disabled={!canEdit}
      onDirty={onDirty}
      onCommit={commit}
    />
  );
  let fields: React.ReactNode;
  switch (block.type) {
    case "heading":
      fields = field("Heading", block.content.text, (text) => onUpdate({ ...block, content: { ...block.content, text } }));
      break;
    case "rich-text":
      fields = field("Text", block.content.text, (text) => onUpdate({ ...block, content: { text } }), true);
      break;
    case "callout":
      fields = <>{field("Title", block.content.title ?? "", (title) => onUpdate({ ...block, content: { ...block.content, title } }))}{field("Body", block.content.body, (body) => onUpdate({ ...block, content: { ...block.content, body } }), true)}</>;
      break;
    case "instruction":
      fields = <>{field("Title", block.content.title ?? "", (title) => onUpdate({ ...block, content: { ...block.content, title } }))}{field("Steps (one per line)", block.content.steps.map((item) => item.text).join("\n"), (value) => onUpdate({ ...block, content: { ...block.content, steps: value.split("\n").filter(Boolean).map((text, index) => ({ id: block.content.steps[index]?.id ?? crypto.randomUUID(), text })) } }), true)}</>;
      break;
    case "checklist":
      fields = <>{field("Title", block.content.title ?? "", (title) => onUpdate({ ...block, content: { ...block.content, title } }))}{field("Items (one per line)", block.content.items.map((item) => item.text).join("\n"), (value) => onUpdate({ ...block, content: { ...block.content, items: value.split("\n").filter(Boolean).map((text, index) => ({ id: block.content.items[index]?.id ?? crypto.randomUUID(), text })) } }), true)}</>;
      break;
    case "contact":
      fields = <>{field("Name", block.content.name, (name) => onUpdate({ ...block, content: { ...block.content, name } }))}{field("Role", block.content.role ?? "", (role) => onUpdate({ ...block, content: { ...block.content, role } }))}{field("Phone", block.content.phone ?? "", (phone) => onUpdate({ ...block, content: { ...block.content, phone } }))}</>;
      break;
    case "location":
      fields = <>{field("Label", block.content.label, (label) => onUpdate({ ...block, content: { ...block.content, label } }))}{field("Destination", block.content.destination, (destination) => onUpdate({ ...block, content: { ...block.content, destination } }))}{field("Map URL", block.content.mapUrl ?? "", (mapUrl) => onUpdate({ ...block, content: { ...block.content, mapUrl } }))}</>;
      break;
    case "link":
      fields = <>{field("Label", block.content.label, (label) => onUpdate({ ...block, content: { ...block.content, label } }))}{field("URL", block.content.url, (url) => onUpdate({ ...block, content: { ...block.content, url } }))}</>;
      break;
    case "image":
      fields = <>{field("Alternative text", block.content.alt, (alt) => onUpdate({ ...block, content: { ...block.content, alt } }))}{field("Caption", block.content.caption ?? "", (caption) => onUpdate({ ...block, content: { ...block.content, caption } }))}</>;
      break;
  }
  return (
    <div className="mt-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Edit {block.type.replaceAll("-", " ")}</p>
      {fields}
      <p className="text-xs text-stone-500">Changes autosave to a new draft revision. Published versions remain unchanged.</p>
    </div>
  );
}

function MediaPanel({
  block,
  workspaceId,
  guidebookId,
  canEdit,
  onUpdate,
  onMediaUploaded,
}: {
  block: Extract<AuthoringBlock, { type: "component" }>;
  workspaceId: string;
  guidebookId: string;
  canEdit: boolean;
  onUpdate: (content: typeof block.content) => void;
  onMediaUploaded: () => void;
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
    onMediaUploaded();
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
  insertBasic,
}: {
  components: ReturnType<typeof compatibleComponents>;
  query: string;
  setQuery: (value: string) => void;
  close: () => void;
  insert: (
    value: ReturnType<typeof compatibleComponents>[number]["key"],
  ) => void;
  insertBasic: (value: Exclude<AuthoringBlockType, "component">) => void;
}) {
  const basicBlocks: readonly Readonly<{
    type: Exclude<AuthoringBlockType, "component">;
    name: string;
    description: string;
  }>[] = [
    { type: "heading", name: "Heading", description: "Add a semantic section or subsection heading." },
    { type: "rich-text", name: "Rich Text", description: "Add paragraphs and longer guest guidance." },
    { type: "callout", name: "Callout", description: "Highlight an important note or reminder." },
    { type: "checklist", name: "Checklist", description: "Add an editable list of guest tasks." },
    { type: "instruction", name: "Instructions", description: "Add ordered step-by-step guidance." },
    { type: "contact", name: "Contact", description: "Add an authorized guest contact." },
    { type: "location", name: "Location", description: "Add a place, destination, and map link." },
    { type: "link", name: "Link", description: "Add a labeled destination link." },
    { type: "image", name: "Image", description: "Add an image with accessible text." },
  ];
  const matchingBasicBlocks = basicBlocks.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
  );
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
              Add a block
            </h2>
            <p className="text-sm text-stone-500">
              Choose a basic content block or an approved component compatible with this section.
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
            placeholder="Search blocks and components…"
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
        {matchingBasicBlocks.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Basic blocks</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {matchingBasicBlocks.map((item) => (
                <button key={item.type} onClick={() => insertBasic(item.type)} className="rounded-xl border p-5 text-left hover:border-emerald-600">
                  <span className="text-xs font-semibold text-emerald-700">Content</span>
                  <strong className="mt-2 block">{item.name}</strong>
                  <p className="mt-2 text-xs text-stone-500">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {components.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Approved components</h3>
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
          </div>
        ) : !matchingBasicBlocks.length ? (
          <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-stone-500">
            No compatible blocks or components match your search.
          </p>
        ) : null}
      </section>
    </div>
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
            {issue.field ? (
              <small className="mt-1 block font-semibold">Field: {issue.field}</small>
            ) : null}
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
function SaveStatus({
  value,
  onRetry,
}: {
  value: BuilderSaveState;
  onRetry?: () => void;
}) {
  const label: Record<BuilderSaveState, string> = {
    unsaved: "Unsaved changes",
    loading: "Loading…",
    saving: "Saving…",
    saved: "Saved",
    conflict: "Conflict detected — Review changes",
    offline: "Save paused — Offline",
    failed: "Save failed — Retry",
  };
  return (
    <span role="status" aria-live="polite">
      {value === "failed" && onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-800">
          {label[value]}
        </button>
      ) : value === "conflict" ? (
        <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-800">
          {label[value]}
        </button>
      ) : (
        <span className={`rounded-full px-2 py-1 font-semibold ${value === "saved" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50"}`}>
          {label[value]}
        </span>
      )}
    </span>
  );
}

function LifecycleStatus({ value }: { value: BuilderLifecycleStatus }) {
  const label: Record<BuilderLifecycleStatus, string> = {
    draft: "Draft",
    in_review: "In review",
    changes_requested: "Changes requested",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    archived: "Archived",
  };
  return (
    <span className="rounded-full border border-stone-300 bg-white px-2 py-1 font-semibold text-stone-700">
      {label[value]}
    </span>
  );
}

function supportedPanels(block?: AuthoringBlock): BuilderPanel[] {
  if (!block) return ["theme"];
  const panels: BuilderPanel[] = ["content"];
  if (block.type === "component") {
    panels.push("bindings");
    if (["hero", "image", "gallery", "recommendation_card", "property_summary"].includes(block.content.componentKey))
      panels.push("media");
    if (["review_cta", "social_links", "address_card", "transportation_card", "recommendation_card"].includes(block.content.componentKey))
      panels.push("actions");
  } else {
    if (block.type === "image") panels.push("media");
    if (["link", "location", "contact"].includes(block.type)) panels.push("actions");
  }
  panels.push("visibility", "layout", "accessibility");
  return panels;
}

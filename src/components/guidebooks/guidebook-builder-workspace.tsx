"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, Copy, EyeOff, History, Plus, Search, Trash2 } from "lucide-react";
import { guidebookAuthoringCommandAction, publishCanonicalGuidebookAction } from "@/app/actions/guidebook-authoring";
import { blockSummary, compatibleComponents, guidebookHealth, type BuilderPanel, type BuilderPreviewMode, type BuilderSaveState } from "@/features/guidebook-builder";
import { MESA_MODERN_TOKENS } from "@/features/template-library";
import type { AuthoringBlock, GuidebookDraft } from "@/features/guidebook-studio";

type Command = Parameters<typeof guidebookAuthoringCommandAction>[0]["command"];

export function GuidebookBuilderWorkspace({ initialDraft, versionId, canEdit, canPublish }: { initialDraft: GuidebookDraft; versionId: string; canEdit: boolean; canPublish: boolean }) {
  const [draft, setDraft] = useState(initialDraft);
  const [sectionId, setSectionId] = useState(initialDraft.sections[0]?.id ?? "");
  const [blockId, setBlockId] = useState("");
  const [panel, setPanel] = useState<BuilderPanel>("content");
  const [preview, setPreview] = useState<BuilderPreviewMode>("desktop");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [save, setSave] = useState<BuilderSaveState>("saved");
  const [publishing, setPublishing] = useState(false);
  const [pending, startTransition] = useTransition();
  const section = draft.sections.find((item) => item.id === sectionId) ?? draft.sections[0];
  const block = section?.blocks.find((item) => item.id === blockId);
  const health = useMemo(() => guidebookHealth(draft), [draft]);
  const components = useMemo(() => compatibleComponents(section?.name ?? "").filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [section?.name, query]);

  function command(value: Command) {
    if (!canEdit) return;
    setSave("saving");
    startTransition(async () => {
      const result = await guidebookAuthoringCommandAction({ workspaceId: draft.workspaceId, guidebookId: draft.guidebookId, expectedRevision: draft.revision, commandId: crypto.randomUUID(), command: value });
      if (result.ok) { setDraft(result.value); setSave("saved"); }
      else setSave(result.code === "DRAFT_CONFLICT" ? "conflict" : "failed");
    });
  }
  function publish() {
    if (!canPublish || !health.publishable) return;
    setPublishing(true);
    startTransition(async () => {
      const result = await publishCanonicalGuidebookAction({ workspaceId: draft.workspaceId, guidebookId: draft.guidebookId, expectedRevision: draft.revision, commandId: crypto.randomUUID() });
      setPublishing(false);
      if (!result.ok) setSave("failed");
    });
  }
  return <main className="min-h-screen bg-stone-100 text-stone-950">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
      <div><Link href="/admin/guidebooks/guidebooks" className="text-xs font-semibold text-emerald-800">← Guidebooks</Link><h1 className="font-semibold">{draft.title}</h1></div>
      <div className="flex items-center gap-2 text-xs"><SaveStatus value={save}/><span>Revision {draft.revision}</span><Link href={`/dashboard/guidebooks/${draft.guidebookId}/versions`} className="rounded-lg border p-2" aria-label="History"><History className="size-4"/></Link><button onClick={() => setPreview("desktop")} className="rounded-lg border px-3 py-2">Preview</button><button disabled={!canPublish || !health.publishable || publishing || pending} onClick={publish} className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-40">{publishing ? "Publishing…" : "Publish"}</button></div>
    </header>
    <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[240px_minmax(420px,1fr)_320px]">
      <aside className="border-r bg-white p-4">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Sections</h2><button onClick={() => { const name = prompt("Section name"); if (name) command({ type: "create-section", name, afterSectionId: section?.id }); }} aria-label="Add section"><Plus className="size-4"/></button></div>
        <nav className="mt-4 space-y-2">{draft.sections.map((item) => <article key={item.id} className={`rounded-xl border p-2 ${section?.id === item.id ? "border-emerald-800 bg-emerald-50" : ""}`}><button onClick={() => { setSectionId(item.id); setBlockId(""); }} className="w-full text-left text-sm font-semibold">{item.name}{!item.visible ? " · Hidden" : ""}</button>{section?.id === item.id && canEdit ? <div className="mt-2 flex gap-1"><Mini label="Duplicate" onClick={() => command({ type: "duplicate-section", sectionId: item.id })}><Copy/></Mini><Mini label="Hide" onClick={() => command({ type: "section-visibility", sectionId: item.id, visible: !item.visible })}><EyeOff/></Mini><Mini label="Archive" onClick={() => command({ type: "delete-section", sectionId: item.id })}><Trash2/></Mini></div> : null}</article>)}</nav>
        <button onClick={() => setPicker(true)} className="mt-4 w-full rounded-xl border border-dashed py-3 text-sm font-semibold text-emerald-800">+ Add component</button>
        <section className="mt-6 rounded-xl bg-stone-50 p-3"><div className="flex justify-between text-xs"><strong>Guidebook health</strong><span>{health.score}%</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-stone-200"><div className="h-full bg-emerald-800" style={{ width: `${health.score}%` }}/></div><button onClick={() => setPanel("validation")} className="mt-2 text-xs font-semibold text-emerald-800">{health.issues.length} issues</button></section>
      </aside>
      <section className="min-w-0 p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-2"><div className="flex gap-1">{(["desktop", "tablet", "mobile", "pdf", "guest_portal"] as BuilderPreviewMode[]).map((mode) => <button key={mode} onClick={() => setPreview(mode)} className={`rounded-lg border px-3 py-2 text-xs capitalize ${preview === mode ? "bg-stone-950 text-white" : "bg-white"}`}>{mode.replaceAll("_", " ")}</button>)}</div><span className="rounded-lg border bg-white px-3 py-2 text-xs">Mesa Modern · {versionId}</span></div>
        <Canvas draft={draft} sectionId={section?.id} selected={blockId} mode={preview} onSelect={(id) => { setBlockId(id); setPanel("content"); }} onAdd={() => setPicker(true)}/>
      </section>
      <aside className="border-l bg-white p-4">
        <h2 className="font-semibold">Properties</h2>
        {panel === "validation" ? <Validation issues={health.issues} onFix={(issue) => { if (issue.sectionId) setSectionId(issue.sectionId); if (issue.blockId) setBlockId(issue.blockId); setPanel("content"); }}/> : <><div className="mt-4 flex gap-3 overflow-x-auto border-b text-xs">{(["content", "bindings", "media", "actions", "visibility", "layout"] as BuilderPanel[]).map((item) => <button key={item} onClick={() => setPanel(item)} className={`pb-2 capitalize ${panel === item ? "border-b-2 border-emerald-800 font-semibold" : ""}`}>{item}</button>)}</div><PropertyPanel block={block} panel={panel} sectionName={section?.name}/></>}
      </aside>
    </div>
    {picker ? <Picker components={components} query={query} setQuery={setQuery} close={() => setPicker(false)} insert={(type) => { if (section) command({ type: "create-block", sectionId: section.id, blockType: type }); setPicker(false); }}/> : null}
  </main>;
}

function Canvas({ draft, sectionId, selected, mode, onSelect, onAdd }: { draft: GuidebookDraft; sectionId?: string; selected: string; mode: BuilderPreviewMode; onSelect: (id: string) => void; onAdd: () => void }) {
  const section = draft.sections.find((item) => item.id === sectionId), narrow = mode === "mobile" || mode === "guest_portal", pdf = mode === "pdf";
  return <div className={`mx-auto min-h-[720px] overflow-hidden bg-[#FAFAF8] shadow-xl ${narrow ? "max-w-sm rounded-[2rem] border-[8px] border-stone-950" : pdf ? "aspect-[8.5/11] max-w-2xl" : "max-w-5xl rounded-xl"}`}><header className="bg-[#0B2B24] p-5 text-white"><strong className="font-serif">{draft.title}</strong></header><div className="min-h-64 bg-[linear-gradient(145deg,#c78a38,#0b2b24)] p-10 text-center text-white"><p className="text-xs uppercase tracking-widest">Welcome to</p><h2 className="mt-3 font-serif text-5xl">{section?.name ?? "Mesa"}</h2></div><div className="space-y-3 p-6">{section?.blocks.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`block w-full rounded-xl border bg-white p-4 text-left ${selected === item.id ? "ring-2 ring-blue-500" : ""}`}><span className="text-[10px] font-bold uppercase text-emerald-800">{item.type}</span><p className="mt-2 text-sm">{blockSummary(item)}</p></button>)}<button onClick={onAdd} className="w-full rounded-xl border-2 border-dashed p-5 text-sm text-stone-500">Drop or insert a compatible component</button></div></div>;
}

function PropertyPanel({ block, panel, sectionName }: { block?: AuthoringBlock; panel: BuilderPanel; sectionName?: string }) {
  if (!block) return <p className="mt-5 text-sm text-stone-500">Select a component in {sectionName ?? "the canvas"} to configure it.</p>;
  if (panel === "bindings") return <div className="mt-5 space-y-3"><Option title="Content Library" body="Bind an approved reusable content record."/><Option title="Property variable" body="{{wifi.network}}, {{checkin.time}}, {{host.phone}}"/><Option title="Collection" body="Bind an ordered governed collection."/></div>;
  if (panel === "media") return <div className="mt-5"><label className="relative block"><Search className="absolute left-3 top-3 size-4"/><input placeholder="Search Media Library…" className="min-h-10 w-full rounded-xl border pl-9"/></label><div className="mt-4 grid grid-cols-2 gap-2">{[1, 2, 3, 4].map((value) => <button key={value} className="aspect-video rounded-lg bg-gradient-to-br from-amber-200 to-emerald-900" aria-label={`Media ${value}`}/>)}</div></div>;
  if (panel === "layout") return <div className="mt-5"><Option title="Mesa Modern" body="Template-controlled presentation."/><div className="mt-4 grid grid-cols-3 gap-2">{[MESA_MODERN_TOKENS.colors.primary, MESA_MODERN_TOKENS.colors.accent, MESA_MODERN_TOKENS.colors.highlight].map((value) => <span key={value} className="h-12 rounded border" style={{ background: value }}/>)}</div></div>;
  return <div className="mt-5 space-y-4"><label className="text-sm font-semibold">Component type<input value={block.type} readOnly className="mt-2 block min-h-10 w-full rounded-xl border bg-stone-50 px-3"/></label><label className="text-sm font-semibold">Current content<textarea value={blockSummary(block)} readOnly rows={5} className="mt-2 block w-full rounded-xl border p-3"/></label><p className="text-xs text-stone-500">Saves are revision-aware; published versions remain immutable.</p></div>;
}

function Picker({ components, query, setQuery, close, insert }: { components: ReturnType<typeof compatibleComponents>; query: string; setQuery: (value: string) => void; close: () => void; insert: (value: ReturnType<typeof compatibleComponents>[number]["key"]) => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="dialog" aria-modal="true"><section className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6"><div className="flex justify-between"><div><h2 className="text-xl font-semibold">Compatible components</h2><p className="text-sm text-stone-500">Supported by this section and Mesa Modern.</p></div><button onClick={close}>Close</button></div><label className="relative mt-5 block"><Search className="absolute left-3 top-3 size-4"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components…" className="min-h-10 w-full rounded-xl border pl-9"/></label><div className="mt-5 grid gap-3 sm:grid-cols-3">{components.map((item) => <button key={item.key} onClick={() => insert(item.key)} className="rounded-xl border p-5 text-left"><strong>{item.name}</strong><p className="mt-2 text-xs capitalize text-stone-500">{item.category}</p></button>)}</div></section></div>; }
function Validation({ issues, onFix }: { issues: ReturnType<typeof guidebookHealth>["issues"]; onFix: (issue: ReturnType<typeof guidebookHealth>["issues"][number]) => void }) { return <div className="mt-5 space-y-2">{issues.length ? issues.map((issue, index) => <button key={`${issue.code}-${index}`} onClick={() => onFix(issue)} className={`w-full rounded-xl border p-3 text-left text-sm ${issue.blocking ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><strong className="capitalize">{issue.severity}</strong><p>{issue.message}</p></button>) : <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><Check className="mr-2 inline size-4"/>Ready to publish.</p>}</div>; }
function Option({ title, body }: { title: string; body: string }) { return <button className="w-full rounded-xl border p-4 text-left"><strong className="text-sm">{title}</strong><p className="mt-1 text-xs text-stone-500">{body}</p></button>; }
function Mini({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} aria-label={label} title={label} className="rounded border p-1 [&_svg]:size-3">{children}</button>; }
function SaveStatus({ value }: { value: BuilderSaveState }) { return <span role="status" className={`rounded-full px-2 py-1 font-semibold ${value === "saved" ? "bg-emerald-50 text-emerald-800" : value === "conflict" || value === "failed" ? "bg-rose-50 text-rose-800" : "bg-amber-50"}`}>{value}</span>; }

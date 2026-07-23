"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, GitBranch, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionActivityWorkspaceItem,
  AcquisitionActiveWorkspace,
  AcquisitionTerminalWorkspace,
} from "../acquisition-workspace";

type TimelineFilter = "all" | "lifecycle" | "commercial" | "requirements" | "evidence" | "closing";
type PipelineWorkspace = AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace;
const filters: readonly Readonly<{ value: TimelineFilter; label: string }>[] = [
  { value: "all", label: "All" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "commercial", label: "Commercial" },
  { value: "requirements", label: "Requirements" },
  { value: "evidence", label: "Evidence" },
  { value: "closing", label: "Closing" },
];

export function AcquisitionActivityWorkspace({ workspace }: { workspace: PipelineWorkspace }) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [query, setQuery] = useState("");
  const items = useMemo(() => filterTimeline(workspace.acquisition.activity.items, filter, query), [workspace.acquisition.activity.items, filter, query]);
  const groups = groupTimeline(items, workspace.acquisition.updatedAt);
  return <section aria-labelledby="activity-workspace-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Historical record</p><h2 id="activity-workspace-heading" className="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Activity &amp; decision lineage</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">A bounded operator history connecting lifecycle, commercial decisions, requirements, Evidence relationships, and closing outcomes.</p></div><Badge tone={workspace.status === "pipeline-terminal" ? workspace.acquisition.outcome.type === "acquired" ? "success" : "danger" : "neutral"}>{workspace.status === "pipeline-terminal" ? workspace.acquisition.outcome.type === "acquired" ? "Acquisition complete" : "Acquisition ended" : `You are here: ${workspace.acquisition.stageLabel}`}</Badge></div>

    <DecisionLineage workspace={workspace} />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-stone-100 pb-5"><div><h3 className="text-lg font-semibold text-stone-950">Unified timeline</h3><p className="mt-1 text-sm text-stone-500">Business events remain newest first within their original canonical chronology.</p></div><TimelineControls filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /></div>
        {groups.length ? <div className="mt-6 space-y-8">{groups.map(group => <TimelineGroup key={group.label} group={group} />)}</div> : <EmptyTimeline hasHistory={workspace.acquisition.activity.totalCount > 0} />}
        {workspace.acquisition.activity.truncated ? <p className="mt-6 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">Showing {workspace.acquisition.activity.items.length} of {workspace.acquisition.activity.totalCount} canonical pipeline events. Complete history requires a dedicated paginated reader.</p> : null}
      </Card>
      <div className="space-y-5">
        <LifecycleHistory workspace={workspace} />
        <CommandHistory workspace={workspace} />
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <CommercialLineage workspace={workspace} />
      <RequirementLineage workspace={workspace} />
      <EvidenceLineage workspace={workspace} />
    </div>
  </section>;
}

function TimelineControls({ filter, setFilter, query, setQuery }: { filter: TimelineFilter; setFilter: (value: TimelineFilter) => void; query: string; setQuery: (value: string) => void }) {
  return <div className="flex flex-col gap-3"><div role="group" aria-label="Timeline category" className="flex gap-2 overflow-x-auto pb-1">{filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={filter === item.value ? "shrink-0 rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold text-white" : "shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600"}>{item.label}</button>)}</div><label className="relative block"><span className="sr-only">Search timeline summaries and metadata</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search business history" className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600" /></label></div>;
}

function TimelineGroup({ group }: { group: Readonly<{ label: string; items: readonly AcquisitionActivityWorkspaceItem[] }> }) {
  return <section aria-labelledby={`timeline-${slug(group.label)}`}><h4 id={`timeline-${slug(group.label)}`} className="eyebrow">{group.label}</h4><ol className="relative mt-4 space-y-4 border-l border-stone-200 pl-6">{group.items.map(item => <TimelineEntry key={item.id} item={item} />)}</ol></section>;
}

function TimelineEntry({ item }: { item: AcquisitionActivityWorkspaceItem }) {
  return <li className="relative"><span className="absolute -left-[1.77rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-stone-900 ring-1 ring-stone-300" aria-hidden="true" /><article className="rounded-xl border border-stone-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge>{title(item.category)}</Badge><h5 className="mt-2 font-semibold text-stone-950">{item.summary}</h5></div><time dateTime={item.occurredAt.toISOString()} className="text-xs text-stone-500">{formatTime(item.occurredAt)}</time></div><p className="mt-2 text-sm text-stone-600">{item.outcome}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><Fact term="Initiated by" value={`${title(item.actor.type)} ${item.actor.id}`} /><Fact term="Affected" value={item.affectedObject} /></dl><details className="group mt-4 border-t border-stone-100 pt-3"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">Event details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary><dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 text-xs"><Fact term="Pipeline version" value={String(item.pipelineVersion)} />{item.fromStage ? <Fact term="Stage change" value={`${title(item.fromStage)} → ${title(item.toStage)}`} /> : <Fact term="Current stage" value={title(item.toStage)} />}{item.references.length ? <div className="col-span-2"><dt className="eyebrow">Related records</dt><dd className="mt-1 flex flex-wrap gap-2">{item.references.map(reference => <span key={`${reference.type}-${reference.id}`} className="rounded-full bg-white px-2 py-1">{title(reference.type)} · {reference.id}</span>)}</dd></div> : null}</dl></details></article></li>;
}

function DecisionLineage({ workspace }: { workspace: PipelineWorkspace }) {
  const nodes = decisionLineage(workspace);
  return <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><GitBranch className="mt-0.5 h-5 w-5 text-teal-700" aria-hidden="true" /><div><h3 className="text-lg font-semibold text-stone-950">Decision lineage</h3><p className="mt-1 text-sm text-stone-500">How underwriting became a commercial position, operational verification, and the current acquisition outcome.</p></div></div><ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{nodes.map((node, index) => <li key={node.id} className="relative rounded-xl border border-stone-200 p-4"><span className="eyebrow">Step {index + 1}</span><p className="mt-2 text-sm font-semibold text-stone-900">{node.label}</p><p className="mt-1 text-xs leading-5 text-stone-500">{node.detail}</p>{node.current ? <span className="mt-3 inline-flex"><Badge tone="success">Current outcome</Badge></span> : <Check className="mt-3 h-4 w-4 text-emerald-700" aria-label="Recorded" />}</li>)}</ol></Card>;
}

function LifecycleHistory({ workspace }: { workspace: PipelineWorkspace }) {
  const lifecycle = workspace.acquisition.lifecycle;
  return <Panel title="Lifecycle history" description="Stage progression is distinct from chronological activity."><ol className="space-y-3">{lifecycle.stages.map(stage => <li key={stage.stage} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3"><span className="text-sm font-semibold">{stage.label}</span><span className="text-xs text-stone-500">{stage.state === "current" ? "You are here" : title(stage.state)}</span></li>)}</ol>{lifecycle.historyTruncated ? <p className="mt-4 text-xs text-stone-500">Showing {lifecycle.recentHistory.length} of {lifecycle.historyTotalCount} transitions.</p> : null}</Panel>;
}

function CommandHistory({ workspace }: { workspace: PipelineWorkspace }) {
  const commands = workspace.acquisition.activity.items.filter(item => item.type === "pipeline-activated" || item.type === "pipeline-exited" || item.type === "pipeline-closed-acquired" || item.type === "offer-submitted" || item.type.includes("contract") || item.type.endsWith("-satisfied") || item.type.endsWith("-completed"));
  return <Panel title="Command outcomes" description="Successful business outcomes inferred from canonical activity—not infrastructure logs.">{commands.length ? <ol className="space-y-3">{commands.slice(0, 6).map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-semibold">{item.summary}</p><p className="mt-1 text-xs text-stone-500">{item.outcome}</p></li>)}</ol> : <p className="text-sm text-stone-500">No successful command outcome is present in the bounded activity window.</p>}<p className="mt-4 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">Command receipts, replay state, RPC names, SQL, and infrastructure metadata are intentionally excluded.</p></Panel>;
}

function CommercialLineage({ workspace }: { workspace: PipelineWorkspace }) {
  const commercial = workspace.acquisition.commercial;
  const values = [
    ...(workspace.analysis ? [{ id: `analysis-${workspace.analysis.analysisId}`, label: `Analysis v${workspace.analysis.version}`, detail: title(workspace.analysis.recommendation) }] : []),
    ...[...commercial.priorOffers].reverse().map(offer => ({ id: offer.id, label: `Offer #${offer.sequence}`, detail: title(offer.status) })),
    ...(commercial.currentOffer ? [{ id: commercial.currentOffer.id, label: `Offer #${commercial.currentOffer.sequence}`, detail: title(commercial.currentOffer.status) }] : []),
    ...(commercial.latestResponse ? [{ id: commercial.latestResponse.id, label: commercial.latestResponse.type === "countered" ? "Counteroffer" : `Response: ${title(commercial.latestResponse.type)}`, detail: formatDate(commercial.latestResponse.respondedAt) }] : []),
    ...(commercial.acceptedAgreement ? [{ id: "accepted-agreement", label: "Accepted agreement", detail: title(commercial.acceptedAgreement.source) }] : []),
    ...(commercial.contract ? [{ id: commercial.contract.id, label: "Executed contract", detail: title(commercial.contract.source) }] : []),
  ];
  return <LineagePanel title="Commercial lineage" description="Analysis → offers → response → agreement → contract" values={values} empty="No commercial lineage has been established." footer={commercial.priorOffersTruncated ? `Prior offers are bounded: ${commercial.priorOffers.length} of ${commercial.priorOfferTotalCount} shown.` : undefined} />;
}

function RequirementLineage({ workspace }: { workspace: PipelineWorkspace }) {
  const requirements = workspace.acquisition.requirements;
  const activity = workspace.acquisition.activity.items.filter(item => item.category === "requirements");
  return <Panel title="Requirement lineage" description="Related business events and current requirement outcomes.">{activity.length ? <ol className="space-y-3">{activity.slice(0, 6).map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-semibold">{item.summary}</p><p className="mt-1 text-xs text-stone-500">{formatDateTime(item.occurredAt)} · {item.outcome}</p></li>)}</ol> : requirements.initialized ? <p className="text-sm text-stone-500">No requirement event is present in the bounded activity window.</p> : <p className="text-sm text-stone-500">Requirements have not been initialized.</p>}<p className="mt-4 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">{requirements.recentlyResolvedTotalCount} recently resolved requirement(s) are represented in the workspace summary. Complete requirement-history rows are not yet exposed by the workspace reader.</p></Panel>;
}

function EvidenceLineage({ workspace }: { workspace: PipelineWorkspace }) {
  const requirements = workspace.acquisition.requirements;
  const related = [...requirements.contingencies, ...requirements.dueDiligence].filter(item => item.evidence.linked > 0);
  return <Panel title="Evidence lineage" description="Opaque Evidence relationships and current availability—never content.">{related.length ? <ul className="space-y-3">{related.map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-stone-500">{item.evidence.available} available · {item.evidence.unavailable} unavailable · {item.evidence.withdrawn} withdrawn · {item.evidence.superseded} superseded</p><p className="mt-1 text-xs text-stone-500">Current outcome: {title(item.status)}</p></li>)}</ul> : <p className="text-sm text-stone-500">No supporting Evidence has been linked in the bounded requirement summary.</p>}<p className="mt-4 border-t border-stone-100 pt-4 text-xs leading-5 text-stone-500">Evidence transition timestamps, review events, provenance, and document contents are not projected. Current states must not be interpreted as a complete Evidence audit history.</p></Panel>;
}

function LineagePanel({ title: heading, description, values, empty, footer }: { title: string; description: string; values: readonly Readonly<{ id: string; label: string; detail: string }>[]; empty: string; footer?: string }) {
  return <Panel title={heading} description={description}>{values.length ? <ol className="space-y-2">{values.map((value, index) => <li key={value.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-stone-900" aria-hidden="true" />{index < values.length - 1 ? <span className="h-full w-px bg-stone-200" aria-hidden="true" /> : null}</div><div className="pb-4"><p className="text-sm font-semibold">{value.label}</p><p className="mt-0.5 text-xs text-stone-500">{value.detail}</p></div></li>)}</ol> : <p className="text-sm text-stone-500">{empty}</p>}{footer ? <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-500">{footer}</p> : null}</Panel>;
}

function Panel({ title: heading, description, children }: { title: string; description: string; children: React.ReactNode }) { const id = `activity-${slug(heading)}`; return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="mb-5"><h3 id={id} className="text-lg font-semibold text-stone-950">{heading}</h3><p className="mt-1 text-sm text-stone-500">{description}</p></div>{children}</Card></section>; }
function EmptyTimeline({ hasHistory }: { hasHistory: boolean }) { return <div className="mt-6 rounded-xl bg-stone-50 p-6 text-center"><p className="font-semibold text-stone-800">{hasHistory ? "No matching history." : "No acquisition history yet."}</p><p className="mt-1 text-sm text-stone-500">{hasHistory ? "Change the filter or search phrase." : "History begins when acquisition starts."}</p></div>; }
export function filterTimeline(items: readonly AcquisitionActivityWorkspaceItem[], filter: TimelineFilter, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => (filter === "all" || (filter === "evidence" ? item.references.some(reference => reference.type === "requirement") : item.category === filter)) && (!needle || [item.summary, item.outcome, item.affectedObject, item.type, item.category, ...item.references.flatMap(reference => [reference.type, reference.id])].join(" ").toLocaleLowerCase().includes(needle)));
}
export function groupTimeline(items: readonly AcquisitionActivityWorkspaceItem[], reference: Date) {
  const groups = new Map<string, AcquisitionActivityWorkspaceItem[]>();
  for (const item of items) { const label = timeGroup(item.occurredAt, reference); groups.set(label, [...(groups.get(label) ?? []), item]); }
  return [...groups].map(([label, values]) => ({ label, items: values }));
}
function timeGroup(value: Date, reference: Date) {
  const day = 86_400_000, difference = Math.floor((utcDay(reference) - utcDay(value)) / day);
  if (difference <= 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference <= 6) return "Earlier this week";
  if (difference <= 13) return "Last week";
  return "Earlier";
}
function utcDay(value: Date) { return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()); }
function decisionLineage(workspace: PipelineWorkspace) {
  const commercial = workspace.acquisition.commercial, values: { id: string; label: string; detail: string; current?: boolean }[] = [];
  if (workspace.analysis) values.push({ id: "analysis", label: "Investment analysis", detail: `Version ${workspace.analysis.version} · ${title(workspace.analysis.recommendation)}` });
  if (commercial.currentOffer || commercial.priorOfferTotalCount) values.push({ id: "offer", label: "Commercial offer", detail: commercial.currentOffer ? `Offer #${commercial.currentOffer.sequence} · ${title(commercial.currentOffer.status)}` : `${commercial.priorOfferTotalCount} historical offer(s)` });
  if (commercial.acceptedAgreement) values.push({ id: "agreement", label: "Accepted agreement", detail: title(commercial.acceptedAgreement.source) });
  if (commercial.contract) values.push({ id: "contract", label: "Executed contract", detail: title(commercial.contract.source) });
  if (workspace.acquisition.requirements.initialized) values.push({ id: "diligence", label: "Due diligence", detail: `${workspace.acquisition.requirements.totals.satisfied} satisfied · ${workspace.acquisition.requirements.blockingTotalCount} blocking` });
  if (workspace.status === "pipeline-terminal") values.push({ id: "terminal", label: workspace.acquisition.outcome.type === "acquired" ? "Acquired" : "Exited", detail: workspace.acquisition.outcome.type === "acquired" ? formatDate(workspace.acquisition.outcome.closedAt) : title(workspace.acquisition.outcome.reason), current: true });
  else values.push({ id: "current", label: workspace.acquisition.stageLabel, detail: "Current acquisition state", current: true });
  return values;
}
function Fact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1 text-xs font-semibold text-stone-700">{value}</dd></div>; }
function slug(value: string) { return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"); }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }
function formatTime(value: Date) { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

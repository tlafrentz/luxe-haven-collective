import { AlertTriangle, Check, ChevronDown, CircleAlert, FileCheck, GitBranch, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionClosingReadinessWorkspaceSummary,
  AcquisitionRequirementRiskWorkspaceSummary,
  AcquisitionRequirementsWorkspaceSummary,
  AcquisitionRequirementWorkspaceItem,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";
import { AcquisitionPrimaryAction } from "./acquisition-primary-action";

type DiligenceHealth = "healthy" | "attention" | "blocked" | "failed";

export function isDiligenceActionType(type: AcquisitionWorkspaceNextAction["type"]) {
  return ["initialize-requirements", "manage-due-diligence", "review-closing-readiness"].includes(type);
}

export function AcquisitionDueDiligenceWorkspace({
  requirements,
  readiness,
  primaryAction,
  opportunity,
  analysis,
}: {
  requirements: AcquisitionRequirementsWorkspaceSummary;
  readiness: AcquisitionClosingReadinessWorkspaceSummary | null;
  primaryAction: AcquisitionWorkspaceNextAction | null;
  opportunity: InvestmentOpportunityWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
}) {
  if (!requirements.initialized) return <DiligenceEmptyState primaryAction={primaryAction} opportunity={opportunity} analysis={analysis} />;
  const health = diligenceHealth(requirements);
  const objective = primaryAction?.label ?? requirements.blocking[0]?.title ?? "Review due diligence";
  const why = primaryAction?.description ?? (requirements.blocking[0] ? "Resolve the highest-priority projected requirement before advancing acquisition readiness." : "Keep requirement evidence and risks current.");
  const completed = requirements.totals.satisfied + requirements.totals.waived + requirements.totals.notApplicable;
  const total = requirements.totals.contingencies + requirements.totals.dueDiligence;
  const remaining = Math.max(0, total - completed);
  const warnings = buildDiligenceWarnings(requirements, readiness);
  const allVisible = [...requirements.contingencies, ...requirements.dueDiligence];
  const criticalBlockers = [...requirements.blocking, ...allVisible.filter(item => item.blocking && item.status === "failed")]
    .filter((item, index, all) => all.findIndex(value => value.id === item.id) === index);
  const requirementNames = new Map(allVisible.map(item => [item.id, item.title]));

  return <section aria-labelledby="due-diligence-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Requirements workspace</p><h2 id="due-diligence-heading" className="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Due diligence</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Understand what remains, what supports completion, and what prevents safe progression.</p></div>
      <Badge tone={health === "healthy" ? "success" : health === "attention" ? "warning" : "danger"}>{health === "attention" ? "Attention required" : title(health)}</Badge>
    </div>

    <DiligenceReadinessCard readiness={readiness} completed={completed} total={total} remaining={remaining} health={health} blockingCount={criticalBlockers.length} />
    <CurrentDiligenceObjective objective={objective} why={why} primaryAction={primaryAction} opportunity={opportunity} analysis={analysis} />
    <CriticalBlockerPanel blockers={criticalBlockers} />

    <div className="grid gap-5 xl:grid-cols-2">
      <RequirementCollection title="Contingencies" description="Contract and agreement protections that may prevent safe progression." items={requirements.contingencies} total={requirements.contingencyTotalCount} truncated={requirements.contingenciesTruncated} requirementNames={requirementNames} />
      <RequirementCollection title="Due diligence tasks" description="Investigations and verification work supporting the acquisition decision." items={requirements.dueDiligence} total={requirements.dueDiligenceTotalCount} truncated={requirements.dueDiligenceTruncated} requirementNames={requirementNames} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <EvidenceSummaryCard requirements={requirements} />
      <RiskSummaryCard risks={requirements.risks} total={requirements.riskTotalCount} truncated={requirements.risksTruncated} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <DependencySummary items={allVisible} requirementNames={requirementNames} />
      <DiligenceWarningPanel warnings={warnings} />
    </div>

    <RequirementHistory items={requirements.recentlyResolved} total={requirements.recentlyResolvedTotalCount} truncated={requirements.recentlyResolvedTruncated} />
  </section>;
}

function DiligenceReadinessCard({ readiness, completed, total, remaining, health, blockingCount }: {
  readiness: AcquisitionClosingReadinessWorkspaceSummary | null;
  completed: number;
  total: number;
  remaining: number;
  health: DiligenceHealth;
  blockingCount: number;
}) {
  return <Card className="border-stone-800 bg-stone-950 p-5 text-white sm:p-7">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Current readiness</p><h3 className="mt-2 text-2xl font-semibold">{health === "healthy" && !remaining ? "Requirements complete" : health === "attention" ? "Attention required" : title(health)}</h3><p className="mt-2 max-w-2xl text-sm text-stone-300">{readiness ? `Closing readiness is ${title(readiness.status)}${readiness.current ? "." : " and requires reevaluation."}` : "Closing readiness has not yet been evaluated."}</p></div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4"><DarkFact term="Requirements" value={String(total)} /><DarkFact term="Satisfied" value={String(completed)} /><DarkFact term="Remaining" value={String(remaining)} /><DarkFact term="Blocking" value={String(blockingCount)} /></dl>
    </div>
  </Card>;
}

function CurrentDiligenceObjective({ objective, why, primaryAction, opportunity, analysis }: {
  objective: string;
  why: string;
  primaryAction: AcquisitionWorkspaceNextAction | null;
  opportunity: InvestmentOpportunityWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
}) {
  return <Card className="border-teal-200 bg-teal-50 p-5 sm:p-6">
    <p className="eyebrow">Current diligence objective</p><h3 className="mt-2 text-2xl font-semibold text-teal-950">{objective}</h3><p className="mt-2 text-sm leading-6 text-teal-900"><span className="font-semibold">Why: </span>{why}</p>
    {primaryAction ? <div className="mt-5"><AcquisitionPrimaryAction action={primaryAction} opportunity={opportunity} analysis={analysis} /></div> : null}
  </Card>;
}

function CriticalBlockerPanel({ blockers }: { blockers: readonly AcquisitionRequirementWorkspaceItem[] }) {
  return <section aria-labelledby="diligence-blockers-heading"><Card className="border-rose-200 p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 id="diligence-blockers-heading" className="text-lg font-semibold text-stone-950">Critical blockers</h3></div>
    {blockers.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{blockers.map(item => <article key={item.id} className="rounded-xl bg-rose-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-rose-950">{item.title}</h4><Badge tone={item.status === "failed" ? "danger" : "warning"}>{title(item.status)}</Badge></div><dl className="mt-3 space-y-2 text-sm text-rose-900"><Guidance term="Why" value={item.overdue ? "This blocking requirement is overdue." : "This requirement is projected as blocking and unresolved."} /><Guidance term="Impact" value="Acquisition readiness cannot safely advance while this blocker remains." /><Guidance term="Recommended action" value={item.unavailableEvidenceCount ? "Resolve unavailable supporting evidence and review the requirement." : "Review the requirement and follow the projected diligence action."} /></dl></article>)}</div>
      : <p className="mt-4 text-sm text-stone-600">No unresolved projected requirement is currently blocking progression.</p>}
  </Card></section>;
}

function RequirementCollection({ title: heading, description, items, total, truncated, requirementNames }: {
  title: string;
  description: string;
  items: readonly AcquisitionRequirementWorkspaceItem[];
  total: number;
  truncated: boolean;
  requirementNames: ReadonlyMap<string, string>;
}) {
  const id = `diligence-${heading.toLowerCase().replaceAll(" ", "-")}`;
  return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id={id} className="text-lg font-semibold text-stone-950">{heading}</h3><p className="mt-1 text-sm text-stone-500">{description}</p></div><Badge>{total}</Badge></div>
    {items.length ? <div className="mt-5 space-y-3">{items.map(item => <RequirementDetail key={item.id} item={item} requirementNames={requirementNames} />)}</div> : <EmptyCopy title={`No ${heading.toLowerCase()}`} body={`No ${heading.toLowerCase()} have been initialized.`} />}
    {truncated ? <p className="mt-4 text-xs text-stone-500">Showing {items.length} of {total} requirements.</p> : null}
  </Card></section>;
}

function RequirementDetail({ item, requirementNames }: { item: AcquisitionRequirementWorkspaceItem; requirementNames: ReadonlyMap<string, string> }) {
  const complete = ["satisfied", "waived", "not-applicable"].includes(item.status);
  return <details className="group rounded-xl border border-stone-200 bg-white open:shadow-sm">
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600">
      <div className="flex min-w-0 gap-3">{complete ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : item.status === "failed" ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" /> : <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />}<div><h4 className="font-semibold text-stone-900">{item.title}</h4><p className="mt-1 text-xs text-stone-500">{title(item.typeOrCategory)} · {title(item.priority)} priority{item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ""}</p></div></div>
      <div className="flex items-center gap-2"><Badge tone={item.status === "failed" ? "danger" : complete ? "success" : item.blocking ? "warning" : "neutral"}>{title(item.status)}</Badge><ChevronDown className="h-4 w-4 text-stone-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></div>
    </summary>
    <div className="border-t border-stone-100 p-4">
      <p className="text-sm leading-6 text-stone-600">{item.description ?? "No additional requirement description is projected."}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><LightFact term="Blocking" value={item.blocking ? "Yes" : "No"} /><LightFact term="Actions" value={String(item.linkedActionCount)} /><LightFact term="Evidence" value={String(item.evidenceCount)} /><LightFact term="Documents" value={String(item.documentCount)} /></dl>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><p className="eyebrow">Evidence state</p><p className="mt-2 text-sm text-stone-700">{item.evidence.available} available · {item.evidence.unavailable} unavailable · {item.evidence.withdrawn} withdrawn · {item.evidence.superseded} superseded</p></div>
        <div><p className="eyebrow">Related work</p>{item.dependencies.length ? <ul className="mt-2 space-y-1 text-sm text-stone-700">{item.dependencies.map(dependency => <li key={`${dependency.relationship}-${dependency.requirementId}`}>{title(dependency.relationship)}: {requirementNames.get(dependency.requirementId) ?? dependency.requirementId}</li>)}</ul> : <p className="mt-2 text-sm text-stone-500">No requirement relationships projected.</p>}</div>
      </div>
      {item.concernSummary ? <div className="mt-4 rounded-lg bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-950">{item.concernSummary.headline ?? "Recorded concern"}</p><p className="mt-1 text-xs text-amber-900">{title(item.concernSummary.highestSeverity)} severity · {item.concernSummary.total} concern{item.concernSummary.total === 1 ? "" : "s"} · {item.concernSummary.blocking} blocking</p></div> : null}
      <p className="mt-4 text-xs text-stone-500">Updated {formatDateTime(item.updatedAt)} · read-only</p>
    </div>
  </details>;
}

function EvidenceSummaryCard({ requirements }: { requirements: AcquisitionRequirementsWorkspaceSummary }) {
  const evidence = requirements.evidence;
  return <section aria-labelledby="evidence-summary-heading"><Card className="h-full p-5 sm:p-6"><div className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-teal-700" aria-hidden="true" /><h3 id="evidence-summary-heading" className="text-lg font-semibold text-stone-950">Evidence</h3></div>
    {evidence.linked ? <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><LightFact term="Available" value={String(evidence.available)} /><LightFact term="Missing" value={String(evidence.unavailable)} /><LightFact term="Withdrawn" value={String(evidence.withdrawn)} /><LightFact term="Superseded" value={String(evidence.superseded)} /></dl> : <EmptyCopy title="No supporting evidence has been linked." body="Evidence references will appear here without exposing content or document metadata." />}
    <p className="mt-5 text-xs leading-5 text-stone-500">Evidence content, provenance, URLs, and document previews are intentionally excluded from this workspace summary.</p>
  </Card></section>;
}

function RiskSummaryCard({ risks, total, truncated }: { risks: readonly AcquisitionRequirementRiskWorkspaceSummary[]; total: number; truncated: boolean }) {
  return <section aria-labelledby="risk-summary-heading"><Card className="h-full p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="risk-summary-heading" className="text-lg font-semibold text-stone-950">Acquisition risks</h3><p className="mt-1 text-sm text-stone-500">Concerns projected from requirement outcomes.</p></div><Badge tone={risks.some(risk => risk.blocking) ? "danger" : "neutral"}>{total}</Badge></div>
    {risks.length ? <div className="mt-5 space-y-3">{risks.map(risk => <article key={risk.id} className={risk.blocking ? "rounded-xl border border-rose-200 bg-rose-50 p-4" : "rounded-xl border border-stone-200 p-4"}><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-stone-900">{risk.title}</h4><div className="flex gap-2"><Badge tone={risk.severity === "critical" || risk.severity === "high" ? "danger" : "warning"}>{title(risk.severity)}</Badge>{risk.blocking ? <Badge tone="danger">Blocking</Badge> : null}</div></div><p className="mt-2 text-sm leading-6 text-stone-700">{risk.summary}</p><dl className="mt-3 grid grid-cols-2 gap-3"><LightFact term="Requirement" value={risk.requirementTitle} /><LightFact term="Evidence" value={String(risk.evidenceCount)} /><LightFact term="Likelihood" value="Not projected" /><LightFact term="Recommendation" value={risk.blocking ? "Resolve the associated requirement." : "Review the associated requirement."} /></dl></article>)}</div>
      : <EmptyCopy title="No acquisition risks identified." body="Recorded requirement concerns will appear here as bounded risk summaries." />}
    {truncated ? <p className="mt-4 text-xs text-stone-500">Showing {risks.length} of {total} recorded risks.</p> : null}
  </Card></section>;
}

function DependencySummary({ items, requirementNames }: { items: readonly AcquisitionRequirementWorkspaceItem[]; requirementNames: ReadonlyMap<string, string> }) {
  const links = items.flatMap(item => item.dependencies.map(dependency => ({ sourceId: item.id, source: item.title, ...dependency })));
  return <section aria-labelledby="dependency-summary-heading"><Card className="h-full p-5 sm:p-6"><div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-stone-700" aria-hidden="true" /><h3 id="dependency-summary-heading" className="text-lg font-semibold text-stone-950">Requirement relationships</h3></div>
    {links.length ? <ul className="mt-5 space-y-3">{links.map(link => <li key={`${link.sourceId}-${link.relationship}-${link.requirementId}`} tabIndex={0} className="rounded-xl border border-stone-200 p-4 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><p className="text-sm font-semibold text-stone-900">{link.source}</p><p className="mt-2 text-xs text-stone-500">{title(link.relationship)}</p><p className="mt-1 text-sm text-stone-700">{requirementNames.get(link.requirementId) ?? link.requirementId}</p></li>)}</ul>
      : <EmptyCopy title="No requirement relationships projected." body="The workspace will show contingency and diligence relationships when the canonical domain provides them." />}
  </Card></section>;
}

function DiligenceWarningPanel({ warnings }: { warnings: readonly Readonly<{ id: string; title: string; explanation: string }>[] }) {
  return <section aria-labelledby="diligence-warnings-heading"><Card className="h-full border-amber-200 p-5 sm:p-6"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" /><h3 id="diligence-warnings-heading" className="text-lg font-semibold text-stone-950">Warnings</h3></div>
    {warnings.length ? <ul className="mt-5 space-y-3">{warnings.map(warning => <li key={warning.id} className="rounded-xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">{warning.title}</p><p className="mt-1 text-xs leading-5 text-amber-900">{warning.explanation}</p></li>)}</ul> : <p className="mt-4 text-sm text-stone-600">No projected diligence warnings require attention.</p>}
  </Card></section>;
}

function RequirementHistory({ items, total, truncated }: { items: readonly AcquisitionRequirementWorkspaceItem[]; total: number; truncated: boolean }) {
  return <section aria-labelledby="requirement-history-heading"><Card className="p-5 sm:p-6"><h3 id="requirement-history-heading" className="text-lg font-semibold text-stone-950">Recent requirement changes</h3><p className="mt-1 text-sm text-stone-500">Recently resolved requirements; complete requirement event history is not exposed by the current workspace reader.</p>
    {items.length ? <ol className="mt-5 divide-y divide-stone-100">{items.map(item => <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-stone-900">{item.title}</p><p className="mt-1 text-xs text-stone-500">{title(item.kind)} · {title(item.status)}</p></div><time dateTime={(item.resolvedAt ?? item.updatedAt).toISOString()} className="text-xs text-stone-500">{formatDateTime(item.resolvedAt ?? item.updatedAt)}</time></li>)}</ol>
      : <EmptyCopy title="No recent requirement changes." body="Resolved requirements will appear here." />}
    {truncated ? <p className="mt-4 text-xs text-stone-500">Showing {items.length} of {total} recently resolved requirements.</p> : null}
  </Card></section>;
}

function DiligenceEmptyState({ primaryAction, opportunity, analysis }: { primaryAction: AcquisitionWorkspaceNextAction | null; opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null }) {
  return <section aria-labelledby="due-diligence-empty-heading"><Card className="border-dashed p-6 sm:p-8"><div className="mx-auto max-w-2xl text-center"><FileCheck className="mx-auto h-8 w-8 text-stone-500" aria-hidden="true" /><h2 id="due-diligence-empty-heading" className="mt-4 text-2xl font-semibold text-stone-950">Requirements have not yet been initialized.</h2><p className="mt-2 text-sm leading-6 text-stone-600">Initialize the approved acquisition requirements before evaluating diligence readiness, evidence, risks, or relationships.</p></div>{primaryAction ? <div className="mt-6"><AcquisitionPrimaryAction action={primaryAction} opportunity={opportunity} analysis={analysis} /></div> : null}</Card></section>;
}

export function diligenceHealth(requirements: AcquisitionRequirementsWorkspaceSummary): DiligenceHealth {
  if (requirements.failedCount) return "failed";
  if (requirements.blockingTotalCount) return "blocked";
  const all = [...requirements.contingencies, ...requirements.dueDiligence];
  if (all.some(item => item.overdue || item.unavailableEvidenceCount > 0) || requirements.unresolvedCriticalConcernCount > 0) return "attention";
  return "healthy";
}

function buildDiligenceWarnings(requirements: AcquisitionRequirementsWorkspaceSummary, readiness: AcquisitionClosingReadinessWorkspaceSummary | null) {
  const items = [...requirements.contingencies, ...requirements.dueDiligence];
  const overdue = items.filter(item => item.overdue).map(item => ({ id: `overdue-${item.id}`, title: `${item.title} is overdue`, explanation: "Review the requirement deadline and its effect on acquisition readiness." }));
  const evidence = items.filter(item => item.unavailableEvidenceCount).map(item => ({ id: `evidence-${item.id}`, title: `${item.title} has unavailable evidence`, explanation: `${item.unavailableEvidenceCount} linked evidence reference${item.unavailableEvidenceCount === 1 ? " is" : "s are"} unavailable, withdrawn, superseded, or inaccessible.` }));
  const readinessWarnings = readiness?.warnings.map(item => ({ id: `readiness-${item.code}-${item.sourceId ?? ""}`, title: item.title, explanation: item.explanation })) ?? [];
  return [...overdue, ...evidence, ...readinessWarnings].filter((item, index, all) => all.findIndex(value => value.id === item.id) === index);
}

function DarkFact({ term, value }: { term: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{term}</dt><dd className="mt-1 font-serif text-3xl text-white">{value}</dd></div>; }
function LightFact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm font-semibold text-stone-800">{value}</dd></div>; }
function Guidance({ term, value }: { term: string; value: string }) { return <div><dt className="font-semibold">{term}</dt><dd>{value}</dd></div>; }
function EmptyCopy({ title: heading, body }: { title: string; body: string }) { return <div className="mt-5 rounded-xl bg-stone-50 p-5"><p className="text-sm font-semibold text-stone-900">{heading}</p><p className="mt-1 text-sm leading-6 text-stone-600">{body}</p></div>; }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

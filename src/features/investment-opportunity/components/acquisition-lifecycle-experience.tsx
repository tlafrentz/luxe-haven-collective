import { AlertTriangle, Check, Circle, Flag, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionActiveWorkspace,
  AcquisitionLifecycleStageSummary,
  AcquisitionPipelineTerminalWorkspaceSummary,
  AcquisitionTerminalWorkspace,
  AcquisitionWorkspaceHealth,
  AcquisitionWorkspaceNextAction,
} from "../acquisition-workspace";
import { AcquisitionPrimaryAction } from "./acquisition-primary-action";
import { isCommercialActionType } from "./acquisition-commercial-workspace";
import { isDiligenceActionType } from "./acquisition-due-diligence-workspace";
import { isClosingActionType } from "./acquisition-closing-workspace";

type PipelineWorkspace = AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace;

const guidance: Readonly<Record<string, Readonly<{ objective: string; purpose: string; watchFor: string }>>> = {
  pursuit: {
    objective: "Confirm the opportunity is worth pursuing and prepare a commercially supported offer.",
    purpose: "Turn the investment decision into a deliberate acquisition pursuit.",
    watchFor: "Analysis age, changing market conditions, and unsupported commercial assumptions.",
  },
  "offer-preparation": {
    objective: "Prepare a complete offer supported by the current investment analysis.",
    purpose: "Translate the approved investment basis into clear commercial terms.",
    watchFor: "Offer expiration, incomplete terms, and analysis-to-offer differences.",
  },
  "offer-submitted": {
    objective: "Track the submitted offer and record the counterparty response.",
    purpose: "Preserve a reliable record of the proposal while awaiting a decision.",
    watchFor: "Expiration, counteroffers, and material changes to the investment basis.",
  },
  negotiating: {
    objective: "Resolve open commercial terms without losing the approved investment basis.",
    purpose: "Reach an agreement that remains aligned with the opportunity decision.",
    watchFor: "Concession drift, expired terms, and counteroffer lineage.",
  },
  "under-contract": {
    objective: "Record the executed agreement and establish the requirements that protect closing.",
    purpose: "Convert the accepted commercial basis into an operational acquisition plan.",
    watchFor: "Missing contract facts, uninitialized requirements, and approaching deadlines.",
  },
  "due-diligence": {
    objective: "Resolve acquisition requirements before contingencies or closing conditions expire.",
    purpose: "Verify the opportunity before irreversible commitments are made.",
    watchFor: "Failed contingencies, overdue diligence, missing evidence, and unresolved concerns.",
  },
  "closing-preparation": {
    objective: "Clear every closing blocker and confirm readiness against the current pipeline version.",
    purpose: "Ensure the acquisition can close accurately and atomically.",
    watchFor: "Stale readiness, dependency failures, and unresolved closing requirements.",
  },
  "closed-acquired": {
    objective: "Review the completed acquisition record.",
    purpose: "Preserve the final commercial basis, closing facts, and acquisition history.",
    watchFor: "No further lifecycle action is required.",
  },
  exited: {
    objective: "Review why the pursuit ended and retain the decision history.",
    purpose: "Make the exit understandable and preserve any future reconsideration path.",
    watchFor: "Reconsideration timing and changed opportunity assumptions.",
  },
};

export function AcquisitionLifecycleExperience({ workspace }: { workspace: PipelineWorkspace }) {
  const { acquisition } = workspace;
  const primaryAction = workspace.nextActions.find(action => action.priority === "primary") ?? null;
  const experienceStages = buildExperienceStages(workspace);
  const progress = buildLifecycleProgress(experienceStages, acquisition.terminal);
  const blockers = collectBlockers(workspace, primaryAction);
  const warnings = collectWarnings(workspace);
  const stageGuidance = guidance[acquisition.stage] ?? guidance.pursuit!;

  return <section aria-labelledby="lifecycle-experience-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Acquisition lifecycle</p>
        <h2 id="lifecycle-experience-heading" className="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">
          {acquisition.stageLabel}
        </h2>
      </div>
      <LifecycleHealthBadge health={acquisition.health} />
    </div>

    {workspace.status === "pipeline-terminal"
      ? <TerminalOutcomeCard acquisition={workspace.acquisition} />
      : <CurrentObjectiveCard action={primaryAction} fallback={stageGuidance.objective} />}

    <LifecycleTimeline stages={experienceStages} />

    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <StageDetailCard
        stageLabel={acquisition.stageLabel}
        guidance={stageGuidance}
        progress={progress}
      />
      <ProgressCard progress={progress} />
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <BlockerPanel blockers={blockers} />
      <WarningPanel warnings={warnings} />
    </div>

    <StageHistory
      history={acquisition.lifecycle.recentHistory}
      totalCount={acquisition.lifecycle.historyTotalCount}
      truncated={acquisition.lifecycle.historyTruncated}
    />

    {workspace.status === "pipeline-active" && (!primaryAction || (!isCommercialActionType(primaryAction.type) && !isDiligenceActionType(primaryAction.type) && !isClosingActionType(primaryAction.type)))
      ? <AcquisitionPrimaryAction action={primaryAction} opportunity={workspace.opportunity} analysis={workspace.analysis} />
      : null}
  </section>;
}

type ExperienceStage = Readonly<{
  id: "discovery" | "analysis" | "pursuit" | "offer" | "contract" | "due-diligence" | "closing" | "acquired" | "exited";
  label: string;
  state: AcquisitionLifecycleStageSummary["state"];
  completedAt?: Date;
}>;

export function LifecycleTimeline({ stages }: { stages: readonly ExperienceStage[] }) {
  return <Card className="overflow-hidden p-5 sm:p-6">
    <h3 className="sr-only">Lifecycle progression</h3>
    <ol aria-label="Acquisition lifecycle stages" className="relative grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {stages.map((stage, index) => <li
        key={stage.id}
        aria-current={stage.state === "current" ? "step" : undefined}
        tabIndex={stage.state === "current" ? 0 : -1}
        className={[
          "relative rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
          stage.state === "current" ? "border-teal-700 bg-teal-50 shadow-sm" :
            stage.state === "completed" ? "border-emerald-200 bg-emerald-50/70" :
              stage.state === "exited" ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-stone-50",
        ].join(" ")}
      >
        {index > 0 ? <span className="absolute -left-3 top-1/2 hidden h-px w-3 bg-stone-300 xl:block" aria-hidden="true" /> : null}
        <div className="flex items-center gap-2">
          <StageIcon state={stage.state} />
          <span className="sr-only">{stateLabel(stage.state)}: </span>
          <span className={stage.state === "current" ? "text-base font-bold text-teal-950" : "text-sm font-semibold text-stone-900"}>{stage.label}</span>
        </div>
        <p className="mt-2 text-xs font-medium text-stone-500">{stateLabel(stage.state)}</p>
        {stage.completedAt ? <time dateTime={stage.completedAt.toISOString()} className="mt-1 block text-xs text-stone-500">{formatDate(stage.completedAt)}</time> : null}
      </li>)}
    </ol>
  </Card>;
}

function CurrentObjectiveCard({ action, fallback }: { action: AcquisitionWorkspaceNextAction | null; fallback: string }) {
  const objective = action?.label ?? fallback;
  const why = action?.description ?? fallback;
  return <Card className="border-teal-200 bg-gradient-to-br from-teal-950 to-stone-950 p-6 text-white sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Current objective</p>
    <h3 className="mt-3 max-w-3xl text-2xl font-semibold sm:text-3xl">{objective}</h3>
    <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300"><span className="font-semibold text-white">Why: </span>{why}</p>
    {action?.blockers.length ? <p className="mt-4 text-sm font-medium text-amber-200">{action.blockers[0]!.message}</p> : null}
  </Card>;
}

function StageDetailCard({ stageLabel, guidance: item, progress }: {
  stageLabel: string;
  guidance: Readonly<{ objective: string; purpose: string; watchFor: string }>;
  progress: LifecycleProgress;
}) {
  return <Card className="p-5 sm:p-6">
    <p className="eyebrow">Stage detail</p>
    <h3 className="mt-2 text-xl font-semibold text-stone-950">{stageLabel}</h3>
    <dl className="mt-5 space-y-5">
      <GuidanceFact term="Purpose" value={item.purpose} />
      <GuidanceFact term="Primary objective" value={item.objective} />
      <GuidanceFact term="Watch for" value={item.watchFor} />
      <GuidanceFact term="Remaining lifecycle steps" value={progress.remaining === 0 ? "Lifecycle complete" : `${progress.remaining} remaining`} />
    </dl>
  </Card>;
}

function ProgressCard({ progress }: { progress: LifecycleProgress }) {
  return <Card className="p-5 sm:p-6">
    <p className="eyebrow">Progress</p>
    <div className="mt-4 flex items-end justify-between gap-4">
      <p className="font-serif text-5xl text-stone-950">{progress.percent}%</p>
      <p className="pb-1 text-right text-sm font-medium text-stone-600">{progress.completed} of {progress.total} stages complete</p>
    </div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Acquisition lifecycle progress">
      <div className="h-full rounded-full bg-teal-700 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} />
    </div>
    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
      <GuidanceFact term="Remaining steps" value={String(progress.remaining)} />
      <GuidanceFact term="Estimated completion" value="Not estimated" />
    </div>
    <p className="mt-4 text-xs leading-5 text-stone-500">Progress reflects canonical lifecycle stages, not an arbitrary task score.</p>
  </Card>;
}

function BlockerPanel({ blockers }: { blockers: readonly Readonly<{ id: string; title: string; explanation: string }>[] }) {
  return <Card className="border-rose-200 p-5 sm:p-6">
    <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="font-semibold text-stone-950">Blockers</h3></div>
    {blockers.length ? <ul className="mt-4 space-y-3">{blockers.map(item => <li key={item.id} className="rounded-xl bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-950">{item.title}</p><p className="mt-1 text-xs leading-5 text-rose-800">{item.explanation}</p></li>)}</ul> : <p className="mt-4 text-sm text-stone-600">No projected blockers prevent the next lifecycle step.</p>}
  </Card>;
}

function WarningPanel({ warnings }: { warnings: readonly Readonly<{ id: string; title: string; explanation: string }>[] }) {
  return <Card className="border-amber-200 p-5 sm:p-6">
    <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" /><h3 className="font-semibold text-stone-950">Warnings</h3></div>
    {warnings.length ? <ul className="mt-4 space-y-3">{warnings.map(item => <li key={item.id} className="rounded-xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">{item.title}</p><p className="mt-1 text-xs leading-5 text-amber-900">{item.explanation}</p></li>)}</ul> : <p className="mt-4 text-sm text-stone-600">No projected warnings require attention.</p>}
  </Card>;
}

function StageHistory({ history, totalCount, truncated }: {
  history: PipelineWorkspace["acquisition"]["lifecycle"]["recentHistory"];
  totalCount: number;
  truncated: boolean;
}) {
  return <Card className="p-5 sm:p-6">
    <h3 className="font-semibold text-stone-950">Lifecycle history</h3>
    {history.length ? <ol className="mt-4 divide-y divide-stone-100">{history.map(item => <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-stone-800">{item.from ? `${title(item.from)} → ` : ""}{title(item.to)}</span>
      <time dateTime={item.occurredAt.toISOString()} className="text-xs text-stone-500">{formatDateTime(item.occurredAt)}</time>
    </li>)}</ol> : <p className="mt-4 text-sm text-stone-600">No acquisition activity yet.</p>}
    {truncated ? <p className="mt-4 text-xs text-stone-500">Showing {history.length} of {totalCount} lifecycle changes.</p> : null}
  </Card>;
}

function LifecycleHealthBadge({ health }: { health: AcquisitionWorkspaceHealth }) {
  const label = health.level === "attention" ? "Attention required" : health.level === "terminal" ? "Completed" : title(health.level);
  const tone = health.level === "healthy" ? "success" : health.level === "blocked" ? "danger" : health.level === "attention" ? "warning" : "neutral";
  return <div className="flex flex-col items-start gap-1 sm:items-end"><span className="eyebrow">Lifecycle health</span><Badge tone={tone}>{label}</Badge></div>;
}

function TerminalOutcomeCard({ acquisition }: { acquisition: AcquisitionPipelineTerminalWorkspaceSummary }) {
  const outcome = acquisition.outcome;
  return <Card className={outcome.type === "acquired" ? "border-emerald-300 bg-emerald-950 p-6 text-white sm:p-8" : "border-rose-300 bg-rose-950 p-6 text-white sm:p-8"}>
    <div className="flex gap-4"><Flag className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" /><div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">Terminal outcome</p>
      <h3 className="mt-2 text-2xl font-semibold">{outcome.type === "acquired" ? "Acquisition complete" : "Pursuit exited"}</h3>
      <p className="mt-2 text-sm opacity-80">{outcome.type === "acquired"
        ? `Closed ${formatDate(outcome.closedAt)}. The completed lifecycle and final acquisition record remain available below.`
        : `${title(outcome.reason)} · exited from ${title(outcome.exitedFromStage)} on ${formatDate(outcome.exitedAt)}.`}</p>
    </div></div>
  </Card>;
}

type LifecycleProgress = Readonly<{ completed: number; total: number; remaining: number; percent: number }>;

export function buildLifecycleProgress(stages: readonly ExperienceStage[], terminal: boolean): LifecycleProgress {
  const visible = stages.filter(stage => stage.state !== "unreachable");
  const completed = visible.filter(stage => stage.state === "completed").length + (terminal && visible.some(stage => stage.state === "current") ? 1 : 0);
  const total = visible.length;
  const boundedCompleted = Math.min(completed, total);
  return {
    completed: boundedCompleted,
    total,
    remaining: Math.max(0, total - boundedCompleted),
    percent: total ? Math.round((boundedCompleted / total) * 100) : 0,
  };
}

export function buildExperienceStages(workspace: PipelineWorkspace): readonly ExperienceStage[] {
  const source = workspace.acquisition.lifecycle.stages;
  const stage = (id: AcquisitionLifecycleStageSummary["stage"]) => source.find(item => item.stage === id);
  const combine = (ids: readonly AcquisitionLifecycleStageSummary["stage"][]): Pick<ExperienceStage, "state" | "completedAt"> => {
    const items = ids.map(id => stage(id)).filter((item): item is AcquisitionLifecycleStageSummary => Boolean(item));
    const current = items.find(item => item.state === "current");
    if (current) return { state: "current", ...(current.completedAt ? { completedAt: current.completedAt } : {}) };
    const exited = items.find(item => item.state === "exited");
    if (exited) return { state: "exited", ...(exited.completedAt ? { completedAt: exited.completedAt } : {}) };
    if (items.length && items.every(item => item.state === "completed")) {
      const completedAt = items.map(item => item.completedAt).filter((value): value is Date => Boolean(value)).at(-1);
      return { state: "completed", ...(completedAt ? { completedAt } : {}) };
    }
    if (items.some(item => item.state === "completed")) return { state: "completed" };
    return { state: items.some(item => item.state === "unreachable") ? "unreachable" : "upcoming" };
  };
  const firstHistory = workspace.acquisition.lifecycle.recentHistory.at(-1)?.occurredAt;
  const canonical: ExperienceStage[] = [
    { id: "discovery", label: "Discovery", state: "completed", ...(workspace.opportunity.createdAt ? { completedAt: workspace.opportunity.createdAt } : {}) },
    { id: "analysis", label: "Analysis", state: workspace.analysis ? "completed" : "unreachable", ...(workspace.analysis ? { completedAt: workspace.analysis.analyzedAt } : {}) },
    { id: "pursuit", label: "Pursuit", ...combine(["pursuit"]), ...(firstHistory && combine(["pursuit"]).state === "completed" ? { completedAt: firstHistory } : {}) },
    { id: "offer", label: "Offer", ...combine(["offer-preparation", "offer-submitted", "negotiating"]) },
    { id: "contract", label: "Contract", ...combine(["under-contract"]) },
    { id: "due-diligence", label: "Due diligence", ...combine(["due-diligence"]) },
    { id: "closing", label: "Closing", ...combine(["closing-preparation"]) },
    { id: "acquired", label: "Acquired", ...combine(["closed-acquired"]) },
  ];
  if (workspace.status === "pipeline-terminal" && workspace.acquisition.outcome.type === "exited") {
    canonical.push({ id: "exited", label: "Exited", state: "exited", completedAt: workspace.acquisition.outcome.exitedAt });
  }
  return canonical;
}

function collectBlockers(workspace: PipelineWorkspace, primary: AcquisitionWorkspaceNextAction | null) {
  const requirement = workspace.acquisition.requirements.blocking.map(item => ({ id: `requirement-${item.id}`, title: item.title, explanation: `${title(item.status)}${item.overdue ? " and overdue" : ""}.` }));
  const readiness = workspace.acquisition.readiness?.blockers.map(item => ({ id: `readiness-${item.code}-${item.sourceId ?? ""}`, title: item.title, explanation: item.explanation })) ?? [];
  const action = primary?.blockers.map(item => ({ id: `action-${item.code}-${item.sourceId ?? ""}`, title: "Next action unavailable", explanation: item.message })) ?? [];
  return uniqueIssues([...requirement, ...readiness, ...action]);
}

function collectWarnings(workspace: PipelineWorkspace) {
  const readiness = workspace.acquisition.readiness?.warnings.map(item => ({ id: `readiness-${item.code}-${item.sourceId ?? ""}`, title: item.title, explanation: item.explanation })) ?? [];
  const health = workspace.acquisition.health.level === "terminal" ? [] : workspace.acquisition.health.reasons.map(item => ({ id: `health-${item.code}`, title: title(item.code), explanation: item.message }));
  return uniqueIssues([...readiness, ...health]);
}

function uniqueIssues(items: readonly Readonly<{ id: string; title: string; explanation: string }>[]) {
  return items.filter((item, index) => items.findIndex(candidate => candidate.id === item.id) === index);
}

function GuidanceFact({ term, value }: { term: string; value: string }) {
  return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm leading-6 text-stone-700">{value}</dd></div>;
}

function StageIcon({ state }: { state: ExperienceStage["state"] }) {
  if (state === "completed") return <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />;
  if (state === "exited") return <Flag className="h-4 w-4 text-rose-700" aria-hidden="true" />;
  if (state === "current") return <span className="h-3 w-3 rounded-full bg-teal-700 ring-4 ring-teal-100" aria-hidden="true" />;
  return <Circle className="h-4 w-4 text-stone-400" aria-hidden="true" />;
}

function stateLabel(state: ExperienceStage["state"]) {
  return state === "current" ? "Current stage" : state === "completed" ? "Completed" : state === "exited" ? "Exited" : state === "unreachable" ? "Unavailable" : "Upcoming";
}
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

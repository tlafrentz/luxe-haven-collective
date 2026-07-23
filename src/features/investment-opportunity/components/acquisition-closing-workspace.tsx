"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LoaderCircle, LockKeyhole, RefreshCw, X } from "lucide-react";
import { closeAcquisitionAction } from "@/app/actions/acquisition-workspace-commands";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionActiveWorkspace,
  AcquisitionClosingReadinessWorkspaceSummary,
  AcquisitionPipelineTerminalWorkspaceSummary,
  AcquisitionTerminalWorkspace,
  AcquisitionWorkspaceNextAction,
} from "../acquisition-workspace";
import type { AcquisitionServerCommandResult, CloseAcquisitionServerInput } from "../acquisition-server";
import { AcquisitionPrimaryAction } from "./acquisition-primary-action";

type ClosingWorkspaceProps = Readonly<{
  workspace: AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace;
  primaryAction: AcquisitionWorkspaceNextAction | null;
}>;
type ClosingCheck = Readonly<{
  id: string;
  label: string;
  status: "passed" | "warning" | "blocked" | "unavailable";
  explanation: string;
  resolution?: string;
}>;

export function isClosingActionType(type: AcquisitionWorkspaceNextAction["type"]): boolean {
  return type === "review-closing-readiness" || type === "begin-closing-preparation" || type === "close-acquisition";
}

export function AcquisitionClosingWorkspace({ workspace, primaryAction }: ClosingWorkspaceProps) {
  if (workspace.status === "pipeline-terminal" && workspace.acquisition.outcome.type === "acquired") {
    return <AcquiredOutcomeCard workspace={workspace} />;
  }

  const acquisition = workspace.acquisition;
  const checks = buildClosingChecks(workspace, primaryAction);
  const blockers = checks.filter(check => check.status === "blocked");
  const unavailable = checks.filter(check => check.status === "unavailable");
  const warnings = checks.filter(check => check.status === "warning");
  const health = closingHealth(acquisition.readiness, blockers.length, unavailable.length, warnings.length);
  const objective = closingObjective(acquisition.readiness, primaryAction, blockers, unavailable);

  return <section aria-labelledby="closing-workspace-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Closing workspace</p><h2 id="closing-workspace-heading" className="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Closing</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Review the version-bound readiness, permanent commercial facts, and remaining conditions before completing this acquisition.</p></div>
      <Badge tone={health === "ready" || health === "healthy" ? "success" : health === "attention" ? "warning" : "danger"}>{title(health)}</Badge>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <ClosingReadinessCard readiness={acquisition.readiness} health={health} />
      <CurrentClosingObjective objective={objective} action={primaryAction} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <ClosingChecklist checks={checks} />
      <ClosingIssues blockers={[...blockers, ...unavailable]} warnings={warnings} readiness={acquisition.readiness} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <ClosingFactsCard workspace={workspace} />
      <AcquisitionSummaryCard workspace={workspace} />
    </div>

    {workspace.status === "pipeline-active" && primaryAction?.type === "close-acquisition"
      ? <ClosingCommandExperience workspace={workspace} action={primaryAction} checks={checks} />
      : <ClosingActionStatus workspace={workspace} action={primaryAction} />}
  </section>;
}

export function buildClosingChecks(workspace: AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace, action: AcquisitionWorkspaceNextAction | null): readonly ClosingCheck[] {
  const { acquisition } = workspace;
  const readiness = acquisition.readiness;
  const evidence = acquisition.requirements.evidence;
  const contract = acquisition.commercial.contract;
  const alignment = acquisition.commercial.contractAlignment;
  const requirementsComplete = acquisition.requirements.initialized
    && acquisition.requirements.totals.notStarted === 0
    && acquisition.requirements.totals.inProgress === 0
    && acquisition.requirements.totals.failed === 0;
  const evidenceComplete = evidence.unavailable === 0 && evidence.withdrawn === 0;
  const infrastructure = action?.blockers.some(blocker => /DEPLOY|VERIF|DEPENDENCY|INFRASTRUCTURE/i.test(`${blocker.code} ${blocker.message}`)) ?? false;
  return [
    { id: "contract", label: "Contract recorded", status: contract ? "passed" : "blocked", explanation: contract ? "The executed contract is represented in the canonical commercial projection." : "A recorded contract is required before closing.", ...(!contract ? { resolution: "Record the executed contract." } : {}) },
    { id: "requirements", label: "Requirements resolved", status: requirementsComplete ? "passed" : "blocked", explanation: requirementsComplete ? "No projected requirement remains open or failed." : "One or more projected requirements remain open, failed, or uninitialized.", ...(!requirementsComplete ? { resolution: "Resolve the remaining acquisition requirements." } : {}) },
    { id: "evidence", label: "Evidence available", status: evidenceComplete ? "passed" : "blocked", explanation: evidenceComplete ? "No linked Evidence is projected as unavailable or withdrawn." : `${evidence.unavailable} unavailable and ${evidence.withdrawn} withdrawn Evidence reference(s) remain.`, ...(!evidenceComplete ? { resolution: "Restore or replace required Evidence." } : {}) },
    { id: "readiness", label: "Readiness current", status: readiness?.current ? readiness.status === "ready" ? "passed" : readiness.status === "conditionally-ready" ? "warning" : "blocked" : "blocked", explanation: !readiness ? "Closing readiness has not been evaluated." : !readiness.current ? "Readiness was evaluated against an earlier pipeline version." : `Readiness is ${title(readiness.status)} at pipeline version ${readiness.evaluatedPipelineVersion}.`, ...(!readiness?.current || readiness.status === "not-ready" ? { resolution: "Re-evaluate readiness after resolving current blockers." } : {}) },
    { id: "commercial", label: "Commercial basis consistent", status: alignment?.status === "changed" ? "blocked" : contract && acquisition.commercial.acceptedAgreement ? "passed" : "warning", explanation: alignment?.status === "changed" ? "The recorded contract differs from the accepted commercial basis." : contract && acquisition.commercial.acceptedAgreement ? "Accepted agreement and contract remain aligned in the bounded projection." : "Complete agreement lineage is not available.", ...(alignment?.status === "changed" ? { resolution: "Review and reconcile the agreement and contract before closing." } : {}) },
    { id: "stage", label: "Closing stage eligible", status: acquisition.stage === "closing-preparation" ? "passed" : "blocked", explanation: acquisition.stage === "closing-preparation" ? "The pipeline is in closing preparation." : "The pipeline has not entered closing preparation.", ...(acquisition.stage !== "closing-preparation" ? { resolution: "Complete due diligence and begin closing preparation." } : {}) },
    ...(action?.type === "close-acquisition" && action.blockers.length ? action.blockers.map((blocker, index) => ({ id: `action-${index}-${blocker.code}`, label: infrastructure ? "Closing infrastructure" : "Closing prerequisite", status: infrastructure ? "unavailable" as const : "blocked" as const, explanation: blocker.message, resolution: infrastructure ? "Wait for verified production command availability." : "Resolve the projected closing blocker." })) : []),
  ];
}

function ClosingReadinessCard({ readiness, health }: { readiness: AcquisitionClosingReadinessWorkspaceSummary | null; health: "healthy" | "attention" | "blocked" | "ready" }) {
  return <Panel title="Closing readiness" description="A domain-derived evaluation tied to a canonical pipeline version.">
    {!readiness ? <Empty title="Readiness has not been evaluated." body="Complete the applicable acquisition stage before preparing to close." /> : <>
      <div className="flex flex-wrap items-center gap-3"><span className="font-serif text-4xl text-stone-950">{title(readiness.status)}</span><Badge tone={health === "ready" || health === "healthy" ? "success" : health === "attention" ? "warning" : "danger"}>{title(health)}</Badge></div>
      <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3"><Fact term="Evaluated" value={formatDateTime(readiness.evaluatedAt)} /><Fact term="Current" value={readiness.current ? "Yes" : "No"} /><Fact term="Pipeline version" value={String(readiness.evaluatedPipelineVersion)} /><Fact term="Blockers" value={String(readiness.blockerTotalCount)} /><Fact term="Warnings" value={String(readiness.warningTotalCount)} /></dl>
      {!readiness.current ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Readiness must be re-evaluated before closing.</p> : null}
    </>}
  </Panel>;
}

function CurrentClosingObjective({ objective, action }: { objective: string; action: AcquisitionWorkspaceNextAction | null }) {
  return <Panel title="Current closing objective" description="One clear objective derived from current workspace state."><div className="rounded-xl bg-stone-950 p-5 text-white"><p className="font-serif text-2xl">{objective}</p><p className="mt-3 text-sm leading-6 text-stone-300">{action?.description ?? "Review the projected closing state and resolve the earliest blocking condition."}</p></div></Panel>;
}

function ClosingChecklist({ checks }: { checks: readonly ClosingCheck[] }) {
  return <Panel title="Closing checklist" description="Read-only explanations of readiness; this checklist does not change canonical state."><ul className="space-y-3">{checks.filter(check => !check.id.startsWith("action-")).map(check => <li key={check.id} className="flex gap-3 rounded-xl bg-stone-50 p-4">{check.status === "passed" ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-label="Passed" /> : <AlertTriangle className={check.status === "warning" ? "mt-0.5 h-5 w-5 shrink-0 text-amber-700" : "mt-0.5 h-5 w-5 shrink-0 text-rose-700"} aria-label={check.status === "warning" ? "Warning" : "Action required"} />}<div><p className="text-sm font-semibold text-stone-900">{check.label}</p><p className="mt-1 text-xs leading-5 text-stone-600">{check.explanation}</p></div></li>)}</ul></Panel>;
}

function ClosingIssues({ blockers, warnings, readiness }: { blockers: readonly ClosingCheck[]; warnings: readonly ClosingCheck[]; readiness: AcquisitionClosingReadinessWorkspaceSummary | null }) {
  const projectedBlockers = readiness?.blockers.map((item, index) => ({ id: `readiness-${item.code}-${index}`, label: item.title, status: "blocked" as const, explanation: `${item.explanation} Source: ${title(item.sourceType)}.`, resolution: item.resolvable ? "Resolve the source condition and re-evaluate readiness." : "Review the source condition." })) ?? [];
  const projectedWarnings = readiness?.warnings.map((item, index) => ({ id: `warning-${item.code}-${index}`, label: item.title, status: "warning" as const, explanation: item.explanation })) ?? [];
  return <Panel title="Outstanding conditions" description="Blockers prevent safe closing. Warnings require attention but are not automatically blocking."><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><IssueGroup heading="Blockers" items={[...projectedBlockers, ...blockers]} empty="No closing blockers." /><IssueGroup heading="Warnings" items={[...projectedWarnings, ...warnings]} empty="No closing warnings." /></div></Panel>;
}

function ClosingFactsCard({ workspace }: { workspace: AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace }) {
  const terminal = workspace.status === "pipeline-terminal" && workspace.acquisition.outcome.type === "acquired" ? workspace.acquisition.outcome.closingFacts : null;
  const contract = workspace.acquisition.commercial.contract;
  return <Panel title="Closing facts" description={terminal ? "The permanent facts recorded at acquisition." : "Read-only proposed final facts derived from the recorded contract."}>
    {terminal?.route === "purchase" ? <dl className="grid grid-cols-2 gap-5"><Fact term="Final purchase price" value={money(terminal.finalPurchasePrice.amount)} /><Fact term="Closing date" value={formatDate(terminal.closedAt)} /><Fact term="Financing" value={title(terminal.financingType)} /><Fact term="Ownership" value="Acquired" /></dl>
      : terminal?.route === "rental-arbitrage" ? <dl className="grid grid-cols-2 gap-5"><Fact term="Final monthly rent" value={money(terminal.finalMonthlyRent.amount)} /><Fact term="Agreement executed" value={formatDate(terminal.agreementExecutedAt)} /><Fact term="Commencement" value={formatDate(terminal.commencementAt)} /><Fact term="Operating permission" value={title(terminal.operatingPermissionStatus)} /></dl>
      : contract?.headlineTerms.route === "purchase" ? <dl className="grid grid-cols-2 gap-5"><Fact term="Final purchase price" value={money(contract.headlineTerms.contractPrice.amount)} /><Fact term="Closing date" value={formatDate(contract.headlineTerms.scheduledClosingDate)} /><Fact term="Financing" value={title(contract.headlineTerms.financingType)} /><Fact term="Property ownership" value="Becomes acquired after successful close" /></dl>
      : contract?.headlineTerms.route === "rental-arbitrage" ? <dl className="grid grid-cols-2 gap-5"><Fact term="Monthly rent" value={money(contract.headlineTerms.monthlyRent.amount)} /><Fact term="Lease term" value={`${contract.headlineTerms.leaseTermMonths} months`} /><Fact term="Commencement" value={formatDate(contract.headlineTerms.commencementDate)} /><Fact term="Operating permission" value={title(contract.operatingPermission?.status ?? "unclear")} /></dl>
      : <Empty title="Closing facts are unavailable." body="Record the executed contract before reviewing final closing facts." />}
    {!terminal && contract ? <p className="mt-5 text-xs leading-5 text-stone-500">These values are derived from the bounded contract projection. Specialized editing remains outside this workspace; the server validates authoritative closing facts.</p> : null}
  </Panel>;
}

function AcquisitionSummaryCard({ workspace }: { workspace: AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace }) {
  const contract = workspace.acquisition.commercial.contract;
  return <Panel title="Acquisition summary" description="What becomes permanent after successful closing."><div className="rounded-xl border border-stone-200 p-5"><p className="eyebrow">You are about to acquire</p><p className="mt-2 font-serif text-2xl text-stone-950">{workspace.opportunity.name}</p><p className="mt-1 text-sm text-stone-600">{workspace.opportunity.location.display}</p><dl className="mt-5 grid grid-cols-2 gap-5"><Fact term="Route" value={workspace.opportunity.route === "purchase" ? "Purchase" : "Rental Arbitrage"} /><Fact term="Commercial basis" value={contract ? title(contract.source) : "Not recorded"} /><Fact term="Pipeline outcome" value="Acquired" /><Fact term="Opportunity status" value="Changes to acquired" /></dl></div></Panel>;
}

function ClosingActionStatus({ workspace, action }: { workspace: AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace; action: AcquisitionWorkspaceNextAction | null }) {
  if (workspace.status === "pipeline-active" && action?.type === "begin-closing-preparation") return <AcquisitionPrimaryAction action={action} opportunity={workspace.opportunity} analysis={workspace.analysis} />;
  return <Card className="border-stone-200 bg-stone-50 p-5 sm:p-6"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-stone-500" aria-hidden="true" /><div><h3 className="font-semibold text-stone-900">{action?.label ?? "Closing action unavailable"}</h3><p className="mt-1 text-sm text-stone-600">{action?.description ?? "No closing action is projected in the current lifecycle stage."}</p>{action?.blockers.length ? <ul className="mt-3 space-y-1 text-sm text-amber-800">{action.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blocker.message}</li>)}</ul> : null}</div></div></Card>;
}

function ClosingCommandExperience({ workspace, action, checks }: { workspace: AcquisitionActiveWorkspace; action: AcquisitionWorkspaceNextAction; checks: readonly ClosingCheck[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preparing" | "executing" | "refreshing">("idle");
  const [result, setResult] = useState<AcquisitionServerCommandResult | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ready = action.enabled && checks.every(check => check.status === "passed" || check.status === "warning");
  const input = useMemo(() => buildCloseCommandInput(workspace, action), [workspace, action]);
  function closeDialog() { if (pending) return; setOpen(false); setConfirmed(false); queueMicrotask(() => triggerRef.current?.focus()); }
  function submit() {
    if (!confirmed || !ready || !input) return;
    startTransition(async () => {
      setPhase("preparing");
      await Promise.resolve();
      setPhase("executing");
      const next = await closeAcquisitionAction({ ...input, envelope: { ...input.envelope, idempotencyKey: crypto.randomUUID() } });
      setResult(next);
      if (next.status === "succeeded") { setPhase("refreshing"); setOpen(false); router.refresh(); } else setPhase("idle");
    });
  }
  return <Card className="border-stone-800 bg-stone-950 p-5 text-white sm:p-6" aria-live="polite"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow text-stone-400">Irreversible commitment</p><h3 className="mt-2 text-xl font-semibold">Close acquisition</h3><p className="mt-1 max-w-2xl text-sm text-stone-300">Closing makes the acquisition terminal, changes the opportunity to acquired, and ends commercial negotiation.</p></div><button ref={triggerRef} type="button" onClick={() => setOpen(true)} disabled={!ready || !input || pending} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500">Review confirmation</button></div>
    {!ready || !input ? <p className="mt-4 border-t border-stone-800 pt-4 text-sm text-amber-200">{action.blockers[0]?.message ?? "Complete every blocking closing check before confirmation."}</p> : null}
    {phase !== "idle" ? <ClosingProgress phase={phase} /> : null}
    {result?.status === "succeeded" ? <div role="status" className="mt-4 rounded-xl bg-emerald-950 p-4 text-sm text-emerald-100"><strong>Acquisition complete.</strong> The canonical workspace is refreshing.</div> : null}
    {result?.status === "conflict" ? <CommandFeedback title="This acquisition changed after your review." body="Reload the workspace before closing." action={<button type="button" onClick={() => router.refresh()} className="mt-3 inline-flex items-center gap-2 font-semibold underline"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload workspace</button>} /> : null}
    {result?.status === "blocked" ? <CommandFeedback title="Closing blocked." body={result.blockers[0]?.message ?? "The server found a closing blocker."} /> : null}
    {result?.status === "unavailable" ? <CommandFeedback title="Closing unavailable." body="Verified production command infrastructure is not available. No acquisition state changed." /> : null}
    {result && !["succeeded", "conflict", "blocked", "unavailable"].includes(result.status) ? <CommandFeedback title="Acquisition not closed." body="The command could not complete safely. No local optimistic change was applied." /> : null}
    {open ? <ClosingConfirmationDialog confirmed={confirmed} setConfirmed={setConfirmed} pending={pending} phase={phase} onCancel={closeDialog} onSubmit={submit} /> : null}
  </Card>;
}

function buildCloseCommandInput(workspace: AcquisitionActiveWorkspace, action: AcquisitionWorkspaceNextAction): CloseAcquisitionServerInput | null {
  const command = action.command;
  const contract = workspace.acquisition.commercial.contract;
  if (!command || command.commandType !== "close" || !command.pipelineId || !command.expectedPipelineVersion || !contract) return null;
  const closingFacts = contract.headlineTerms.route === "purchase"
    ? { route: "purchase" as const, closedAt: contract.headlineTerms.scheduledClosingDate.toISOString(), finalPurchasePrice: { amount: String(contract.headlineTerms.contractPrice.amount), currency: "USD" as const }, financingType: contract.headlineTerms.financingType }
    : { route: "rental-arbitrage" as const, agreementExecutedAt: contract.effectiveDate.toISOString(), commencementAt: contract.headlineTerms.commencementDate.toISOString(), finalMonthlyRent: { amount: String(contract.headlineTerms.monthlyRent.amount), currency: "USD" as const }, operatingPermissionStatus: contract.operatingPermission?.status ?? "unclear" as const };
  return { commandType: "close-acquisition", envelope: { opportunityId: command.opportunityId, pipelineId: command.pipelineId, expectedOpportunityVersion: command.expectedOpportunityVersion, expectedPipelineVersion: command.expectedPipelineVersion, idempotencyKey: "" }, closingFacts };
}

export function ClosingConfirmationDialog({ confirmed, setConfirmed, pending, phase, onCancel, onSubmit }: { confirmed: boolean; setConfirmed: (value: boolean) => void; pending: boolean; phase: "idle" | "preparing" | "executing" | "refreshing"; onCancel: () => void; onSubmit: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [onCancel]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4" role="presentation"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="closing-confirmation-title" aria-describedby="closing-confirmation-description" className="w-full max-w-xl rounded-2xl bg-white p-6 text-stone-950 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Final confirmation</p><h4 id="closing-confirmation-title" className="mt-2 text-2xl font-semibold">Complete this acquisition?</h4></div><button ref={cancelRef} type="button" onClick={onCancel} disabled={pending} aria-label="Close acquisition confirmation" className="rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><X className="h-5 w-5" aria-hidden="true" /></button></div><p id="closing-confirmation-description" className="mt-4 text-sm leading-6 text-stone-600">After closing, the acquisition becomes permanent, the pipeline becomes terminal, the opportunity changes to acquired, and further commercial negotiation ends.</p><label className="mt-6 flex gap-3 rounded-xl bg-stone-50 p-4"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="mt-1 h-4 w-4 accent-teal-700" /><span className="text-sm font-medium">I reviewed readiness, blockers, warnings, commercial consistency, and the final closing facts and intend to complete this acquisition.</span></label>{pending ? <ClosingProgress phase={phase} /> : null}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={pending} className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-semibold">Return to review</button><button type="button" onClick={onSubmit} disabled={!confirmed || pending} className="rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:bg-stone-300">{pending ? "Closing acquisition…" : "Close acquisition"}</button></div></div></div>;
}

function ClosingProgress({ phase }: { phase: "idle" | "preparing" | "executing" | "refreshing" }) {
  const stages = ["preparing", "executing", "refreshing"] as const, current = stages.indexOf(phase as typeof stages[number]);
  return <div role="status" className="mt-4 rounded-xl border border-stone-700 bg-stone-900 p-4 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{phase === "preparing" ? "Preparing closing…" : phase === "executing" ? "Executing closing…" : "Refreshing workspace…"}</div><ol className="mt-3 grid grid-cols-3 gap-2 text-xs">{stages.map((stage, index) => <li key={stage} className={index <= current ? "text-teal-300" : "text-stone-500"}>{index < current ? "✓ " : ""}{title(stage)}</li>)}</ol></div>;
}

function AcquiredOutcomeCard({ workspace }: { workspace: AcquisitionTerminalWorkspace }) {
  const acquisition = workspace.acquisition as AcquisitionPipelineTerminalWorkspaceSummary;
  if (acquisition.outcome.type !== "acquired") return null;
  return <section aria-labelledby="acquired-outcome-heading" className="space-y-5"><Card className="overflow-hidden border-emerald-300 bg-emerald-950 p-6 text-white sm:p-8"><Badge tone="success">Acquired</Badge><h2 id="acquired-outcome-heading" className="mt-5 font-serif text-4xl">Acquisition complete</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100">This acquisition has been completed. Its closing facts, commercial basis, lifecycle, and activity remain available as a permanent operational record.</p><dl className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4"><Fact term="Completed" value={formatDate(acquisition.outcome.closedAt)} light /><Fact term="Route" value={workspace.opportunity.route === "purchase" ? "Purchase" : "Rental Arbitrage"} light /><Fact term="Lifecycle" value="Acquired" light /><Fact term="Active actions" value="None" light /></dl></Card><div className="grid gap-5 xl:grid-cols-2"><ClosingFactsCard workspace={workspace} /><AcquisitionSummaryCard workspace={workspace} /></div><Panel title="Completed closing timeline" description="The bounded lifecycle history remains the canonical record."><ol className="space-y-3">{acquisition.lifecycle.recentHistory.map(item => <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 p-4"><span className="text-sm font-semibold">{title(item.to)}</span><time dateTime={item.occurredAt.toISOString()} className="text-xs text-stone-500">{formatDateTime(item.occurredAt)}</time></li>)}</ol></Panel></section>;
}

function Panel({ title: heading, description, children }: { title: string; description: string; children: React.ReactNode }) { const id = `closing-${heading.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`; return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="mb-5"><h3 id={id} className="text-lg font-semibold text-stone-950">{heading}</h3><p className="mt-1 text-sm text-stone-500">{description}</p></div>{children}</Card></section>; }
function IssueGroup({ heading, items, empty }: { heading: string; items: readonly ClosingCheck[]; empty: string }) { return <div><h4 className="text-sm font-semibold text-stone-900">{heading}</h4>{items.length ? <ul className="mt-3 space-y-2">{items.map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs leading-5 text-stone-600">{item.explanation}</p>{item.resolution ? <p className="mt-1 text-xs font-semibold text-stone-700">Resolution: {item.resolution}</p> : null}</li>)}</ul> : <p className="mt-3 text-sm text-stone-500">{empty}</p>}</div>; }
function CommandFeedback({ title: heading, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div role="alert" className="mt-4 rounded-xl bg-rose-950 p-4 text-sm text-rose-100"><strong>{heading}</strong> {body}{action}</div>; }
function Empty({ title: heading, body }: { title: string; body: string }) { return <div className="rounded-xl bg-stone-50 p-5"><p className="font-semibold text-stone-800">{heading}</p><p className="mt-1 text-sm text-stone-600">{body}</p></div>; }
function Fact({ term, value, light = false }: { term: string; value: string; light?: boolean }) { return <div><dt className={light ? "text-xs font-semibold uppercase tracking-[.14em] text-emerald-300" : "eyebrow"}>{term}</dt><dd className={light ? "mt-1.5 text-sm font-semibold text-white" : "mt-1.5 text-sm font-semibold text-stone-800"}>{value}</dd></div>; }
function closingHealth(readiness: AcquisitionClosingReadinessWorkspaceSummary | null, blockers: number, unavailable: number, warnings: number): "healthy" | "attention" | "blocked" | "ready" { if (blockers || unavailable || !readiness || !readiness.current || readiness.status === "not-ready") return "blocked"; if (readiness.status === "ready" && !warnings) return "ready"; return warnings || readiness.status === "conditionally-ready" ? "attention" : "healthy"; }
function closingObjective(readiness: AcquisitionClosingReadinessWorkspaceSummary | null, action: AcquisitionWorkspaceNextAction | null, blockers: readonly ClosingCheck[], unavailable: readonly ClosingCheck[]): string { if (unavailable[0]) return "Wait for verified closing infrastructure."; if (!readiness?.current) return "Re-evaluate closing readiness."; if (blockers[0]) return blockers[0].resolution ?? `Resolve ${blockers[0].label.toLowerCase()}.`; return action?.label ?? "Review final closing facts."; }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

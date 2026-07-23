"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, LoaderCircle, RefreshCw, Send, X } from "lucide-react";
import { submitAcquisitionOfferAction } from "@/app/actions/acquisition-workspace-commands";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionAlignmentWorkspaceSummary,
  AcquisitionOfferWorkspaceSummary,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
} from "../acquisition-workspace";
import type { AcquisitionServerCommandResult } from "../acquisition-server";

type ReviewCheck = Readonly<{
  id: string;
  category: "commercial" | "investment" | "workflow" | "technical";
  label: string;
  status: "passed" | "warning" | "blocked" | "unavailable";
  explanation: string;
  resolution?: string;
}>;

export function OfferReviewWorkspace({
  offer,
  analysis,
  alignment,
  action,
}: {
  offer: AcquisitionOfferWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
  alignment: AcquisitionAlignmentWorkspaceSummary | null;
  action: AcquisitionWorkspaceNextAction;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "validating" | "submitting" | "refreshing">("idle");
  const [result, setResult] = useState<AcquisitionServerCommandResult | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const checks = useMemo(() => buildOfferReviewChecks({ offer, analysis, alignment, action }), [offer, analysis, alignment, action]);
  const blockers = checks.filter(check => check.status === "blocked");
  const unavailable = checks.filter(check => check.status === "unavailable");
  const warnings = checks.filter(check => check.status === "warning");
  const ready = blockers.length === 0 && unavailable.length === 0 && action.enabled;

  function closeDialog() {
    if (pending) return;
    setDialogOpen(false);
    setConfirmed(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function submit() {
    if (!confirmed || !ready || action.command?.commandType !== "submit-offer" || !action.command.pipelineId || !action.command.expectedPipelineVersion) return;
    const command = action.command;
    startTransition(async () => {
      setPhase("validating");
      await Promise.resolve();
      setPhase("submitting");
      const next = await submitAcquisitionOfferAction({
        commandType: "submit-offer",
        envelope: {
          opportunityId: command.opportunityId,
          pipelineId: command.pipelineId!,
          expectedOpportunityVersion: command.expectedOpportunityVersion,
          expectedPipelineVersion: command.expectedPipelineVersion!,
          idempotencyKey: crypto.randomUUID(),
        },
        offerId: offer.id,
      });
      setResult(next);
      if (next.status === "succeeded") {
        setPhase("refreshing");
        setDialogOpen(false);
        router.refresh();
      } else {
        setPhase("idle");
      }
    });
  }

  return <section aria-labelledby="offer-review-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Decision checkpoint</p><h3 id="offer-review-heading" className="mt-2 font-serif text-3xl text-stone-950">Review &amp; submit offer</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Confirm the commercial position, investment alignment, and server-validated workflow state before making this offer immutable.</p></div>
      <Badge tone={ready ? "success" : unavailable.length ? "warning" : "danger"}>{ready ? "Ready to submit" : unavailable.length ? "Submission unavailable" : "Not ready"}</Badge>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <OfferReviewSummary offer={offer} />
      <OfferAlignmentReview offer={offer} analysis={analysis} alignment={alignment} />
    </div>

    <ValidationChecklist checks={checks} />
    <SubmissionReadinessCard blockers={blockers} warnings={warnings} unavailable={unavailable} ready={ready} />

    <Card className="border-stone-800 bg-stone-950 p-5 text-white sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Commitment</p><h4 className="mt-2 text-xl font-semibold">{action.label}</h4><p className="mt-1 max-w-2xl text-sm text-stone-300">{action.description}</p></div>
        <button ref={triggerRef} type="button" onClick={() => setDialogOpen(true)} disabled={!ready || pending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"><Send className="h-4 w-4" aria-hidden="true" /> Review confirmation</button>
      </div>
      {!ready ? <p className="mt-4 border-t border-stone-800 pt-4 text-sm text-amber-200">{unavailable[0]?.explanation ?? blockers[0]?.explanation ?? "Submission is not available."}</p> : null}
      {phase !== "idle" ? <SubmissionProgress phase={phase} /> : null}
      {result?.status === "succeeded" ? <div role="status" className="mt-4 rounded-xl bg-emerald-950 p-4 text-sm text-emerald-100"><strong>Offer submitted.</strong> Waiting for counterparty response. The canonical workspace is refreshing.</div> : null}
      {result?.status === "conflict" ? <div role="alert" className="mt-4 rounded-xl bg-amber-950 p-4 text-sm text-amber-100"><strong>This acquisition changed after the page loaded.</strong> Reload to review the latest commercial state before submitting again.<button type="button" onClick={() => router.refresh()} className="mt-3 flex items-center gap-2 font-semibold underline"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload workspace</button></div> : null}
      {result?.status === "blocked" ? <CommandIssue title="Submission blocked" message={result.blockers[0]?.message ?? "The server found a blocking submission issue."} /> : null}
      {result?.status === "unavailable" ? <CommandIssue title="Submission unavailable" message="The command boundary is not available in this deployment. Your draft remains unchanged." /> : null}
      {result && !["succeeded", "conflict", "blocked", "unavailable"].includes(result.status) ? <CommandIssue title="Offer not submitted" message="The offer could not be submitted safely. Your draft remains unchanged." /> : null}
    </Card>

    {dialogOpen ? <SubmissionConfirmationDialog offer={offer} confirmed={confirmed} setConfirmed={setConfirmed} pending={pending} phase={phase} onCancel={closeDialog} onSubmit={submit} /> : null}
  </section>;
}

function OfferReviewSummary({ offer }: { offer: AcquisitionOfferWorkspaceSummary }) {
  const terms = offer.headlineTerms;
  return <ReviewPanel title="Offer summary" description="What will be sent if server validation succeeds.">
    <div className="rounded-xl bg-stone-950 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">You are offering</p>
      <p className="mt-2 font-serif text-4xl">{terms.route === "purchase" ? money(terms.offerPrice.amount) : `${money(terms.proposedMonthlyRent.amount)}/mo`}</p>
      <p className="mt-2 text-sm text-stone-300">{terms.route === "purchase" ? `${title(terms.financingType)} purchase` : `${terms.leaseTermMonths}-month rental-arbitrage lease`}</p>
    </div>
    {terms.route === "purchase" ? <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3"><ReviewFact term="Price" value={money(terms.offerPrice.amount)} /><ReviewFact term="Financing" value={title(terms.financingType)} /><ReviewFact term="Closing" value={terms.proposedClosingDate ? formatDate(terms.proposedClosingDate) : "Not projected"} /><ReviewFact term="Expiration" value={offer.expiresAt ? formatDateTime(offer.expiresAt) : "Not projected"} /><ReviewFact term="Earnest money" value="Detailed workflow" /></dl>
      : <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3"><ReviewFact term="Monthly rent" value={money(terms.proposedMonthlyRent.amount)} /><ReviewFact term="Lease" value={`${terms.leaseTermMonths} months`} /><ReviewFact term="Commencement" value={terms.proposedCommencementDate ? formatDate(terms.proposedCommencementDate) : "Not projected"} /><ReviewFact term="Operating permission" value={terms.operatingPermissionRequested ? "Requested" : "Not requested"} /><ReviewFact term="Expiration" value={offer.expiresAt ? formatDateTime(offer.expiresAt) : "Not projected"} /><ReviewFact term="Security deposit" value="Detailed workflow" /></dl>}
    <p className="mt-5 text-xs leading-5 text-stone-500">This review uses presentation-safe headline terms. Detailed conditions, deposits, utilities, and contingencies remain server-validated from the canonical offer.</p>
  </ReviewPanel>;
}

function OfferAlignmentReview({ offer, analysis, alignment }: { offer: AcquisitionOfferWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; alignment: AcquisitionAlignmentWorkspaceSummary | null }) {
  const classification = alignment?.status === "aligned" ? "Aligned" : alignment?.status === "changed" ? "Watch closely" : "Alignment unavailable";
  return <ReviewPanel title="Investment alignment" description="The offer’s relationship to its originating investment analysis.">
    <div className="flex flex-wrap gap-2"><Badge tone={alignment?.status === "aligned" ? "success" : alignment?.status === "changed" ? "warning" : "neutral"}>{classification}</Badge>{analysis?.stale ? <Badge tone="warning">Analysis stale</Badge> : null}</div>
    <dl className="mt-5 grid grid-cols-2 gap-5"><ReviewFact term="Offer analysis" value={`Version ${offer.sourceAnalysis.version}`} /><ReviewFact term="Latest analysis" value={analysis ? `Version ${analysis.version}` : "Unavailable"} /><ReviewFact term="Analyzed" value={formatDate(offer.sourceAnalysis.analyzedAt)} /><ReviewFact term="Recommendation" value={analysis ? title(analysis.recommendation) : "Unavailable"} /></dl>
    <div className="mt-5 border-t border-stone-100 pt-5"><p className="eyebrow">Commercial drift</p>{alignment?.differences.length ? <ul className="mt-3 space-y-2">{alignment.differences.map((difference, index) => <li key={`${difference}-${index}`} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{difference}</li>)}</ul> : <p className="mt-3 text-sm text-stone-600">{alignment?.status === "aligned" ? "No projected commercial differences from the analysis basis." : "Projected performance metrics and policy thresholds are not available in this bounded review projection."}</p>}</div>
  </ReviewPanel>;
}

function ValidationChecklist({ checks }: { checks: readonly ReviewCheck[] }) {
  const categories = ["commercial", "investment", "workflow", "technical"] as const;
  return <ReviewPanel title="Validation" description="Preflight checks organized by responsibility. The server remains authoritative at submission.">
    <div className="grid gap-5 lg:grid-cols-2">{categories.map(category => <section key={category} aria-labelledby={`validation-${category}`} className="rounded-xl border border-stone-200 p-4"><h5 id={`validation-${category}`} className="text-sm font-semibold text-stone-950">{title(category)}</h5><ul className="mt-3 space-y-3">{checks.filter(check => check.category === category).map(check => <li key={check.id} className="flex gap-3"><ValidationIcon status={check.status} /><div><p className="text-sm font-medium text-stone-800">{check.label}</p><p className="mt-0.5 text-xs leading-5 text-stone-500">{check.explanation}</p>{check.resolution ? <p className="mt-1 text-xs font-medium text-stone-700">Resolution: {check.resolution}</p> : null}</div></li>)}</ul></section>)}</div>
  </ReviewPanel>;
}

function SubmissionReadinessCard({ blockers, warnings, unavailable, ready }: { blockers: readonly ReviewCheck[]; warnings: readonly ReviewCheck[]; unavailable: readonly ReviewCheck[]; ready: boolean }) {
  return <Card className={ready ? "border-emerald-300 bg-emerald-50 p-5 sm:p-6" : "border-amber-300 bg-amber-50 p-5 sm:p-6"}>
    <div className="flex gap-3">{ready ? <Check className="mt-0.5 h-6 w-6 text-emerald-700" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-6 w-6 text-amber-700" aria-hidden="true" />}<div><h4 className={ready ? "text-lg font-semibold text-emerald-950" : "text-lg font-semibold text-amber-950"}>{ready ? "Ready to submit" : unavailable.length ? "Submission unavailable" : "Not ready"}</h4><p className="mt-1 text-sm">{ready ? "All blocking projected checks have passed. The server will perform authoritative validation before submission." : `${blockers.length + unavailable.length} blocking issue${blockers.length + unavailable.length === 1 ? "" : "s"} remain.`}</p></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><IssueList heading="Blockers" items={[...blockers, ...unavailable]} empty="No blockers." /><IssueList heading="Warnings" items={warnings} empty="No warnings." /></div>
  </Card>;
}

export function SubmissionConfirmationDialog({ offer, confirmed, setConfirmed, pending, phase, onCancel, onSubmit }: {
  offer: AcquisitionOfferWorkspaceSummary;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  pending: boolean;
  phase: "idle" | "validating" | "submitting" | "refreshing";
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [onCancel]);
  const terms = offer.headlineTerms;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4" role="presentation">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="submit-offer-dialog-title" aria-describedby="submit-offer-dialog-description" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Final confirmation</p><h4 id="submit-offer-dialog-title" className="mt-2 text-2xl font-semibold text-stone-950">Submit offer #{offer.sequence}?</h4></div><button ref={cancelRef} type="button" onClick={onCancel} disabled={pending} aria-label="Close submission confirmation" className="rounded-md p-2 text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <p id="submit-offer-dialog-description" className="mt-4 text-sm leading-6 text-stone-600">You are about to submit {terms.route === "purchase" ? money(terms.offerPrice.amount) : `${money(terms.proposedMonthlyRent.amount)} per month`}. After successful submission, this offer becomes immutable and the acquisition enters the next negotiation phase.</p>
      <label className="mt-6 flex cursor-pointer gap-3 rounded-xl bg-stone-50 p-4"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="mt-1 h-4 w-4 accent-teal-700" /><span className="text-sm font-medium text-stone-800">I reviewed the commercial terms, investment alignment, blockers, and warnings and intend to submit this offer.</span></label>
      {pending ? <SubmissionProgress phase={phase} /> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={pending} className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-800 disabled:opacity-50">Return to review</button><button type="button" onClick={onSubmit} disabled={!confirmed || pending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"><Send className="h-4 w-4" aria-hidden="true" />{pending ? "Submitting offer…" : "Submit offer"}</button></div>
    </div>
  </div>;
}

function SubmissionProgress({ phase }: { phase: "idle" | "validating" | "submitting" | "refreshing" }) {
  const stages = ["validating", "submitting", "refreshing"] as const;
  const current = stages.indexOf(phase as typeof stages[number]);
  return <div role="status" className="mt-4 rounded-xl border border-stone-700 bg-stone-900 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{phase === "validating" ? "Validating offer…" : phase === "submitting" ? "Submitting offer…" : "Refreshing workspace…"}</div><ol className="mt-3 grid grid-cols-3 gap-2 text-xs">{stages.map((stage, index) => <li key={stage} className={index <= current ? "text-teal-300" : "text-stone-500"}>{index < current ? "✓ " : ""}{title(stage)}</li>)}</ol></div>;
}

export function buildOfferReviewChecks({ offer, analysis, alignment, action }: {
  offer: AcquisitionOfferWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
  alignment: AcquisitionAlignmentWorkspaceSummary | null;
  action: AcquisitionWorkspaceNextAction;
}): readonly ReviewCheck[] {
  const infrastructure = action.blockers.some(blocker => /DEPLOY|VERIF|DEPENDENCY|INFRASTRUCTURE/i.test(`${blocker.code} ${blocker.message}`));
  const actionBlockers: ReviewCheck[] = action.blockers.map((blocker, index) => ({
    id: `action-${blocker.code}-${index}`,
    category: infrastructure ? "technical" : "workflow",
    label: infrastructure ? "Submission infrastructure" : "Submission prerequisite",
    status: infrastructure ? "unavailable" : "blocked",
    explanation: blocker.message,
    resolution: infrastructure ? "Wait for the command boundary to become available." : "Resolve the projected workflow blocker and reload.",
  }));
  return [
    { id: "commercial-headline", category: "commercial", label: "Headline terms projected", status: "passed", explanation: "The current route-specific commercial summary is available." },
    { id: "commercial-expiration", category: "commercial", label: "Expiration projected", status: offer.expiresAt ? "passed" : "warning", explanation: offer.expiresAt ? `Offer expires ${formatDateTime(offer.expiresAt)}.` : "Expiration is not present in the headline projection.", ...(!offer.expiresAt ? { resolution: "Review expiration in the detailed offer workflow." } : {}) },
    { id: "investment-source", category: "investment", label: "Source analysis linked", status: offer.sourceAnalysis.analysisId ? "passed" : "blocked", explanation: offer.sourceAnalysis.analysisId ? `Offer is linked to analysis version ${offer.sourceAnalysis.version}.` : "The offer has no approved analysis reference.", ...(!offer.sourceAnalysis.analysisId ? { resolution: "Link a completed analysis before submission." } : {}) },
    { id: "investment-current", category: "investment", label: "Latest analysis available", status: analysis ? analysis.stale ? "warning" : "passed" : "warning", explanation: analysis ? analysis.stale ? "The latest analysis is stale." : "The latest completed analysis is current." : "The latest analysis projection is unavailable.", ...(!analysis || analysis.stale ? { resolution: "Review or rerun the investment analysis." } : {}) },
    { id: "investment-alignment", category: "investment", label: "Investment alignment", status: alignment?.status === "aligned" ? "passed" : "warning", explanation: alignment?.status === "aligned" ? "The offer is projected as aligned." : alignment?.status === "changed" ? "Commercial differences from the analysis basis require review." : "Alignment is unavailable in this projection.", ...(alignment?.status !== "aligned" ? { resolution: "Review the recorded drift before confirming submission." } : {}) },
    { id: "workflow-draft", category: "workflow", label: "Current draft exists", status: offer.status === "draft" && offer.current ? "passed" : "blocked", explanation: offer.status === "draft" && offer.current ? "The current offer is an active draft." : "Only the current draft can be submitted.", ...(offer.status !== "draft" || !offer.current ? { resolution: "Reload and select the current draft offer." } : {}) },
    { id: "workflow-editable", category: "workflow", label: "Offer remains editable", status: offer.editable ? "passed" : "blocked", explanation: offer.editable ? "The draft has not become immutable." : "This offer is no longer editable.", ...(!offer.editable ? { resolution: "Reload the workspace and review the current offer." } : {}) },
    { id: "technical-version", category: "technical", label: "Expected version transport", status: action.command?.expectedPipelineVersion ? "passed" : "blocked", explanation: action.command?.expectedPipelineVersion ? `Pipeline version ${action.command.expectedPipelineVersion} will be validated by the server.` : "The projected command does not contain a pipeline version.", ...(!action.command?.expectedPipelineVersion ? { resolution: "Reload the canonical workspace." } : {}) },
    { id: "technical-command", category: "technical", label: "Submit command projected", status: action.command?.commandType === "submit-offer" ? "passed" : "blocked", explanation: action.command?.commandType === "submit-offer" ? "The next-action projection authorizes the submit workflow." : "Submission is not the projected next action.", ...(action.command?.commandType !== "submit-offer" ? { resolution: "Follow the current projected next action." } : {}) },
    ...actionBlockers,
  ];
}

function ReviewPanel({ title: heading, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const id = `offer-review-${heading.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="mb-5"><h4 id={id} className="text-lg font-semibold text-stone-950">{heading}</h4><p className="mt-1 text-sm text-stone-500">{description}</p></div>{children}</Card></section>;
}
function ReviewFact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm font-semibold text-stone-800">{value}</dd></div>; }
function ValidationIcon({ status }: { status: ReviewCheck["status"] }) { return status === "passed" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-label="Passed" /> : <AlertTriangle className={status === "warning" ? "mt-0.5 h-4 w-4 shrink-0 text-amber-700" : "mt-0.5 h-4 w-4 shrink-0 text-rose-700"} aria-label={status === "warning" ? "Warning" : "Action required"} />; }
function IssueList({ heading, items, empty }: { heading: string; items: readonly ReviewCheck[]; empty: string }) { return <div><h5 className="text-sm font-semibold">{heading}</h5>{items.length ? <ul className="mt-2 space-y-2">{items.map(item => <li key={item.id} className="rounded-lg bg-white/70 p-3"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs">{item.explanation}</p>{item.resolution ? <p className="mt-1 text-xs font-semibold">Resolution: {item.resolution}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm">{empty}</p>}</div>; }
function CommandIssue({ title: heading, message }: { title: string; message: string }) { return <div role="alert" className="mt-4 rounded-xl bg-rose-950 p-4 text-sm text-rose-100"><strong>{heading}.</strong> {message}</div>; }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

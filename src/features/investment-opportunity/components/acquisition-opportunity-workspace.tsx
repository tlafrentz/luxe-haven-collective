import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Circle, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionActivityWorkspaceSummary,
  AcquisitionCommercialWorkspaceSummary,
  AcquisitionLifecycleWorkspaceSummary,
  AcquisitionOfferHeadlineTerms,
  AcquisitionPipelineTerminalWorkspaceSummary,
  AcquisitionPipelineWorkspaceSummary,
  AcquisitionRequirementsWorkspaceSummary,
  AcquisitionWorkspace,
  AcquisitionWorkspaceCapabilities,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";

export function AcquisitionOpportunityWorkspace({ workspace }: { workspace: AcquisitionWorkspace }) {
  const acquisition = workspace.status === "pipeline-active" || workspace.status === "pipeline-terminal" ? workspace.acquisition : null;
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <WorkspaceBreadcrumb opportunityName={workspace.opportunity.name} />
    <OpportunityWorkspaceHeader opportunity={workspace.opportunity} acquisition={acquisition} />
    <section aria-label="Opportunity and decision context" className="grid gap-5 lg:grid-cols-2">
      <OpportunitySummaryCard opportunity={workspace.opportunity} />
      <DecisionContextCard analysis={workspace.analysis} opportunityId={workspace.opportunity.id} />
    </section>
    {workspace.status === "opportunity-only" ? <OpportunityOnlyState workspace={workspace} /> : null}
    {workspace.status === "acquisition-unavailable" ? <WorkspaceUnavailableCard message={workspace.reason.message} /> : null}
    {workspace.status === "pipeline-active" || workspace.status === "pipeline-terminal" ? <>
      {workspace.status === "pipeline-terminal" ? <TerminalOutcomeCard acquisition={workspace.acquisition} /> : null}
      <LifecycleTimeline lifecycle={workspace.acquisition.lifecycle} />
      <section aria-label="Commercial and acquisition requirements" className="grid gap-5 xl:grid-cols-2">
        <CommercialSummaryCard commercial={workspace.acquisition.commercial} />
        <RequirementsSummaryCard requirements={workspace.acquisition.requirements} />
      </section>
      <ClosingReadinessCard readiness={workspace.acquisition.readiness} />
      <RecentActivityCard activity={workspace.acquisition.activity} />
      <NextActionsCard actions={workspace.nextActions} capabilities={workspace.capabilities} />
    </> : null}
  </main>;
}

function WorkspaceBreadcrumb({ opportunityName }: { opportunityName: string }) {
  return <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
    <li><Link className="rounded-sm hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href="/dashboard">Home</Link></li><li aria-hidden="true">/</li>
    <li><Link className="rounded-sm hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href="/dashboard/investments">Investment Intelligence</Link></li><li aria-hidden="true">/</li>
    <li><Link className="rounded-sm hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href="/dashboard/investments/opportunities">Opportunity Portfolio</Link></li><li aria-hidden="true">/</li>
    <li aria-current="page" className="max-w-52 truncate font-medium text-stone-800">{opportunityName}</li>
  </ol></nav>;
}

export function OpportunityWorkspaceHeader({ opportunity, acquisition }: { opportunity: InvestmentOpportunityWorkspaceSummary; acquisition: AcquisitionPipelineWorkspaceSummary | AcquisitionPipelineTerminalWorkspaceSummary | null }) {
  return <header className="border-b border-stone-200 pb-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone="dark">{label(opportunity.status)}</Badge><Badge>{routeLabel(opportunity.route)}</Badge>{acquisition ? <Badge tone={acquisition.terminal ? "neutral" : "success"}>{acquisition.stageLabel}</Badge> : null}{opportunity.archived ? <Badge tone="warning">Archived</Badge> : null}</div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Investment opportunity</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-950 sm:text-5xl">{opportunity.name}</h1>
        <p className="mt-3 text-base text-stone-600">{opportunity.location.display}</p>
      </div>
      <div className="text-left lg:text-right"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Last updated</p><time dateTime={opportunity.updatedAt.toISOString()} className="mt-1 block text-sm font-medium text-stone-700">{dateTime(opportunity.updatedAt)}</time></div>
    </div>
  </header>;
}

export function OpportunitySummaryCard({ opportunity }: { opportunity: InvestmentOpportunityWorkspaceSummary }) {
  return <SectionCard title="Opportunity summary" description="The current identity and portfolio state for this opportunity.">
    <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
      <Fact term="Route" value={routeLabel(opportunity.route)} /><Fact term="Status" value={label(opportunity.status)} /><Fact term="Created" value={date(opportunity.createdAt)} />
      {opportunity.headlineValue ? <Fact term={headlineLabel(opportunity.headlineValue.type)} value={currency(opportunity.headlineValue.amount.amount)} /> : null}
      <div className="col-span-2 sm:col-span-3"><dt className="eyebrow">Tags</dt><dd className="mt-2 flex flex-wrap gap-2">{opportunity.tags.length ? opportunity.tags.map(tag => <Badge key={tag}>{tag}</Badge>) : <span className="text-sm text-stone-500">No tags added.</span>}</dd></div>
    </dl>
  </SectionCard>;
}

export function DecisionContextCard({ analysis, opportunityId }: { analysis: InvestmentAnalysisWorkspaceSummary | null; opportunityId: string }) {
  return <SectionCard title="Decision context" description="The latest completed analysis informing this opportunity.">
    {analysis ? <><div className="flex flex-wrap items-center gap-2"><Badge tone={recommendationTone(analysis.recommendation)}>{label(analysis.recommendation)}</Badge>{analysis.stale ? <Badge tone="warning">Analysis stale</Badge> : <Badge tone="success">Analysis {analysis.age.classification}</Badge>}</div>
      <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3"><Fact term="Score" value={analysis.score === undefined ? "Not scored" : String(analysis.score)} /><Fact term="Confidence" value={analysis.confidence ? label(analysis.confidence.level) : "Not available"} /><Fact term="Analysis age" value={`${analysis.age.days} day${analysis.age.days === 1 ? "" : "s"}`} /></dl>
      <Link href={analysis.historicalAnalysisHref} className="mt-6 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-stone-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">View historical analysis <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </> : <div className="rounded-xl bg-stone-50 p-5"><p className="font-medium text-stone-800">No completed analysis</p><p className="mt-1 text-sm text-stone-600">Run an investment analysis to establish decision context.</p><Link href={`/dashboard/investments/new?opportunity=${opportunityId}&mode=reanalyze`} className="mt-4 inline-flex text-sm font-semibold text-stone-950 underline">Analyze opportunity</Link></div>}
  </SectionCard>;
}

function OpportunityOnlyState({ workspace }: { workspace: Extract<AcquisitionWorkspace, { status: "opportunity-only" }> }) {
  return <section aria-labelledby="acquisition-start-heading"><Card className="border-dashed p-6 sm:p-8"><div className="max-w-2xl"><p className="eyebrow">Acquisition lifecycle</p><h2 id="acquisition-start-heading" className="mt-2 text-2xl font-semibold text-stone-950">No acquisition pursuit yet</h2><p className="mt-2 text-sm leading-6 text-stone-600">This opportunity remains available for evaluation. The acquisition timeline begins after an eligible analysis is selected and pursuit is activated.</p>
    <div className="mt-5 rounded-xl bg-stone-50 p-4"><p className="text-sm font-semibold text-stone-800">{workspace.activation.eligible ? "Ready for activation" : "Activation unavailable"}</p><ul className="mt-2 space-y-1 text-sm text-stone-600">{workspace.activation.blockers.map(blocker => <li key={blocker.code}>• {blocker.message}</li>)}{workspace.activation.limitations.map(limitation => <li key={limitation.code}>• {limitation.operatorMessage}</li>)}</ul></div>
  </div></Card></section>;
}

export function LifecycleTimeline({ lifecycle }: { lifecycle: AcquisitionLifecycleWorkspaceSummary }) {
  return <SectionCard title="Acquisition lifecycle" description="Canonical progress and recent stage history.">
    <ol aria-label="Acquisition lifecycle stages" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {lifecycle.stages.map(stage => <li key={stage.stage} aria-current={stage.state === "current" ? "step" : undefined} className={["rounded-xl border p-4", stage.state === "current" ? "border-teal-700 bg-teal-50" : stage.state === "completed" ? "border-emerald-200 bg-emerald-50/60" : stage.state === "exited" ? "border-rose-200 bg-rose-50" : "border-stone-200 bg-stone-50"].join(" ")}>
        <div className="flex items-center gap-2">{stage.state === "completed" ? <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" /> : stage.state === "current" ? <span className="h-3 w-3 rounded-full bg-teal-700" aria-hidden="true" /> : <Circle className="h-4 w-4 text-stone-400" aria-hidden="true" />}<span className="sr-only">{label(stage.state)}: </span><span className="text-sm font-semibold text-stone-900">{stage.label}</span></div>
        {stage.completedAt ? <time dateTime={stage.completedAt.toISOString()} className="mt-2 block text-xs text-stone-500">{date(stage.completedAt)}</time> : null}
      </li>)}
    </ol>
    {lifecycle.recentHistory.length ? <div className="mt-6 border-t border-stone-100 pt-5"><h3 className="text-sm font-semibold text-stone-900">Recent stage history</h3><ul className="mt-3 space-y-2">{lifecycle.recentHistory.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 text-sm text-stone-600"><span>{item.from ? `${label(item.from)} → ` : ""}{label(item.to)}</span><time dateTime={item.occurredAt.toISOString()}>{dateTime(item.occurredAt)}</time></li>)}</ul></div> : null}
  </SectionCard>;
}

export function CommercialSummaryCard({ commercial }: { commercial: AcquisitionCommercialWorkspaceSummary }) {
  return <SectionCard title="Commercial" description="Current commercial position without full term history.">
    <div className="space-y-4">
      <SummaryRow label="Current offer" value={commercial.currentOffer ? `Offer ${commercial.currentOffer.sequence} · ${label(commercial.currentOffer.status)}` : "No current offer"} />
      {commercial.currentOffer ? <SummaryRow label="Headline terms" value={offerHeadline(commercial.currentOffer.headlineTerms)} /> : null}
      <SummaryRow label="Latest response" value={commercial.latestResponse ? label(commercial.latestResponse.type) : "No counterparty response"} />
      <SummaryRow label="Accepted agreement" value={commercial.acceptedAgreement ? `${label(commercial.acceptedAgreement.source)} basis recorded` : "No accepted agreement"} />
      <SummaryRow label="Contract" value={commercial.contract ? `${label(commercial.contract.source)} · effective ${date(commercial.contract.effectiveDate)}` : "No contract recorded"} />
      {commercial.priorOfferTotalCount ? <p className="text-xs text-stone-500">{commercial.priorOfferTotalCount} prior offer{commercial.priorOfferTotalCount === 1 ? "" : "s"} retained; {commercial.priorOffers.length} shown in this summary.</p> : null}
    </div>
  </SectionCard>;
}

export function RequirementsSummaryCard({ requirements }: { requirements: AcquisitionRequirementsWorkspaceSummary }) {
  return <SectionCard title="Requirements" description="Blocking and priority acquisition requirements.">
    {!requirements.initialized ? <EmptyMessage title="Requirements have not yet been initialized." body="Requirements will appear after the applicable acquisition policy is initialized." /> : <>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Fact term="Contingencies" value={String(requirements.totals.contingencies)} /><Fact term="Due diligence" value={String(requirements.totals.dueDiligence)} /><Fact term="Failed" value={String(requirements.failedCount)} /><Fact term="Waived" value={String(requirements.waivedCount)} /></dl>
      <RequirementList title="Blocking now" items={requirements.blocking} />
      <RequirementList title="High priority" items={requirements.highPriority} />
      <RequirementList title="Recently resolved" items={requirements.recentlyResolved} />
    </>}
  </SectionCard>;
}

function RequirementList({ title, items }: { title: string; items: AcquisitionRequirementsWorkspaceSummary["blocking"] }) {
  if (!items.length) return null;
  return <div className="mt-5 border-t border-stone-100 pt-4"><h3 className="text-sm font-semibold text-stone-900">{title}</h3><ul className="mt-3 space-y-2">{items.map(item => <li key={item.id} className="rounded-xl bg-stone-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-stone-800">{item.title}</span><Badge tone={item.status === "failed" ? "danger" : item.blocking ? "warning" : "neutral"}>{label(item.status)}</Badge></div><p className="mt-1 text-xs text-stone-500">{label(item.priority)} priority{item.overdue ? " · Overdue" : ""} · {item.linkedActionCount} actions · {item.evidenceCount} evidence · {item.documentCount} documents</p></li>)}</ul></div>;
}

export function ClosingReadinessCard({ readiness }: { readiness: AcquisitionPipelineWorkspaceSummary["readiness"] }) {
  return <SectionCard title="Closing readiness" description="Current readiness derived at a specific pipeline version.">
    {!readiness ? <EmptyMessage title="Readiness has not been evaluated." body="Closing readiness becomes available when the acquisition reaches the applicable stage." /> : <>
      <div className="flex flex-wrap items-center gap-3"><Badge tone={readiness.status === "ready" ? "success" : readiness.status === "conditionally-ready" ? "warning" : "danger"}>{label(readiness.status)}</Badge>{!readiness.current ? <span role="status" className="text-sm font-semibold text-amber-700">Readiness requires reevaluation.</span> : <span className="text-sm text-stone-500">Current at pipeline version {readiness.evaluatedPipelineVersion}</span>}</div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><IssueList title={`Blockers (${readiness.blockerTotalCount})`} items={readiness.blockers} empty="No closing blockers." /><IssueList title={`Warnings (${readiness.warningTotalCount})`} items={readiness.warnings} empty="No closing warnings." /></div>
    </>}
  </SectionCard>;
}

function IssueList({ title, items, empty }: { title: string; items: readonly Readonly<{ code: string; title: string; explanation: string }>[]; empty: string }) {
  return <div><h3 className="text-sm font-semibold text-stone-900">{title}</h3>{items.length ? <ul className="mt-3 space-y-2">{items.map((item, index) => <li key={`${item.code}-${index}`} className="rounded-xl bg-stone-50 p-3"><p className="text-sm font-medium text-stone-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-stone-600">{item.explanation}</p></li>)}</ul> : <p className="mt-3 text-sm text-stone-500">{empty}</p>}</div>;
}

export function RecentActivityCard({ activity }: { activity: AcquisitionActivityWorkspaceSummary }) {
  return <SectionCard title="Recent activity" description="A bounded view of acquisition activity, newest first.">
    {activity.items.length ? <ol className="divide-y divide-stone-100">{activity.items.map(item => <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-stone-900" aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-stone-900">{item.summary}</p><time dateTime={item.occurredAt.toISOString()} className="text-xs text-stone-500">{dateTime(item.occurredAt)}</time></div><p className="mt-1 text-xs text-stone-500">Actor {item.actor.id}</p></div></li>)}</ol> : <EmptyMessage title="No acquisition activity yet." body="Lifecycle and commercial events will appear here." />}
    {activity.truncated ? <p className="mt-5 border-t border-stone-100 pt-4 text-sm text-stone-500">Showing {activity.items.length} of {activity.totalCount} activity entries. Full activity is deferred.</p> : null}
  </SectionCard>;
}

export function NextActionsCard({ actions, capabilities }: { actions: readonly AcquisitionWorkspaceNextAction[]; capabilities: AcquisitionWorkspaceCapabilities }) {
  return <SectionCard title="Next actions" description="Actions are supplied by the workspace projection and remain capability gated.">
    <div className="grid gap-3 lg:grid-cols-2">{actions.length ? actions.map(action => <ActionItem key={action.id} action={action} />) : <EmptyMessage title="No acquisition actions available." body="This workspace has no next action in its current state." />}</div>
    {capabilities.read.status !== "available" ? <p className="mt-4 text-sm text-amber-700">Workspace command capability is limited.</p> : null}
  </SectionCard>;
}

function ActionItem({ action }: { action: AcquisitionWorkspaceNextAction }) {
  const content = <><span className="font-semibold">{action.label}</span><span className="mt-1 block text-sm opacity-75">{action.description}</span>{action.blockers.length ? <span className="mt-2 block text-xs">{action.blockers.map(blocker => blocker.message).join(" ")}</span> : null}</>;
  if (action.enabled && action.href) return <Link href={action.href} className="rounded-xl bg-stone-950 p-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">{content}</Link>;
  return <div aria-disabled={!action.enabled || Boolean(action.command)} className={["rounded-xl border p-4", action.enabled && !action.command ? "border-stone-300 bg-white text-stone-900" : "border-stone-200 bg-stone-50 text-stone-500"].join(" ")}>{content}{action.command ? <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Command controls are deferred</span> : null}</div>;
}

export function WorkspaceUnavailableCard({ message }: { message: string }) {
  return <section aria-labelledby="acquisition-unavailable-heading"><Card className="border-amber-200 bg-amber-50 p-6"><div className="flex gap-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" /><div><h2 id="acquisition-unavailable-heading" className="font-semibold text-amber-950">Acquisition state unavailable</h2><p className="mt-1 text-sm text-amber-900">{message} The opportunity and analysis remain available.</p></div></div></Card></section>;
}

function TerminalOutcomeCard({ acquisition }: { acquisition: AcquisitionPipelineTerminalWorkspaceSummary }) {
  const outcome = acquisition.outcome;
  return <section aria-labelledby="terminal-outcome-heading"><Card className="bg-stone-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Terminal outcome</p><h2 id="terminal-outcome-heading" className="mt-2 text-2xl font-semibold">{outcome.type === "acquired" ? "Opportunity acquired" : "Acquisition pursuit exited"}</h2><p className="mt-2 text-sm text-stone-300">{outcome.type === "acquired" ? `Closed ${date(outcome.closedAt)}.` : `${label(outcome.reason)} · exited ${date(outcome.exitedAt)}${outcome.reconsiderationEligible ? " · eligible for reconsideration" : ""}.`}</p></Card></section>;
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replaceAll(" ", "-")}`;
  return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="mb-5"><h2 id={id} className="text-lg font-semibold text-stone-950">{title}</h2><p className="mt-1 text-sm text-stone-500">{description}</p></div>{children}</Card></section>;
}
function EmptyMessage({ title, body }: { title: string; body: string }) { return <div className="rounded-xl bg-stone-50 p-5"><p className="text-sm font-semibold text-stone-800">{title}</p><p className="mt-1 text-sm leading-6 text-stone-600">{body}</p></div>; }
function Fact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm font-semibold text-stone-800">{value}</dd></div>; }
function SummaryRow({ label: term, value }: { label: string; value: string }) { return <div className="flex flex-col justify-between gap-1 border-b border-stone-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"><span className="text-sm text-stone-500">{term}</span><span className="text-sm font-semibold text-stone-800 sm:text-right">{value}</span></div>; }
function routeLabel(route: string) { return route === "purchase" ? "Purchase" : "Rental Arbitrage"; }
function label(value: string) { return value.split("-").map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function headlineLabel(type: string) { return type === "monthly-rent" ? "Monthly rent" : type === "purchase-price" ? "Purchase price" : "Target value"; }
function recommendationTone(value: string): "success" | "warning" | "danger" { return value === "pass" ? "danger" : value === "wait" || value === "buy-with-conditions" ? "warning" : "success"; }
function date(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function dateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function offerHeadline(terms: AcquisitionOfferHeadlineTerms) {
  return terms.route === "purchase" ? `${currency(terms.offerPrice.amount)} · ${label(terms.financingType)}` : `${currency(terms.proposedMonthlyRent.amount)}/month · ${terms.leaseTermMonths} months`;
}

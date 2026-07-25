import Link from "next/link";
import type {
  PortfolioDecisionWorkspace, PortfolioDecisionCandidate, StrategicAlternative,
} from "../application/decisions";

export function PortfolioDecisionsView({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  return <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
    <Header workspace={workspace} />
    {workspace.state === "permission-limited"
      ? <Notice title="Review access only">You may review this portfolio decision, but only workspace owners can approve capital allocation. Restricted financial fields are omitted.</Notice> : null}
    {workspace.state === "insufficient-evidence"
      ? <Notice title="No decision-ready findings">Current findings require more evidence or continued monitoring before approval.</Notice> : null}
    {workspace.state === "degraded"
      ? <Notice title="Decision evidence may be outdated">Review current property data before approval. Stale evidence can block approval.</Notice> : null}
    <CandidateSection candidates={workspace.candidates} canApprove={workspace.canApprove} />
    <DecisionPipeline />
    <CapitalSummary workspace={workspace} />
    <Conflicts workspace={workspace} />
    <ActiveDecisions workspace={workspace} />
    <ReviewCalendar workspace={workspace} />
    <RecentActivity workspace={workspace} />
  </main>;
}

function Header({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  const { summary } = workspace;
  return <header className="rounded-[2rem] bg-[#101416] p-6 text-white sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Decide → Execute · Portfolio Intelligence</p>
    <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div><h1 className="text-3xl font-semibold sm:text-4xl">Capital Allocation &amp; Strategic Decisions</h1>
        <p className="mt-3 max-w-3xl text-stone-300">Compare expected alternatives, approve an explicit strategic choice, and hand editable work to Action Center.</p>
      </div>
      <dl className="grid grid-cols-2 gap-5 text-sm sm:grid-cols-4">
        <Fact label="Ready for review" value={String(summary.recommendationsReady)} />
        <Fact label="Active decisions" value={String(summary.activeDecisions)} />
        <Fact label="Proposed capital" value={money(summary.proposedCapital)} />
        <Fact label="Reviews due" value={String(summary.reviewsDue)} />
      </dl>
    </div>
    <p className="mt-6 border-t border-white/10 pt-5 text-xs text-stone-400">Expected impact is projected, not measured or guaranteed. Human approval is mandatory; approval does not move funds.</p>
  </header>;
}

function CandidateSection({ candidates, canApprove }: Readonly<{ candidates: readonly PortfolioDecisionCandidate[]; canApprove: boolean }>) {
  return <section aria-labelledby="candidates-heading"><Heading id="candidates-heading" title="Capital allocation candidates" description="Candidates remain separate from recommendations, formal decisions, execution actions, and measured outcomes." />
    {candidates.length ? <div className="mt-5 grid gap-5 lg:grid-cols-2">{candidates.map((candidate) =>
      <article key={candidate.id} className="rounded-[2rem] border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap gap-2"><Pill>{title(candidate.status)}</Pill><Pill>{title(candidate.recommendationStrength)}</Pill><Pill>{title(candidate.category)}</Pill></div>
        <h3 className="mt-4 text-xl font-semibold">{candidate.title}</h3><p className="mt-2 text-sm leading-6 text-stone-700">{candidate.description}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4"><Fact label="Required resources" value={`${candidate.requestedResources.length} types`} /><Fact label="Expected impact" value={impact(candidate)} /><Fact label="Effort" value={title(candidate.effort)} /><Fact label="Horizon" value={title(candidate.horizon)} /><Fact label="Confidence" value={title(candidate.confidence)} /><Fact label="Expires" value={date(candidate.expiresAt)} /></dl>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">Why this order</p>
        <p className="mt-1 text-xs leading-5 text-stone-600">{candidate.ordering.rationale.join(" ")}</p>
        <ScenarioComparison candidate={candidate} />
        <div className="mt-5 flex flex-wrap gap-3"><Link href={`/dashboard/portfolio/decisions/${encodeURIComponent(candidate.id)}`} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">Review alternatives</Link>
          <span className="self-center text-xs text-stone-500">{canApprove ? "Owner approval available after review." : "Approval authority required."}</span></div>
      </article>)}</div> : <Empty>No portfolio recommendations are ready for review.</Empty>}
  </section>;
}

function ScenarioComparison({ candidate }: Readonly<{ candidate: PortfolioDecisionCandidate }>) {
  return <div className="mt-6 overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left text-xs">
    <caption className="mb-2 text-left font-semibold text-stone-700">Scenario comparison — all impacts are expected</caption>
    <thead><tr><th scope="col" className="border-b py-2 pr-4">Dimension</th>{candidate.alternatives.map((item) => <th scope="col" className="border-b px-3 py-2" key={item.id}>{item.label}{item.id === candidate.recommendedAlternativeId ? " — recommended" : ""}</th>)}</tr></thead>
    <tbody><Row label="Resources" alternatives={candidate.alternatives} render={(item) => item.requiredResources.length ? `${item.requiredResources.length} types` : "None"} />
      <Row label="Expected impact" alternatives={candidate.alternatives} render={(item) => expected(item)} />
      <Row label="Confidence" alternatives={candidate.alternatives} render={(item) => title(item.confidence)} />
      <Row label="Reversibility" alternatives={candidate.alternatives} render={(item) => title(item.reversibility)} />
      <Row label="Tradeoffs" alternatives={candidate.alternatives} render={(item) => item.tradeoffs.join(" ")} /></tbody>
  </table></div>;
}
function Row({ label, alternatives, render }: Readonly<{ label: string; alternatives: readonly StrategicAlternative[]; render: (item: StrategicAlternative) => string }>) {
  return <tr><th scope="row" className="border-b py-3 pr-4 align-top">{label}</th>{alternatives.map((item) => <td key={item.id} className="border-b px-3 py-3 align-top text-stone-600">{render(item)}</td>)}</tr>;
}
function DecisionPipeline() {
  return <section aria-labelledby="pipeline-heading"><Heading id="pipeline-heading" title="Decision pipeline" description="Risk or Opportunity → Candidate → Recommendation → Canonical Platform Decision → Editable Action Center plan → Measurement plan." />
    <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{["Finding", "Candidate", "Recommendation", "Decision", "Execution plan", "Expected outcome"].map((item, index) => <li key={item} className="rounded-2xl border border-stone-200 bg-white p-4"><span className="text-xs text-stone-500">Step {index + 1}</span><p className="mt-1 font-semibold">{item}</p></li>)}</ol>
    <p className="mt-3 text-xs text-stone-500">Approved capital is not committed or spent capital. Action status never silently changes the approved decision.</p>
  </section>;
}
function CapitalSummary({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  return <section aria-labelledby="capital-heading"><Heading id="capital-heading" title="Capital allocation summary" description="Proposed, approved, committed, and spent capital remain distinct." />
    <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Proposed" value={money(workspace.summary.proposedCapital)} /><Summary label="Approved" value={money(workspace.summary.approvedCapital)} /><Summary label="Committed" value="Unavailable in PI-001F" /><Summary label="Spent" value="Future financial integration" /></dl>
  </section>;
}
function Conflicts({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  return <section aria-labelledby="conflicts-heading"><Heading id="conflicts-heading" title="Capital and resource conflicts" description="Competing proposals are disclosed before approval, without an opaque score." />
    {workspace.conflicts.length ? <ul className="mt-5 grid gap-3 md:grid-cols-2">{workspace.conflicts.map((item) => <li key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><Pill>{title(item.type)} conflict</Pill><p className="mt-3 text-sm">{item.description}</p><p className="mt-2 text-xs text-stone-600">{item.candidateIds.length} affected candidates · {item.blocking ? "Approval blocking" : "Review required"}</p></li>)}</ul> : <Empty>No material capital or resource conflicts detected.</Empty>}
  </section>;
}
function ActiveDecisions({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  const active = workspace.decisions.filter(({ status }) => ["under-review", "approved", "deferred"].includes(status));
  return <section aria-labelledby="active-heading"><Heading id="active-heading" title="Active decisions" description="Approved choices preserve reviewed alternatives, evidence version, resources, rationale, and decision-maker." />
    {active.length ? <ul className="mt-5 grid gap-4 md:grid-cols-2">{active.map((decision) => <li className="rounded-2xl border border-stone-200 bg-white p-5" key={decision.decisionId}><Pill>{title(decision.status)}</Pill><h3 className="mt-3 font-semibold">{decision.question}</h3><p className="mt-2 text-sm text-stone-600">{decision.rationale}</p><p className="mt-3 text-xs text-stone-500">Revision {decision.revision} · Evidence {decision.evidenceVersion}</p></li>)}</ul> : <Empty>No active portfolio decisions. Approved portfolio strategies and capital plans will appear here.</Empty>}
  </section>;
}
function ReviewCalendar({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  const scheduled = workspace.decisions.filter(({ reviewAt }) => reviewAt);
  return <section aria-labelledby="review-heading"><Heading id="review-heading" title="Review calendar" description="Review timing follows the expected measurement window." />
    {scheduled.length ? <ul className="mt-5">{scheduled.map((item) => <li key={item.decisionId}>{date(item.reviewAt!)} · {item.question}</li>)}</ul> : <Empty>No portfolio decision reviews are scheduled.</Empty>}
  </section>;
}
function RecentActivity({ workspace }: Readonly<{ workspace: PortfolioDecisionWorkspace }>) {
  const activity = workspace.decisions.flatMap(({ activity }) => activity).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);
  return <section aria-labelledby="activity-heading"><Heading id="activity-heading" title="Recent decision activity" description="Safe audit summaries omit raw financial evidence and sensitive rationale." />
    {activity.length ? <ol className="mt-5 space-y-3">{activity.map((item) => <li key={item.id} className="rounded-xl bg-white p-4"><strong>{title(item.operation)}</strong><p className="text-sm text-stone-600">{item.safeSummary}</p><time className="text-xs text-stone-500">{date(item.occurredAt)}</time></li>)}</ol> : <Empty>No portfolio decision activity.</Empty>}
  </section>;
}
export function PortfolioDecisionsError({ message = "Portfolio decisions could not be loaded. No recommendation, decision, or action was changed." }: Readonly<{ message?: string }>) {
  return <main className="mx-auto max-w-3xl px-4 py-16"><section role="alert" tabIndex={-1} className="rounded-[2rem] border border-rose-200 bg-white p-8"><h1 className="text-3xl font-semibold">Portfolio decisions are unavailable</h1><p className="mt-3 text-sm text-stone-600">{message}</p></section></main>;
}
export function PortfolioDecisionsSkeleton() {
  return <main aria-hidden="true" className="mx-auto max-w-[1500px] animate-pulse space-y-7 px-4 py-8"><span className="sr-only">Loading portfolio decisions</span><div className="h-64 rounded-[2rem] bg-stone-200" /><div className="grid gap-5 lg:grid-cols-2"><div className="h-96 rounded-[2rem] bg-stone-200" /><div className="h-96 rounded-[2rem] bg-stone-200" /></div></main>;
}
function Summary({ label, value }: Readonly<{ label: string; value: string }>) { return <div className="rounded-2xl border border-stone-200 bg-white p-5"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-2 text-lg font-semibold">{value}</dd></div>; }
function Heading({ id, title: heading, description }: Readonly<{ id: string; title: string; description: string }>) { return <div><h2 id={id} className="text-2xl font-semibold">{heading}</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-stone-600">{description}</p></div>; }
function Fact({ label, value }: Readonly<{ label: string; value: string }>) { return <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
function Notice({ title: heading, children }: Readonly<{ title: string; children: React.ReactNode }>) { return <aside role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>{heading}.</strong> {children}</aside>; }
function Pill({ children }: Readonly<{ children: React.ReactNode }>) { return <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold">{children}</span>; }
function Empty({ children }: Readonly<{ children: React.ReactNode }>) { return <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{children}</p>; }
function title(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function date(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function money(value: Readonly<{ amount: number; currency: string }> | null) { return value ? new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amount) : "Not quantified"; }
function expected(alternative: StrategicAlternative) {
  const value = alternative.expectedImpact.dimensions[0]?.value;
  return !value ? "Unavailable" : value.type === "directional" ? `Expected to ${value.direction}`
    : value.type === "point" ? `Estimated ${value.value} ${value.unit}`
      : value.type === "range" ? `Estimated ${value.minimum}–${value.maximum} ${value.unit}` : value.reason;
}
function impact(candidate: PortfolioDecisionCandidate) { return candidate.expectedImpact.dimensions.map(({ dimension }) => title(dimension)).join(", "); }

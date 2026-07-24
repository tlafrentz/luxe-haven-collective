import type { ContinuousImprovementWorkspace as Workspace, ContinuousImprovementWorkspaceState, LearningWorkspaceLearningItem, LearningWorkspaceMeasurementReadiness, LearningWorkspaceOutcomeItem, LearningWorkspaceRecommendationItem } from "../application";

const classificationLabels: Readonly<Record<string, string>> = Object.freeze({
  successful: "Successful", "partially-successful": "Partially successful", unsuccessful: "Unsuccessful", harmful: "Harmful", inconclusive: "Inconclusive",
});
const maturityLabels: Readonly<Record<string, string>> = Object.freeze({
  candidate: "Candidate learning", emerging: "Emerging learning", supported: "Supported learning", validated: "Validated learning", contested: "Contested learning", invalidated: "Invalidated learning",
});
const sectionLinks = [["overview", "Overview"], ["outcomes", "Outcomes"], ["recommendations", "Recommendations"], ["learnings", "Learnings"], ["measurement", "Measurement quality"]] as const;

export function ContinuousImprovementWorkspaceView({ state }: { state: ContinuousImprovementWorkspaceState }) {
  if (state.status === "no-outcomes" || state.status === "measurement-in-progress") return <EarlyState state={state} />;
  const workspace = state.workspace;
  return <div className="mx-auto w-full max-w-[1500px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
    <WorkspaceHeader workspace={workspace} />
    <nav aria-label="Learning workspace sections" className="flex gap-2 overflow-x-auto pb-1">
      {sectionLinks.map(([href, label]) => <a key={href} href={`#${href}`} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 outline-none hover:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-600">{label}</a>)}
    </nav>
    {state.status === "degraded" ? <Notice tone="warning" title="Some Learning Intelligence sources are unavailable">Available evidence is shown below. Unavailable sections are labeled and no conclusions have been fabricated.</Notice> : null}
    {state.status === "insufficient-evidence" ? <Notice tone="info" title="Early evidence is available">{state.gaps.join(" ")}</Notice> : null}
    {workspace.freshness.status === "stale" ? <Notice tone="warning" title="Learning Intelligence needs reevaluation">{workspace.freshness.reasons.join(" ")}</Notice> : null}
    <section id="overview" aria-labelledby="learning-summary-heading" className="scroll-mt-24 space-y-4">
      <SectionHeading id="learning-summary-heading" eyebrow="Portfolio signal" title="Learning executive summary" description="Authoritative conclusions from measured Outcomes and Learning Intelligence assessments." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Decision outcomes" value={workspace.executiveSummary.decisionOutcomeStatus} />
        <MetricCard label="Recommendation effectiveness" value={label(workspace.executiveSummary.recommendationStatus)} />
        <MetricCard label="Strongest learning" value={workspace.executiveSummary.strongestLearning?.statement ?? "Not established"} />
        <MetricCard label="Largest recurring miss" value={workspace.executiveSummary.largestRecurringMiss?.statement ?? "Not established"} />
        <MetricCard label="Measurement readiness" value={readinessLabel(workspace.executiveSummary.measurementReadiness)} />
      </div>
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <Attention workspace={workspace} />
      <Changes workspace={workspace} />
    </div>
    <section id="outcomes" aria-labelledby="outcomes-heading" className="scroll-mt-24 space-y-4">
      <SectionHeading id="outcomes-heading" eyebrow="Decision evidence" title="Decision Outcomes" description={`${workspace.outcomes.completedCount} completed assessments in the selected observation window. Inconclusive Outcomes remain separate from failure.`} />
      <Distribution workspace={workspace} />
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.outcomes.recent.map((item) => <OutcomeCard key={item.id} item={item} />)}
      </div>
      {!workspace.outcomes.recent.length ? <InlineEmpty>Recent Outcome assessments are unavailable.</InlineEmpty> : null}
    </section>
    <section id="recommendations" aria-labelledby="recommendations-heading" className="scroll-mt-24 space-y-4">
      <SectionHeading id="recommendations-heading" eyebrow="Repeated effectiveness" title="Recommendation Effectiveness" description="Recommendation-type assessments from LI-003; rates and trends are not recomputed here." />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{workspace.recommendations.items.map((item) => <RecommendationCard key={item.id} item={item} />)}</div>
      {!workspace.recommendations.items.length ? <InlineEmpty>No recommendation-type assessment is available for this window.</InlineEmpty> : null}
    </section>
    <section id="learnings" aria-labelledby="learnings-heading" className="scroll-mt-24 space-y-4">
      <SectionHeading id="learnings-heading" eyebrow="Portfolio knowledge" title="Portfolio Learnings" description={`${workspace.learnings.activeCount} active learnings · ${workspace.learnings.candidateCount} candidates. Claims remain scoped to this portfolio.`} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{workspace.learnings.items.filter((item) => item.category !== "measurement").map((item) => <LearningCard key={item.id} item={item} />)}</div>
      {!workspace.learnings.items.length ? <InlineEmpty>No established portfolio learning is available yet. A measured decision can be assessed without becoming a repeatable portfolio learning.</InlineEmpty> : null}
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <LearningCollection title="Assumption Accuracy" description="Systematic expectation bias preserved by Portfolio Learning." items={workspace.assumptionAccuracy} />
      <LearningCollection title="Execution Patterns" description="Observed execution relationships use non-causal language." items={workspace.executionPatterns} />
    </div>
    <section id="measurement" aria-labelledby="measurement-heading" className="scroll-mt-24 space-y-4">
      <SectionHeading id="measurement-heading" eyebrow="Evidence discipline" title="Measurement Quality" description="Are decisions being measured well enough to support learning?" />
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Readiness</p>
        <p className="mt-2 text-xl font-semibold text-stone-950">{readinessLabel(workspace.measurementQuality.readiness)}</p>
        <ReadinessDetail readiness={workspace.measurementQuality.readiness} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{workspace.measurementQuality.items.map((item) => <LearningCard key={item.id} item={item} />)}</div>
    </section>
    <Lineage workspace={workspace} />
  </div>;
}

function WorkspaceHeader({ workspace }: { workspace: Workspace }) {
  return <header className="rounded-3xl bg-[#102925] px-6 py-7 text-white shadow-sm sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Learn · Continuous Improvement</p>
    <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Continuous Improvement</h1><p className="mt-2 text-base text-stone-300">{workspace.portfolio.name} · {workspace.outcomes.completedCount} measured Outcomes · {workspace.learnings.activeCount} active learnings</p></div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"><div><dt className="text-stone-400">Observation window</dt><dd>{date(workspace.observationWindow.start)} – {date(workspace.observationWindow.end)}</dd></div><div><dt className="text-stone-400">Evaluated</dt><dd>{dateTime(workspace.evaluatedAt)}</dd></div><div><dt className="text-stone-400">Confidence</dt><dd>{confidence(workspace.executiveSummary.confidence)}</dd></div><div><dt className="text-stone-400">Freshness</dt><dd>{label(workspace.freshness.status)}</dd></div></dl>
    </div>
  </header>;
}
function Attention({ workspace }: { workspace: Workspace }) {
  return <section aria-labelledby="attention-heading" className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5"><h2 id="attention-heading" className="text-lg font-semibold text-stone-950">Attention Required</h2>{workspace.attention.items.length ? <ol className="mt-4 space-y-3">{workspace.attention.items.map((item) => <li key={`${item.type}:${item.sourceId}`} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-stone-700">{item.rank}</span><div><p className="text-sm font-medium text-stone-900">{item.label}</p><p className="text-xs text-stone-600">{label(item.severity)} · {label(item.type)}</p></div></li>)}</ol> : <p className="mt-3 text-sm text-stone-600">No authoritative attention item is present.</p>}</section>;
}
function Changes({ workspace }: { workspace: Workspace }) {
  return <section aria-labelledby="changes-heading" className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><h2 id="changes-heading" className="text-lg font-semibold text-stone-950">What Changed</h2>{workspace.changes.comparable ? <ul className="mt-4 space-y-3">{workspace.changes.items.map((item) => <li key={item.id} className="border-l-2 border-teal-500 pl-3 text-sm text-stone-700"><span className="font-medium text-stone-950">{label(item.direction)}</span> · {item.label}</li>)}</ul> : <p className="mt-3 text-sm text-stone-600">No comparable prior Learning Intelligence assessment is available.</p>}</section>;
}
function Distribution({ workspace }: { workspace: Workspace }) {
  return <div role="group" aria-label="Decision Outcome classification distribution" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(workspace.decisions.distribution).map(([key, item]) => <div key={key} className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-sm font-medium text-stone-600">{classificationLabels[key] ?? label(key)}</p><p className="mt-1 text-2xl font-semibold text-stone-950">{item.count}</p><p className="text-xs text-stone-500">{item.percentage === null ? "Rate unavailable" : `${Math.round(item.percentage)}% of completed assessments`}</p></div>)}</div>;
}
function OutcomeCard({ item }: { item: LearningWorkspaceOutcomeItem }) {
  return <article aria-label={`${classificationLabels[item.classification]} Outcome for ${item.subject}`} className={`rounded-2xl border bg-white p-5 shadow-sm ${item.classification === "harmful" ? "border-rose-400" : item.classification === "inconclusive" ? "border-amber-300" : "border-stone-200"}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{item.subjectType}</p><h3 className="mt-1 font-semibold text-stone-950">{item.subject}</h3><p className="text-sm text-stone-600">{item.decision}</p></div><StatusBadge value={classificationLabels[item.classification] ?? item.classification} tone={item.classification === "harmful" ? "danger" : item.classification === "inconclusive" ? "warning" : "neutral"} /></div>
    {item.primaryObjective ? <div className="mt-4 rounded-xl bg-stone-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Primary objective</p><p className="mt-1 text-sm font-medium">{item.primaryObjective.name}: {label(item.primaryObjective.status)}</p><p className="mt-1 text-xs text-stone-600">Actual {item.primaryObjective.actual ?? "not measured"} · Target {item.primaryObjective.target ?? "unavailable"}</p></div> : null}
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat label="Guardrails" value={item.guardrails.violated ? `${item.guardrails.violated} violated` : `${item.guardrails.preserved} preserved`} /><Stat label="Confidence" value={confidence(item.confidence)} /><Stat label="Evidence" value={label(item.evidence)} /><Stat label="Attribution" value={label(item.attribution)} /></dl>
    {item.classification === "inconclusive" ? <p className="mt-4 text-sm text-amber-800">The available evidence did not support a conclusive decision assessment.</p> : null}
  </article>;
}
function RecommendationCard({ item }: { item: LearningWorkspaceRecommendationItem }) {
  return <article className={`rounded-2xl border bg-white p-5 shadow-sm ${item.severeHarm ? "border-rose-400" : "border-stone-200"}`}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-stone-950">{humanize(item.recommendationType)}</h3><StatusBadge value={label(item.effectiveness)} tone={item.effectiveness === "harmful" ? "danger" : "neutral"} /></div><p className="mt-2 text-sm text-stone-600">{label(item.quality)} · {item.sampleSize} measured Outcomes</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat label="Success rate" value={percent(item.successRate)} /><Stat label="Harm rate" value={percent(item.harmRate)} /><Stat label="Repeatability" value={label(item.repeatability)} /><Stat label="Confidence" value={confidence(item.confidence)} /><Stat label="Trend" value={item.trend ? label(item.trend) : "Not comparable"} /><Stat label="Learning readiness" value={label(item.learningReadiness)} /></dl>{item.applicability.length ? <p className="mt-4 text-xs text-stone-600">Supported conditions: {item.applicability.join(" · ")}</p> : null}{item.severeHarm ? <p className="mt-3 font-medium text-rose-800">Severe harm has been observed and remains visible independently of the success rate.</p> : null}</article>;
}
function LearningCard({ item }: { item: LearningWorkspaceLearningItem }) {
  const contested = item.maturity === "contested" || item.contradiction === "material" || item.contradiction === "dominant";
  return <article className={`rounded-2xl border bg-white p-5 shadow-sm ${contested ? "border-amber-400" : "border-stone-200"}`}><div className="flex flex-wrap items-center gap-2"><StatusBadge value={maturityLabels[item.maturity] ?? label(item.maturity)} tone={contested ? "warning" : "neutral"} /><span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label(item.category)}</span></div><h3 className="mt-3 font-semibold leading-6 text-stone-950">{item.statement}</h3><p className="mt-2 text-xs text-stone-500">Supported within this portfolio · {label(item.scope)} scope</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat label="Materiality" value={label(item.materiality)} /><Stat label="Confidence" value={confidence(item.confidence)} /><Stat label="Evidence" value={`${item.supportingCount} supporting · ${item.contradictingCount} contradicting`} /><Stat label="Consistency" value={label(item.consistency)} /><Stat label="Applicability" value={label(item.applicability)} /><Stat label="Freshness" value={label(item.freshness)} /></dl>{item.conditions.length ? <p className="mt-4 text-xs text-stone-600">Applies when: {item.conditions.join(" · ")}</p> : null}{item.contradictingCount ? <details className="mt-4 rounded-xl bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-medium text-amber-900">Contradictory evidence: {label(item.contradiction)}</summary><p className="mt-2 text-sm text-amber-900">{item.contradictingCount} assessment{item.contradictingCount === 1 ? "" : "s"} contradict this pattern. Applicability and confidence remain separate.</p></details> : null}</article>;
}
function LearningCollection({ title, description, items }: { title: string; description: string; items: readonly LearningWorkspaceLearningItem[] }) {
  const heading = title.toLowerCase().replaceAll(" ", "-");
  return <section aria-labelledby={heading} className="space-y-4"><SectionHeading id={heading} eyebrow="Portfolio pattern" title={title} description={description} /><div className="space-y-4">{items.map((item) => <LearningCard key={item.id} item={item} />)}{!items.length ? <InlineEmpty>No supported {title.toLowerCase()} pattern is available.</InlineEmpty> : null}</div></section>;
}
function Lineage({ workspace }: { workspace: Workspace }) {
  return <section aria-labelledby="lineage-heading" className="rounded-2xl border border-stone-200 bg-stone-50 p-5"><h2 id="lineage-heading" className="text-lg font-semibold">Confidence, limitations, and lineage</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Stat label="Portfolio version" value={String(workspace.lineage.portfolioVersion)} /><Stat label="Decision policy" value={workspace.lineage.decisionPolicyVersions.join(", ") || "Unavailable"} /><Stat label="Recommendation policy" value={workspace.lineage.recommendationPolicyVersions.join(", ") || "Unavailable"} /><Stat label="Learning policy" value={workspace.lineage.learningPolicyVersion ?? "Unavailable"} /></dl>{workspace.limitations.length ? <ul className="mt-5 space-y-2">{workspace.limitations.map((item) => <li key={`${item.section}:${item.code}`} className="text-sm text-stone-700"><span className="font-medium">{label(item.impact)}</span> · {item.label}</li>)}</ul> : <p className="mt-4 text-sm text-stone-600">No workspace-level limitation is recorded.</p>}</section>;
}
function EarlyState({ state }: { state: Extract<ContinuousImprovementWorkspaceState, { status: "no-outcomes" | "measurement-in-progress" }> }) {
  const measuring = state.status === "measurement-in-progress";
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Learn · Continuous Improvement</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">Continuous Improvement</h1><div className="mt-8 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm"><h2 className="text-2xl font-semibold">{measuring ? "Measurement is in progress." : "Learning begins with measured decisions."}</h2><p className="mt-3 max-w-2xl text-stone-600">{measuring ? `${state.workspace.measuringCount} Outcomes are collecting evidence. The first learning assessment becomes available after sufficient measurement is complete.` : "Complete an execution and measure its result to begin building decision and recommendation effectiveness."}</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><Stat label="Planned Outcomes" value={String(state.workspace.plannedCount)} /><Stat label="Measuring Outcomes" value={String(state.workspace.measuringCount)} /></dl>{state.workspace.limitations.length ? <p className="mt-6 text-sm text-amber-800">Some Learning Intelligence readers are not configured; unavailable data is not represented as zero.</p> : null}</div></div>;
}
function ReadinessDetail({ readiness }: { readiness: LearningWorkspaceMeasurementReadiness }) {
  if (readiness.status === "strong") return <p className="mt-2 text-sm text-stone-600">{Math.round(readiness.completedOutcomeCoverage)}% completed coverage · {Math.round(readiness.inconclusiveRate)}% inconclusive</p>;
  if (readiness.status === "limited") return <p className="mt-2 text-sm text-stone-600">{readiness.primaryLimitations.join(" ")}</p>;
  if (readiness.status === "weak") return <p className="mt-2 text-sm text-rose-700">{readiness.blockingLimitations.join(" ")}</p>;
  return <p className="mt-2 text-sm text-stone-600">Measurement readiness is unavailable.</p>;
}
function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">{title}</h2><p className="mt-1 max-w-3xl text-sm text-stone-600">{description}</p></div>; }
function MetricCard({ label: itemLabel, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{itemLabel}</p><p className="mt-2 text-base font-semibold leading-6 text-stone-950">{value}</p></div>; }
function Stat({ label: itemLabel, value }: { label: string; value: string }) { return <div><dt className="text-xs text-stone-500">{itemLabel}</dt><dd className="mt-0.5 font-medium text-stone-900">{value}</dd></div>; }
function StatusBadge({ value, tone }: { value: string; tone: "danger" | "warning" | "neutral" }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "danger" ? "bg-rose-100 text-rose-800" : tone === "warning" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}>{value}</span>; }
function InlineEmpty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">{children}</p>; }
function Notice({ title, children, tone }: { title: string; children: React.ReactNode; tone: "warning" | "info" }) { return <section aria-live="polite" className={`rounded-2xl border p-4 ${tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-950"}`}><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm">{children}</p></section>; }
function readinessLabel(value: LearningWorkspaceMeasurementReadiness): string { return value.status === "unavailable" ? "Unavailable" : label(value.status); }
function confidence(value: number | null): string { if (value === null) return "Unavailable"; return value >= 0.8 ? `High (${Math.round(value * 100)}%)` : value >= 0.55 ? `Moderate (${Math.round(value * 100)}%)` : `Low (${Math.round(value * 100)}%)`; }
function percent(value: number | null): string { return value === null ? "Insufficient evidence" : `${Math.round(value)}%`; }
function label(value: string): string { return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function humanize(value: string): string { return value.replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function date(value: Date): string { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function dateTime(value: Date): string { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }

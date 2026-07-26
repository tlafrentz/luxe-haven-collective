import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  compareInvestmentScenarios,
  type InvestmentScenarioWorkspace,
} from "../application";
import type { InvestmentScenario, ScenarioDifferenceState } from "../domain";
import { PreferredScenarioButton } from "./preferred-scenario-button";

export function InvestmentScenarioWorkspaceView({
  workspace,
}: {
  workspace: InvestmentScenarioWorkspace;
}) {
  const selected = workspace.activeScenarios.slice(0, 4);
  const comparison = selected.length >= 2 ? compareInvestmentScenarios(selected) : null;
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <nav aria-label="Breadcrumb" className="text-sm text-stone-500"><Link href="/dashboard/investments/opportunities">Opportunities</Link> / <Link href={`/dashboard/investments/opportunities/${workspace.opportunity.id}`}>{workspace.opportunity.name}</Link> / <span aria-current="page">Scenarios</span></nav>
    <header className="flex flex-col gap-5 border-b border-stone-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">Saved scenarios</p><h1 className="mt-2 font-serif text-4xl text-stone-950 sm:text-5xl">Compare investment strategies</h1><p className="mt-3 max-w-3xl text-stone-600">Immutable calculations for {workspace.opportunity.address}. Change assumptions by generating a new revision; historical results never update.</p></div>
      {workspace.capabilities.create ? <Link href={`/dashboard/investments/new?opportunity=${workspace.opportunity.id}&mode=reanalyze`} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">Create scenario</Link> : null}
    </header>

    {workspace.state === "empty" ? <Card className="border-dashed p-8"><h2 className="text-xl font-semibold">Create your first scenario</h2><p className="mt-2 text-sm text-stone-600">Run a complete Investment Decision Analysis to establish the base scenario.</p></Card> : <>
      {workspace.state !== "complete" ? <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Scenario comparison is available, but one or more snapshots contain evidence limitations. Confidence remains scenario-specific.</section> : null}
      <section aria-labelledby="scenario-list-heading"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Scenario list</p><h2 id="scenario-list-heading" className="mt-2 text-2xl font-semibold">Preserved strategies</h2></div><p className="text-sm text-stone-500">{workspace.activeScenarios.length} active</p></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{workspace.activeScenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} aggregateVersion={workspace.aggregateVersion} />)}</div>
      </section>
      {comparison ? <ScenarioComparisonTable scenarios={selected} comparison={comparison} /> : null}
      <section aria-labelledby="scenario-history-heading"><p className="eyebrow">Scenario timeline</p><h2 id="scenario-history-heading" className="mt-2 text-2xl font-semibold">Calculation history</h2><ol className="mt-5 space-y-3 border-l border-stone-200 pl-5">{[...workspace.scenarios].reverse().map((scenario) => <li key={scenario.id} className="relative rounded-xl border border-stone-200 bg-white p-4"><span className="absolute -left-[1.55rem] top-5 h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" /><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{scenario.name} calculated</p><time dateTime={scenario.createdAt.toISOString()} className="text-xs text-stone-500">{date(scenario.createdAt)}</time></div><p className="mt-1 text-sm text-stone-600">Revision {scenario.revision} · {scenario.snapshot.engineVersion} · {scenario.snapshot.evidenceVersion}</p></li>)}</ol></section>
    </>}
  </main>;
}

function ScenarioCard({ scenario, aggregateVersion }: { scenario: InvestmentScenario; aggregateVersion: number }) {
  const financials = scenario.snapshot.result.financials;
  return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{label(scenario.type)}</p><h3 className="mt-2 text-lg font-semibold">{scenario.name}</h3></div>{scenario.preferred ? <Badge tone="success">Preferred</Badge> : <Badge>{label(scenario.status)}</Badge>}</div>
    <dl className="mt-5 grid grid-cols-2 gap-4"><Fact term="Revenue" value={currency(financials.projectedAnnualRevenue.amount)} /><Fact term="Cash flow" value={currency(financials.annualCashFlow.amount)} /><Fact term="Score" value={`${scenario.snapshot.result.score.value}/${scenario.snapshot.result.score.scaleMaximum}`} /><Fact term="Confidence" value={label(scenario.snapshot.result.confidence.level)} /></dl>
    <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold"><Link className="underline" href={`/dashboard/investments/opportunities/${scenario.opportunityId}/scenarios/${scenario.id}`}>View scenario</Link><Link className="underline" href={`/dashboard/investments/new?opportunity=${scenario.opportunityId}&mode=reanalyze`}>Duplicate & modify</Link>{!scenario.preferred ? <PreferredScenarioButton opportunityId={scenario.opportunityId} scenarioId={scenario.id} expectedVersion={aggregateVersion} /> : null}</div>
  </Card>;
}

function ScenarioComparisonTable({ scenarios, comparison }: { scenarios: readonly InvestmentScenario[]; comparison: ReturnType<typeof compareInvestmentScenarios> }) {
  return <section aria-labelledby="scenario-comparison-heading"><p className="eyebrow">Side-by-side comparison</p><h2 id="scenario-comparison-heading" className="mt-2 text-2xl font-semibold">What changed?</h2><p className="mt-2 text-sm text-stone-600">Comparing {scenarios.length} immutable snapshots. Differences use the first scenario as the baseline.</p>
    <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200"><table className="min-w-full divide-y divide-stone-200 text-left text-sm"><thead className="bg-stone-50"><tr><th className="p-4">Metric</th>{scenarios.map((scenario) => <th key={scenario.id} className="min-w-44 p-4">{scenario.name}{scenario.preferred ? " · Preferred" : ""}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{comparison.financialDifferences.map((row) => <tr key={row.metric}><th className="p-4 font-semibold">{row.metric}</th>{row.values.map((value) => <td key={value.scenarioId} className="p-4"><span>{value.value === undefined ? "Unavailable" : number(row.metric, value.value)}</span>{value.difference && value.difference !== 0 ? <span className={`ml-2 text-xs font-semibold ${differenceColor(value.state)}`}>{value.difference > 0 ? "+" : ""}{number(row.metric, value.difference)}</span> : null}</td>)}</tr>)}
      <tr><th className="p-4 font-semibold">Recommendation</th>{comparison.recommendationDifferences.map((value) => <td key={value.scenarioId} className="p-4"><span className="font-semibold">{label(value.recommendation)}</span><span className="mt-1 block text-xs text-stone-500">{label(value.confidence)} confidence</span></td>)}</tr>
    </tbody></table></div>
    <div className="mt-6"><h3 className="font-semibold">Changed assumptions only</h3>{comparison.changedAssumptions.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{comparison.changedAssumptions.map((item) => <div key={item.key} className="rounded-xl bg-stone-50 p-4"><p className="text-sm font-semibold">{label(item.key)}</p><p className="mt-2 text-xs leading-5 text-stone-600">{item.values.map(({ scenarioId, value }) => `${scenarios.find(({ id }) => id === scenarioId)?.name}: ${String(value ?? "Unavailable")}`).join(" · ")}</p></div>)}</div> : <p className="mt-2 text-sm text-stone-500">No preserved assumptions differ.</p>}</div>
  </section>;
}

export function InvestmentScenarioDetail({ scenario }: { scenario: InvestmentScenario }) {
  const result = scenario.snapshot.result;
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8"><Link href={`/dashboard/investments/opportunities/${scenario.opportunityId}/scenarios`} className="text-sm font-semibold underline">← All scenarios</Link><header><div className="flex gap-2"><Badge>{label(scenario.type)}</Badge>{scenario.preferred ? <Badge tone="success">Preferred</Badge> : null}</div><h1 className="mt-4 font-serif text-4xl">{scenario.name}</h1><p className="mt-2 text-stone-600">{scenario.description}</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric term="Revenue" value={currency(result.financials.projectedAnnualRevenue.amount)} /><Metric term="Expenses" value={currency(result.financials.operatingExpenses.amount)} /><Metric term="Cash flow" value={currency(result.financials.annualCashFlow.amount)} /><Metric term="Recommendation" value={label(result.recommendation.recommendation)} /></section>
    <Card className="p-6"><h2 className="text-xl font-semibold">Snapshot identity</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Fact term="Calculation version" value={scenario.snapshot.calculationVersion} /><Fact term="Engine version" value={scenario.snapshot.engineVersion} /><Fact term="Evidence version" value={scenario.snapshot.evidenceVersion} /><Fact term="Recommendation version" value={scenario.snapshot.recommendationVersion} /></dl></Card>
    <Card className="p-6"><h2 className="text-xl font-semibold">Preserved assumptions</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{Object.entries(scenario.snapshot.assumptions).map(([key, value]) => <Fact key={key} term={label(key)} value={String(value)} />)}</dl>{Object.keys(scenario.snapshot.assumptions).length === 0 ? <p className="mt-3 text-sm text-stone-500">No user-provided assumption snapshot was available for this historical calculation.</p> : null}</Card>
  </main>;
}

function Metric({ term, value }: { term: string; value: string }) { return <Card className="p-5"><p className="eyebrow">{term}</p><p className="mt-2 text-xl font-semibold">{value}</p></Card>; }
function Fact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1 break-all text-sm font-semibold text-stone-800">{value}</dd></div>; }
function label(value: string) { return value.split("-").map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function number(metric: string, value: number) { return metric.includes("rate") || metric === "Occupancy" || metric.includes("return") ? `${value.toFixed(1)}%` : currency(value); }
function date(value: Date) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value); }
function differenceColor(state: ScenarioDifferenceState) { return state === "improved" ? "text-emerald-700" : state === "declined" ? "text-rose-700" : "text-stone-500"; }

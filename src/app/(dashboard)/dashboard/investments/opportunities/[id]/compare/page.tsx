import Link from "next/link";
import {
  getInvestmentScenarioComparisonRequest,
  mutateInvestmentScenarioAction,
  saveScenarioComparisonSelectionAction,
} from "@/app/actions/investment-scenario-runtime";
import type { InvestmentScenario, ScenarioComparison } from "@/features/investment-opportunity";

export default async function ScenarioComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const result = await getInvestmentScenarioComparisonRequest(id, values(query.scenario));

  if (!result.ok) {
    return <State title="Comparison unavailable" message="Return to the opportunity and confirm your access." href={`/dashboard/investments/opportunities/${id}`} />;
  }

  const { workspace, projection, selectedIds } = result;
  if (workspace.scenarios.length < 2) {
    return <State title="Compare scenarios by creating another investment strategy." message="At least two saved scenarios are required before tradeoffs can be evaluated." href={`/dashboard/investments/opportunities/${id}/scenarios`} />;
  }

  const scenarios = selectedIds.flatMap((scenarioId: string) => {
    const scenario = workspace.scenarios.find((item) => item.id === scenarioId);
    return scenario ? [scenario] : [];
  });

  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
    <header>
      <Link href={`/dashboard/investments/opportunities/${id}/scenarios`}>← Scenario workspace</Link>
      <p className="eyebrow mt-5">Decision intelligence</p>
      <h1 className="mt-2 text-4xl font-semibold">Compare investment strategies</h1>
      <p className="mt-3 text-stone-600">Understand which strategy leads, where it compromises, and why the platform recommends a preferred path.</p>
    </header>

    <form action={saveScenarioComparisonSelectionAction} className="rounded-2xl border p-5">
      <input name="opportunityId" type="hidden" value={id} />
      <fieldset>
        <legend className="font-semibold">Select 2–4 scenarios</legend>
        <p className="mt-1 text-sm text-stone-600">Archived scenarios remain available as read-only historical comparisons.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workspace.scenarios.map((scenario) => <label className="flex cursor-pointer gap-3 rounded-xl border p-4" key={scenario.id}>
            <input type="checkbox" name="scenarioId" value={scenario.id} defaultChecked={selectedIds.includes(scenario.id)} />
            <span>
              <strong>{scenario.name}</strong>
              <span className="mt-1 block text-xs capitalize text-stone-500">{scenario.status} · {scenario.snapshot.result.confidence.level}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
      <button className="mt-4 rounded-full bg-stone-950 px-5 py-2 font-semibold text-white">Compare selected</button>
    </form>

    {projection ? <>
      <section className="rounded-2xl border bg-stone-950 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Best Overall</p>
        <h2 className="mt-2 text-3xl font-semibold">{scenarioName(scenarios, projection.executiveSummary.bestOverallScenarioId)}</h2>
        <p className="mt-3 max-w-4xl text-stone-200">{projection.executiveSummary.decision}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <PreferredForm scenario={scenarios.find((item) => item.id === projection.executiveSummary.bestOverallScenarioId)!} aggregateVersion={workspace.aggregateVersion} />
          <Link className="rounded-full border border-white/40 px-4 py-2 font-semibold" href={`/dashboard/reports/new?type=investment-decision&source=${id}&scenario=${projection.executiveSummary.bestOverallScenarioId}&comparison=${projection.scenarioIds.join(",")}`}>Generate comparison report</Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Scenario cards</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {scenarios.map((scenario) => <article className="rounded-2xl border p-5" key={scenario.id}>
            <div className="flex justify-between gap-2"><h3 className="font-semibold">{scenario.name}</h3>{scenario.preferred ? <span className="text-xs font-semibold text-emerald-700">Preferred</span> : null}</div>
            <p className="mt-2 text-sm capitalize">{scenario.snapshot.result.recommendation.recommendation.replaceAll("-", " ")} · {scenario.snapshot.result.confidence.level} confidence</p>
            <p className="mt-3 text-sm text-stone-600">{scenario.notes ?? "No operator notes."}</p>
          </article>)}
        </div>
      </section>

      <MetricTable projection={projection} scenarios={scenarios} />

      <section>
        <h2 className="text-2xl font-semibold">Benefits, tradeoffs, and risks</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {projection.tradeoffs.map((item) => <article className="rounded-2xl border p-5" key={item.scenarioId}>
            <h3 className="font-semibold">{scenarioName(scenarios, item.scenarioId)}</h3>
            <List title="Benefits" values={item.benefits} />
            <List title="Tradeoffs" values={item.tradeoffs} />
            <List title="Risks" values={item.risks} />
          </article>)}
        </div>
      </section>

      {projection.changedAssumptions.length ? <section>
        <h2 className="text-2xl font-semibold">Changed assumptions only</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {projection.changedAssumptions.map((item) => <article className="rounded-xl border p-4" key={item.key}>
            <h3 className="font-semibold capitalize">{item.key.replaceAll("-", " ")}</h3>
            {item.values.map((value) => <p className="mt-1 text-sm" key={value.scenarioId}>{scenarioName(scenarios, value.scenarioId)}: {String(value.value ?? "Unavailable")}</p>)}
          </article>)}
        </div>
      </section> : null}
    </> : <State title="Select another scenario" message={result.message ?? "At least two available scenarios are required."} href={`/dashboard/investments/opportunities/${id}/scenarios`} />}
  </main>;
}

function MetricTable({ projection, scenarios }: { projection: ScenarioComparison; scenarios: readonly InvestmentScenario[] }) {
  return <section>
    <h2 className="text-2xl font-semibold">Canonical metric comparison</h2>
    <div className="mt-4 overflow-x-auto rounded-2xl border" role="region" aria-label="Scenario metric comparison" tabIndex={0}>
      <table className="min-w-full text-left text-sm">
        <thead><tr><th className="p-4">Metric</th>{scenarios.map((scenario) => <th className="p-4" key={scenario.id}>{scenario.name}</th>)}</tr></thead>
        <tbody>{projection.metrics.map((metric) => <tr className="border-t" key={metric.key}>
          <th className="p-4">{metric.label}</th>
          {metric.values.map((value) => <td className="p-4" key={value.scenarioId}>
            <span>{format(value.value, metric.unit)}</span>
            <span className="ml-2 text-xs font-semibold capitalize" aria-label={value.state}>{symbol(value.state)} {value.state}</span>
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function PreferredForm({ scenario, aggregateVersion }: { scenario: InvestmentScenario; aggregateVersion: number }) {
  if (scenario.preferred) return <span className="rounded-full bg-emerald-500 px-4 py-2 font-semibold">Current preferred</span>;
  return <form action={mutateInvestmentScenarioAction}>
    <input name="opportunityId" type="hidden" value={scenario.opportunityId} />
    <input name="scenarioId" type="hidden" value={scenario.id} />
    <input name="operation" type="hidden" value="preferred" />
    <input name="expectedVersion" type="hidden" value={aggregateVersion} />
    <input name="expectedRevision" type="hidden" value={scenario.metadataRevision ?? 1} />
    <input name="name" type="hidden" value={scenario.name} />
    <input name="description" type="hidden" value={scenario.description} />
    <input name="notes" type="hidden" value={scenario.notes} />
    <button className="rounded-full bg-white px-4 py-2 font-semibold text-stone-950">Set Preferred</button>
  </form>;
}

function List({ title, values: items }: { title: string; values: readonly string[] }) {
  return <div className="mt-4"><h4 className="text-sm font-semibold">{title}</h4>{items.length
    ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
    : <p className="mt-1 text-sm text-stone-500">None identified.</p>}</div>;
}

function format(value: number | string | undefined, unit: string) {
  if (value === undefined) return "Unavailable";
  if (typeof value === "string") return value;
  if (unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}
function symbol(state: string) { return state === "best" ? "✓" : state === "worst" || state === "lower" ? "↓" : state === "higher" ? "↑" : state === "equal" ? "—" : "?"; }
function scenarioName(scenarios: readonly InvestmentScenario[], id: string) { return scenarios.find((scenario) => scenario.id === id)?.name ?? "Unavailable scenario"; }
function State({ title, message, href }: { title: string; message: string; href: string }) { return <section className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-3 text-stone-600">{message}</p><Link href={href} className="mt-5 inline-block rounded-full border px-4 py-2 font-semibold">Continue</Link></section>; }
function values(value: string | string[] | undefined) { return Array.isArray(value) ? value : value ? [value] : []; }

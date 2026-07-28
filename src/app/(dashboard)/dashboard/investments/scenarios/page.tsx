import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type Params = Readonly<Record<string, string | string[] | undefined>>;
type Row = Record<string, unknown>;

export default async function InvestmentScenariosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");

  let request = client.from("investment_scenarios").select("*").order("updated_at", { ascending: false });
  const status = scalar(filters.status);
  const route = scalar(filters.route);
  const type = scalar(filters.type);
  const opportunity = scalar(filters.opportunity);
  if (status === "active") request = request.neq("status", "archived");
  if (status === "archived") request = request.eq("status", "archived");
  if (type) request = request.eq("scenario_type", type);
  if (opportunity) request = request.eq("opportunity_id", opportunity);
  const { data, error } = await request;
  if (error) throw new Error("Saved scenarios could not be loaded.");
  const rows = (data ?? []) as Row[];
  const opportunityIds = [...new Set(rows.map(row => String(row.opportunity_id)))];
  const [{ data: opportunities }, { data: analyses }] = opportunityIds.length
    ? await Promise.all([
        client.from("investment_opportunities").select("id,name,route,property_snapshot,preferred_scenario_id").in("id", opportunityIds),
        client.from("investment_opportunity_analyses").select("id,sequence").in("opportunity_id", opportunityIds),
      ])
    : [{ data: [] }, { data: [] }];
  const opportunityById = new Map((opportunities ?? []).map(item => [String(item.id), item as Row]));
  const sequenceById = new Map((analyses ?? []).map(item => [String(item.id), Number(item.sequence)]));
  const projected = rows.flatMap(row => {
    const parent = opportunityById.get(String(row.opportunity_id));
    if (!parent || (route && String(parent.route) !== route)) return [];
    const preferred = String(parent.preferred_scenario_id ?? "") === String(row.scenario_id);
    if (scalar(filters.preferred) === "true" && !preferred) return [];
    return [{ row, parent, preferred }];
  });

  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-4 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Investment Intelligence</p><h1 className="mt-2 font-serif text-4xl text-stone-950">Scenarios</h1><p className="mt-2 max-w-2xl text-sm text-stone-600">Persisted alternative assumptions and immutable calculation outputs across accessible opportunities.</p></div>
      <Link href="/dashboard/investments/opportunities" className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Opportunity Portfolio</Link>
    </header>
    <form className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-5">
      <Filter name="status" label="Status" value={status} options={[["", "All"], ["active", "Active"], ["archived", "Archived"]]} />
      <Filter name="route" label="Route" value={route} options={[["", "All routes"], ["purchase", "Purchase"], ["rental-arbitrage", "Rental arbitrage"]]} />
      <Filter name="type" label="Scenario type" value={type} options={[["", "All types"], ["base", "Base"], ["cash-purchase", "Cash purchase"], ["rental-arbitrage", "Rental arbitrage"], ["seller-financing", "Seller financing"], ["custom", "Custom"]]} />
      <label className="text-xs font-semibold text-stone-600">Opportunity<select name="opportunity" defaultValue={opportunity} className="mt-1 block w-full rounded-xl border p-2 text-sm"><option value="">All opportunities</option>{[...opportunityById.values()].map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="preferred" value="true" defaultChecked={scalar(filters.preferred) === "true"} /> Preferred only</label>
      <button className="w-fit rounded-full border px-4 py-2 text-sm font-semibold">Apply filters</button>
    </form>
    {projected.length ? <section className="grid gap-5 lg:grid-cols-2">{projected.map(({ row, parent, preferred }) => <ScenarioCard key={String(row.scenario_id)} row={row} parent={parent} preferred={preferred} sourceSequence={sequenceById.get(String(row.source_analysis_version_id))} />)}</section> : <Card className="border-dashed p-10 text-center"><h2 className="text-xl font-semibold">No saved scenarios yet</h2><p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">Create a scenario from a saved Investment Opportunity to compare alternative assumptions without changing the original analysis.</p><Link href="/dashboard/investments/opportunities" className="mt-5 inline-flex font-semibold underline">Open Opportunity Portfolio</Link></Card>}
  </main>;
}

function ScenarioCard({ row, parent, preferred, sourceSequence }: { row: Row; parent: Row; preferred: boolean; sourceSequence?: number }) {
  const output = object(row.output_snapshot);
  const financials = object(output.financials);
  const recommendation = object(output.recommendation);
  const confidence = object(output.confidence);
  const property = object(parent.property_snapshot);
  const route = String(parent.route);
  return <Card className="p-6"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{title(String(row.scenario_type))}</p><h2 className="mt-2 text-xl font-semibold">{String(row.name)}</h2><p className="mt-1 text-sm text-stone-500">{String(parent.name)} · {String(property.displayAddress ?? property.display_address ?? "Property address unavailable")}</p></div>{preferred ? <Badge tone="success">Preferred</Badge> : <Badge>{title(String(row.status))}</Badge>}</div>
    <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3"><Fact label="Route" value={title(route)} /><Fact label="Source" value={`Analysis ${sourceSequence ?? "—"}`} /><Fact label="Updated" value={date(String(row.updated_at))} /><Fact label="Annual revenue" value={money(amount(financials.projectedAnnualRevenue))} /><Fact label="NOI" value={money(amount(financials.netOperatingIncome))} /><Fact label="Annual cash flow" value={money(amount(financials.annualCashFlow))} />{route === "purchase" ? <><Fact label="Cap rate" value={percent(financials.capRate)} /><Fact label="Cash-on-cash" value={percent(financials.cashOnCashReturn)} /></> : <Fact label="Lease coverage" value={ratio(financials.leaseCoverageRatio ?? financials.leaseCoverage)} />}<Fact label="Recommendation" value={title(String(recommendation.recommendation ?? "Unavailable"))} /><Fact label="Confidence" value={title(String(confidence.level ?? "Unavailable"))} /></dl>
    <div className="mt-5 flex gap-4 text-sm font-semibold"><Link className="underline" href={`/dashboard/investments/opportunities/${String(row.opportunity_id)}/scenarios/${String(row.scenario_id)}`}>Open</Link><Link className="underline" href={`/dashboard/investments/opportunities/${String(row.opportunity_id)}/scenarios`}>Manage</Link></div></Card>;
}
function Filter({ name, label, value, options }: { name: string; label: string; value: string; options: readonly (readonly [string, string])[] }) { return <label className="text-xs font-semibold text-stone-600">{label}<select name={name} defaultValue={value} className="mt-1 block w-full rounded-xl border p-2 text-sm">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-stone-800">{value}</dd></div>; }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function amount(value: unknown): number | undefined { const item = object(value); return typeof item.amount === "number" ? item.amount : undefined; }
function money(value: number | undefined) { return value === undefined ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function percent(value: unknown) { const item = object(value); return typeof item.value === "number" ? `${item.value.toFixed(1)}%` : "Unavailable"; }
function ratio(value: unknown) { const item = object(value); const number = typeof value === "number" ? value : typeof item.value === "number" ? item.value : undefined; return number === undefined ? "Unavailable" : `${number.toFixed(2)}×`; }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parsed); }
function title(value: string) { return value.split("-").map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

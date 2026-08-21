import Link from "next/link";
import type {
  FinancialDriver, FinancialMetricSummary, FinancialOverview, FinancialValueState,
} from "../application";
import { FinancialPerformanceChart } from "./financial-performance-chart";
import { FinancialKpiRow, type FinancialKpiCard, type FinancialKpiDrawerContent } from "./financial-kpi-drawer";
import { FinancialExportMenu } from "./financial-export-menu";

export function FinancialOverviewView({ overview }: { overview: FinancialOverview }) {
  if (overview.state === "empty") return <FinancialOverviewEmpty />;
  return <main className="mx-auto max-w-[1500px] space-y-4 px-4 pb-8 pt-3 sm:px-6 lg:px-8">
    <div className="sr-only"><h1>Financial Overview</h1><Link href={`/dashboard/reports/new?type=financial-performance&workspace=${overview.identity.workspaceId}`}>Generate financial report</Link><span>{overview.scope.label} · {range(overview.period.from,overview.period.to)}</span></div>
    <PrintDisclosure overview={overview}/>
    <FinancialExportMenu csvSummary={buildFinancialSummaryCsv(overview)} csvExpenses={buildExpenseDetailCsv(overview)} filePrefix={exportFilePrefix(overview)}/>
    {overview.permissionLimited ? <Notice title="Financial Summary">You can view authorized property profitability, but workspace cash balances and sensitive owner-level financial details may be restricted.</Notice> : null}
    <FinancialKpiRow cards={buildKpiCards(overview)} drawers={buildKpiDrawerContent(overview)}/>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section aria-label="Financial performance" className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold">Financial performance</h3>
        <p className="mt-1 text-xs text-stone-500">Revenue, operating expenses, and NOI across the selected period</p>
        <div className="mt-4"><FinancialPerformanceChart points={overview.performanceTrend} currency={overview.reportingCurrency}/></div>
      </section>
      <FinancialSummaryPanel overview={overview}/>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ExpenseComposition overview={overview}/>
      <FinancialDataStatus overview={overview}/>
    </div>
    <Attention overview={overview}/>
    <aside className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">&#9432; All expenses are recorded as actuals and tied to source evidence. Projections, scenarios, and budgets are kept separate.</aside>
  </main>;
}

function PrintDisclosure({ overview }: { overview: FinancialOverview }) {
  const cashOk = overview.liquidity.status !== "insufficient-evidence";
  return <div className="hidden print:block">
    <h2 className="text-lg font-semibold">Financial Intelligence Overview</h2>
    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      <Row label="Scope" value={overview.scope.label}/>
      <Row label="Reporting period" value={range(overview.period.from,overview.period.to)}/>
      <Row label="Comparison period" value={overview.period.comparison ? range(overview.period.comparison.from,overview.period.comparison.to) : "No comparison configured"}/>
      <Row label="Currency" value={overview.reportingCurrency}/>
      <Row label="Generated" value={dateTime(overview.evaluatedAt)}/>
      <Row label="Data completeness" value={`${dataCompleteness(overview)}%`}/>
      <Row label="Cash position included" value={cashOk ? "Yes" : "No (not connected)"}/>
    </dl>
    <p className="mt-3 text-[10px] leading-4 text-stone-600">
      {(["revenue","operating-expenses","noi","operating-margin"] as const).map(id => `${metricName(id)}: ${KPI_DEFINITIONS[id]}`).join(" ")}
    </p>
  </div>;
}
function Row({ label, value }: { label: string; value: string }) { return <div><dt className="inline font-semibold">{label}: </dt><dd className="inline">{value}</dd></div>; }

function exportFilePrefix(overview: FinancialOverview): string {
  return `financial-intelligence-${overview.period.from}-to-${overview.period.to}`;
}
const CSV_CONTROL_CHARACTERS = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]", "g");
const CSV_FORMULA_PREFIX = new RegExp("^[\\s\\uFEFF]*[=+\\-@]", "u");
export function csvEscape(value: unknown): string {
  let text = String(value ?? "").replace(CSV_CONTROL_CHARACTERS, "").slice(0, 10_000);
  if (CSV_FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csvRow(cells: readonly unknown[]): string { return cells.map(csvEscape).join(","); }
function csvDocument(metadataRows: readonly (readonly [string, string])[], header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const metadata = metadataRows.map(row => csvRow(row)).join("\r\n");
  const body = rows.map(row => csvRow(row)).join("\r\n");
  return `﻿${metadata}\r\n\r\n${csvRow(header)}\r\n${body}\r\n`;
}
function buildExportMetadataRows(overview: FinancialOverview): readonly (readonly [string, string])[] {
  const cashOk = overview.liquidity.status !== "insufficient-evidence";
  return [
    ["Scope", overview.scope.label],
    ["Reporting period", range(overview.period.from, overview.period.to)],
    ["Comparison period", overview.period.comparison ? range(overview.period.comparison.from, overview.period.comparison.to) : "No comparison configured"],
    ["Currency", overview.reportingCurrency],
    ["Generated", dateTime(overview.evaluatedAt)],
    ["Data completeness", `${dataCompleteness(overview)}%`],
    ["Cash position included", cashOk ? "Yes" : "No (not connected)"],
  ];
}
export function buildFinancialSummaryCsv(overview: FinancialOverview): string {
  const drawers = buildKpiDrawerContent(overview);
  return csvDocument(
    buildExportMetadataRows(overview),
    ["Metric", "Current value", "Comparison value", "Absolute change", "Percentage change", "Definition"],
    drawers.map(drawer => [drawer.label, drawer.currentValue, drawer.comparisonValue, drawer.absoluteChange, drawer.percentageChange, drawer.definition]),
  );
}
export function buildExpenseDetailCsv(overview: FinancialOverview): string {
  const rows = overview.drivers.expenses.map(driver => {
    const share = driver.share !== undefined ? `${(driver.share * 100).toFixed(1)}%` : "Not available";
    const changeText = driver.change === undefined ? "No comparison available" : driver.change.amount === 0 ? "No change" : `${signedMoney(driver.change.amount, overview.reportingCurrency)} ${driver.change.amount > 0 ? "higher" : "lower"}`;
    return [title(driver.label), money(driver.amount.amount, overview.reportingCurrency), share, changeText];
  });
  return csvDocument(buildExportMetadataRows(overview), ["Category", "Amount", "% of total", "Change vs. previous period"], rows);
}

function buildKpiCards(overview: FinancialOverview): readonly FinancialKpiCard[] {
  return (["revenue","operating-expenses","noi","operating-margin"] as const).map(id => {
    const metric = overview.metrics.find(item => item.metric === id);
    const unavailable = !metric || metric.current.qualification === "unavailable";
    const [deltaLine, captionLine] = comparisonLines(id, metric, overview.reportingCurrency);
    return {
      id, label: metricName(id),
      value: unavailable ? "Not available" : formatValue(metric.current, overview.reportingCurrency),
      unavailableReason: unavailable ? (metric?.current.limitation ?? "This metric is not available for the selected period.") : undefined,
      deltaLine, captionLine,
    };
  });
}

const KPI_DEFINITIONS: Record<string, string> = {
  revenue: "Recognized operating revenue during the selected period.",
  "operating-expenses": "Operating expenses incurred during the selected period, excluding capital and non-operating activity.",
  noi: "Revenue minus eligible operating expenses.",
  "operating-margin": "NOI divided by revenue, expressed as a percentage.",
};
const KPI_EXCLUSIONS: Record<string, readonly string[]> = {
  revenue: ["Non-operating income", "Capital contributions", "Financing proceeds"],
  "operating-expenses": ["Debt principal", "Owner distributions", "Owner contributions", "Property acquisition costs", "Non-operating transfers", "Capital expenditures"],
  noi: ["Debt service", "Income tax", "Depreciation", "Amortization", "Owner distributions", "Capital contributions"],
  "operating-margin": ["Debt service", "Income tax", "Depreciation", "Amortization", "Owner distributions", "Capital contributions"],
};
function buildKpiDrawerContent(overview: FinancialOverview): readonly FinancialKpiDrawerContent[] {
  return (["revenue","operating-expenses","noi","operating-margin"] as const).map(id => {
    const metric = overview.metrics.find(item => item.metric === id);
    const included = id === "operating-expenses"
      ? (overview.drivers.expenses.length ? overview.drivers.expenses.map(driver => title(driver.label)) : ["No categorized operating-expense activity yet"])
      : id === "revenue" ? (overview.drivers.revenue.length ? overview.drivers.revenue.map(driver => title(driver.label)) : ["Recognized operating revenue"])
        : id === "noi" ? ["Recognized revenue", "Eligible operating expenses"]
          : ["NOI", "Revenue"];
    const currentValue = metric && metric.current.qualification !== "unavailable" ? formatValue(metric.current, overview.reportingCurrency) : "Not available";
    const comparisonValue = metric?.comparison ? formatValue(metric.comparison, overview.reportingCurrency) : "Not available";
    const absoluteChange = id === "operating-margin"
      ? (metric?.change?.percentagePointChange !== undefined ? `${metric.change.percentagePointChange > 0 ? "+" : "−"}${Math.abs(metric.change.percentagePointChange * 100).toFixed(1)} pts` : "Not available")
      : (metric?.change?.amount ? signedMoney(metric.change.amount.amount, overview.reportingCurrency) : "Not available");
    const percentageChange = id === "operating-margin"
      ? "Not applicable — margin change is expressed in percentage points"
      : (metric?.change?.percentageChange !== undefined ? `${metric.change.percentageChange >= 0 ? "+" : ""}${(metric.change.percentageChange * 100).toFixed(1)}%` : "Not available");
    return {
      id, label: metricName(id), definition: KPI_DEFINITIONS[id]!,
      currentValue, comparisonValue, absoluteChange, percentageChange,
      includedCategories: included, excludedCategories: KPI_EXCLUSIONS[id] ?? [],
      dataSources: metric ? `${metric.evidenceIds.length} evidence record${metric.evidenceIds.length === 1 ? "" : "s"} · ${title(metric.confidence)} confidence` : "No evidence available",
      lastRefreshed: dateTime(overview.evaluatedAt),
      ...(id === "operating-expenses" ? { destination: { href: "/dashboard/observe/financial/expenses", label: "View expense details" } } : {}),
    };
  });
}

function Attention({ overview }: { overview: FinancialOverview }) {
  return <section id="financial-attention" aria-labelledby="financial-attention-heading"><Heading id="financial-attention-heading" title="Financial attention" description="Descriptive conditions requiring inspection; these are not recommendations or decisions." />{overview.attention.length ? <ul className="mt-5 grid gap-4 md:grid-cols-2">{overview.attention.map(item => <li key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-950">{item.title}</h3><p className="mt-2 text-sm text-amber-900">{item.description}</p><p className="mt-2 text-xs leading-5 text-amber-800">{item.whyItMatters} · {title(item.confidence)} confidence</p>{item.destination ? <Link href={item.destination} className="mt-3 inline-flex text-sm font-semibold text-amber-950 underline">Inspect evidence</Link> : null}</li>)}</ul> : <Empty><strong className="text-stone-700">Financial data is current.</strong> No material data-quality issues were detected for this period.</Empty>}</section>;
}

function dataCompleteness(overview: FinancialOverview): number {
  const evidence=overview.evidence;
  const revenueOk=evidence.revenueCoverage>0;
  const cashOk=overview.liquidity.status!=="insufficient-evidence";
  const forecastOk=overview.planning.available;
  return Math.round((((revenueOk?1:0)+Math.min(1,evidence.expenseCoverage)+(cashOk?1:0)+(forecastOk?1:0))/4)*100);
}

function performanceInsight(overview: FinancialOverview): string {
  const revenue=overview.metrics.find(item=>item.metric==="revenue");
  const expenses=overview.metrics.find(item=>item.metric==="operating-expenses");
  const noi=overview.metrics.find(item=>item.metric==="noi");
  const topCategories=overview.drivers.expenses.slice(0,2).map(driver=>title(driver.label));
  const parts:string[]=[];
  if(noi?.change?.direction==="improved"){
    parts.push(revenue?.change?.direction==="improved" ? "NOI increased primarily because revenue rose during the period." : "NOI increased as operating expenses were reduced during the period.");
  } else if(noi?.change?.direction==="declined"){
    const expensesRose=Boolean(expenses?.change?.amount && expenses.change.amount.amount>0);
    parts.push(expensesRose ? "NOI declined as operating expenses increased during the period." : "NOI declined as revenue was lower during the period.");
  }
  if(topCategories.length) parts.push(`${topCategories.join(" and ")} ${topCategories.length>1?"were":"was"} the largest expense categor${topCategories.length>1?"ies":"y"} during this period.`);
  return parts.length ? parts.join(" ") : "Insufficient comparison data is available to characterize the change in operating performance.";
}

function FinancialSummaryPanel({ overview }: { overview: FinancialOverview }) {
  const rows=(["revenue","operating-expenses","noi","operating-margin"] as const).map(id=>{
    const metric=overview.metrics.find(item=>item.metric===id);
    const available=metric&&metric.current.qualification!=="unavailable";
    return { id, label: metricName(id), value: available?formatValue(metric.current,overview.reportingCurrency):"Not available" };
  });
  const comparisonLabel=overview.period.comparison?`Comparisons versus ${range(overview.period.comparison.from,overview.period.comparison.to)}`:"No comparison period is configured.";
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <h3 className="font-semibold">Financial summary</h3>
    <dl className="mt-4 space-y-3 text-sm">{rows.map(row=><div key={row.id} className="flex items-center justify-between gap-3"><dt className="text-stone-500">{row.label}</dt><dd className="font-semibold text-stone-900">{row.value}</dd></div>)}</dl>
    <p className="mt-4 text-xs text-stone-500">{comparisonLabel}</p>
    <p className="mt-1 text-xs text-stone-500">{dataCompleteness(overview)}% data complete</p>
    <p className="mt-1 text-xs text-stone-400">Last refreshed {dateTime(overview.evaluatedAt)}</p>
    <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-600">{performanceInsight(overview)}</p>
  </div>;
}

function FinancialDataStatus({ overview }: { overview: FinancialOverview }) {
  const evidence=overview.evidence;
  const revenueOk=evidence.revenueCoverage>0;
  const uncategorized=evidence.uncategorizedTransactionCount;
  const cashOk=overview.liquidity.status!=="insufficient-evidence";
  const forecastOk=overview.planning.available;
  const completeness=dataCompleteness(overview);
  const rows=[
    { label: "Revenue", value: revenueOk?"Connected":"Not connected", detail: revenueOk?`Up to ${date(overview.period.to)}`:"Connect a revenue source", ok: revenueOk },
    { label: "Expenses", value: uncategorized>0?`${uncategorized} need classification`:"Fully classified", detail: uncategorized>0?"Review required":"No action needed", ok: uncategorized===0 },
    { label: "Cash position", value: cashOk?"Connected":"Not connected", detail: cashOk?`Up to ${date(overview.period.to)}`:"Connect a bank, accounting system, or verified ledger", ok: cashOk },
    { label: "Forecast inputs", value: forecastOk?"Current":"Not connected", detail: forecastOk?`through ${date(overview.period.to)}`:"Connect planning data", ok: forecastOk },
  ] as const;
  return <section aria-label="Financial data status" className="rounded-xl border bg-white p-5">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Financial data status</h3><span className="text-sm font-semibold text-stone-700">{completeness}% complete</span></div>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{rows.map(row=><div key={row.label}><dt className="text-xs font-semibold text-stone-500">{row.label}</dt><dd className={`text-sm font-semibold ${row.ok?"text-emerald-700":"text-amber-700"}`}>{row.value}</dd><dd className="text-[10px] text-stone-500">{row.detail}</dd></div>)}</dl>
  </section>;
}

function ExpenseComposition({ overview }: { overview: FinancialOverview }) {
  const drivers=overview.drivers.expenses;
  return <section aria-label="Expense composition" className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Expense composition</h3><p className="mt-1 text-xs text-stone-500">Top operating-expense categories for the selected period</p></div>
      <Link href="/dashboard/observe/financial/expenses" className="text-xs font-semibold text-emerald-800 underline">View expense details</Link>
    </div>
    {!drivers.length
      ? <Empty>No categorized operating-expense activity is available for this period.</Empty>
      : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="border-b text-stone-500"><tr><th className="py-2 font-medium">Category</th><th className="py-2 font-medium">Amount</th><th className="py-2 font-medium">% of total</th><th className="py-2 font-medium">vs. previous period</th></tr></thead><tbody>{drivers.map(driver=><ExpenseCategoryRow key={driver.id} driver={driver} currency={overview.reportingCurrency}/>)}</tbody></table></div>}
  </section>;
}
function ExpenseCategoryRow({ driver, currency }: { driver: FinancialDriver; currency: string }) {
  const share = driver.share !== undefined ? `${(driver.share * 100).toFixed(1)}%` : "—";
  const changeText = driver.change === undefined ? "No comparison available"
    : driver.change.amount === 0 ? "No change"
    : `${signedMoney(driver.change.amount, currency)} ${driver.change.amount > 0 ? "higher" : "lower"}`;
  return <tr className="border-b border-stone-100"><td className="py-3 font-medium text-stone-800">{title(driver.label)}</td><td className="py-3">{money(driver.amount.amount, currency)}</td><td className="py-3">{share}</td><td className="py-3 text-stone-500">{changeText}</td></tr>;
}
export function FinancialOverviewEmpty() { return <main className="mx-auto max-w-3xl px-4 py-16"><section role="status" className="rounded-[2rem] border border-stone-200 bg-white p-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Financial Intelligence</p><h1 className="mt-3 text-3xl font-semibold">Financial data unavailable</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-stone-600">Connect, import, or enter financial data to begin Financial Intelligence.</p><Link href="/dashboard/workspace/connected-systems" className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">Review connected systems</Link></section></main>; }
export function FinancialOverviewErrorView({ code, message }: { code: string; message: string }) { return <main className="mx-auto max-w-3xl px-4 py-16"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8"><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{title(code)} error</p><h1 className="mt-3 text-3xl font-semibold">Financial Overview could not be completed</h1><p className="mt-3 text-sm text-stone-600">{message}</p></section></main>; }
export function FinancialOverviewSkeleton() { return <main aria-label="Loading Financial Overview" aria-busy="true" className="mx-auto max-w-[1500px] animate-pulse space-y-5 px-4 py-8 motion-reduce:animate-none sm:px-6 lg:px-8"><div className="h-28 rounded-xl bg-stone-200" /><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div className="h-32 rounded-xl bg-stone-200" key={i} />)}</div><div className="h-[32rem] rounded-2xl bg-stone-200" /></main>; }

function Heading({ id, title: label, description }: { id: string; title: string; description: string }) { return <div><h2 id={id} className="text-2xl font-semibold tracking-tight">{label}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{description}</p></div>; }
function Notice({ title: label, children }: { title: string; children: React.ReactNode }) { return <aside role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>{label}.</strong> {children}</aside>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">{children}</p>; }
function formatValue(value: FinancialValueState, currency: string) { if (value.money) return money(value.money.amount, currency); if (value.percentage !== undefined) return `${(value.percentage * 100).toFixed(1)}%`; return "Not available"; }
function money(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, signDisplay: value < 0 ? "always" : "auto" }).format(value); }
function signedMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(value); }
const FAVORABLE_WHEN_INCREASING: Record<string, boolean> = { revenue: true, "operating-expenses": false, noi: true, "operating-margin": true };
function comparisonLines(id: string, metric: FinancialMetricSummary | undefined, currency: string): readonly [string, string] {
  const item = metric?.change;
  if (!item) return ["No comparison available", "The previous period has insufficient data"];
  if (item.kind === "new") return ["New measurement this period", "vs. previous period"];
  if (item.direction === "stable") return ["No change", "vs. previous period"];
  if (id === "operating-margin") {
    const pts = item.percentagePointChange;
    if (pts === undefined) return ["Comparison unavailable", "vs. previous period"];
    const sign = pts > 0 ? "+" : "−";
    return [`${sign}${Math.abs(pts * 100).toFixed(1)} pts`, "vs. previous period"];
  }
  const favorableWhenIncreasing = FAVORABLE_WHEN_INCREASING[id] ?? true;
  const amountValue = item.amount?.amount ?? 0;
  const higher = amountValue > 0;
  const pct = item.percentageChange === undefined ? undefined : Math.abs(item.percentageChange * 100).toFixed(1);
  if (favorableWhenIncreasing) {
    const signed = signedMoney(amountValue, currency);
    return [pct === undefined ? `${signed} ${higher ? "higher" : "lower"}` : `${signed} · ${pct}% ${higher ? "higher" : "lower"}`, "vs. previous period"];
  }
  const abs = money(Math.abs(amountValue), currency);
  const qualifier = higher ? "increase" : "improvement";
  return [pct === undefined ? `${abs} ${higher ? "higher" : "lower"}` : `${abs} ${higher ? "higher" : "lower"} · ${pct}% ${qualifier}`, "vs. previous period"];
}
function metricName(value: string) { return ({ revenue: "Revenue", "operating-expenses": "Operating Expenses", noi: "NOI", "operating-margin": "Operating Margin", "cash-balance": "Cash Balance", "net-cash-movement": "Net Cash Movement" } as Record<string,string>)[value] ?? title(value); }
function title(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function date(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function range(from: string, to: string) { return `${date(from)} – ${date(to)}`; }
function dateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)); }

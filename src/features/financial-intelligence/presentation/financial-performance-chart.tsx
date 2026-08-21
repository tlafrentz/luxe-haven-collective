"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialPerformanceTrendPoint } from "../application";

type Granularity = "daily" | "weekly" | "monthly";
const SERIES = [
  { key: "revenue", label: "Revenue", color: "var(--chart-primary)" },
  { key: "expenses", label: "Operating Expenses", color: "var(--status-critical-icon)" },
  { key: "noi", label: "NOI", color: "var(--chart-comparison)" },
] as const;

function weekStart(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - parsed.getUTCDay());
  return parsed.toISOString().slice(0, 10);
}
function bucket(points: readonly FinancialPerformanceTrendPoint[], granularity: Granularity): readonly FinancialPerformanceTrendPoint[] {
  if (granularity === "daily") return points;
  const key = (value: string) => granularity === "monthly" ? value.slice(0, 7) : weekStart(value);
  const byKey = new Map<string, FinancialPerformanceTrendPoint>();
  for (const point of points) byKey.set(key(point.date), point);
  return Object.freeze([...byKey.values()]);
}
function formatAxisDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: value.length > 7 ? "numeric" : undefined, year: value.length > 7 ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`)); }

export function FinancialPerformanceChart({ points, currency }: { points: readonly FinancialPerformanceTrendPoint[]; currency: string }) {
  const showGranularityToggle = points.length > 31;
  const [granularity, setGranularity] = useState<Granularity>(points.length > 120 ? "monthly" : "weekly");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const data = useMemo(() => bucket(points, showGranularityToggle ? granularity : "daily"), [points, granularity, showGranularityToggle]);
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  function toggleSeries(key: string) {
    setHidden(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  if (!points.length) return <p className="flex h-64 items-center justify-center rounded-xl bg-stone-50 text-center text-sm text-stone-500">No financial activity is available to chart for this period.</p>;
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Toggle chart series" className="flex flex-wrap gap-2">
        {SERIES.map(series => <button key={series.key} type="button" onClick={() => toggleSeries(series.key)} aria-pressed={!hidden.has(series.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${hidden.has(series.key) ? "border-stone-200 text-stone-400" : "border-stone-300 text-stone-800"}`}><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: series.color }} />{series.label}</button>)}
      </div>
      {showGranularityToggle ? <div role="group" aria-label="Chart granularity" className="flex gap-1 rounded-full border border-stone-200 p-1">{(["weekly", "monthly"] as const).map(option => <button key={option} type="button" onClick={() => setGranularity(option)} aria-pressed={granularity === option} className={`rounded-full px-3 py-1 text-xs font-semibold ${granularity === option ? "bg-stone-950 text-white" : "text-stone-600"}`}>{option === "weekly" ? "Weekly" : "Monthly"}</button>)}</div> : null}
    </div>
    <div className="mt-4 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={formatAxisDate} axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={(value: number) => money(value)} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
          <Tooltip formatter={(((value: unknown) => money(Number(value))) as never)} labelFormatter={(((value: unknown) => formatAxisDate(String(value))) as never)} />
          {SERIES.filter(series => !hidden.has(series.key)).map(series => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <table className="sr-only">
      <caption>Financial performance trend data table</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Revenue</th><th scope="col">Operating Expenses</th><th scope="col">NOI</th></tr></thead>
      <tbody>{data.map(point => <tr key={point.date}><th scope="row">{formatAxisDate(point.date)}</th><td>{money(point.revenue)}</td><td>{money(point.expenses)}</td><td>{money(point.noi)}</td></tr>)}</tbody>
    </table>
  </div>;
}

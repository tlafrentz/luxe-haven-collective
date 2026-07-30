"use client";
import type { MarketAssumptionSelection } from "../application/market-intelligence-experience";

export function MarketAssumptionCard(props: {
  label: string; selection: MarketAssumptionSelection; format?: (value: number) => string;
  confidence?: "low" | "moderate" | "high"; retrievedAt?: string;
  onAccept?: () => void; onOverride?: (value: number) => void; onRestore?: () => void;
}) {
  const format = props.format ?? String, value = props.selection.value, onOverride = props.onOverride;
  return <article className="rounded-2xl border border-stone-200 bg-white p-4">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-950">{value === undefined ? "Unavailable" : format(value)}</p></div>
      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">{stateLabel(props.selection.state)}</span></div>
    {props.confidence ? <p className="mt-2 text-xs text-stone-500">{stateLabel(props.confidence)} confidence{props.retrievedAt ? ` · Updated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(props.retrievedAt))}` : ""}</p> : null}
    {props.selection.state === "user-overridden" && props.selection.marketValue !== undefined
      ? <p className="mt-2 text-sm text-stone-600">Market evidence: {format(props.selection.marketValue)}</p> : null}
    <div className="mt-3 flex flex-wrap gap-2">
      {props.selection.state === "market-derived" && props.onAccept ? <button onClick={props.onAccept} className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white">Accept</button> : null}
      {onOverride && props.selection.marketValue !== undefined ? <button onClick={() => {
        const entered = window.prompt(`Override ${props.label}`, String(value ?? props.selection.marketValue));
        if (entered !== null && entered.trim() && Number.isFinite(Number(entered))) onOverride(Number(entered));
      }} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold">Override</button> : null}
      {props.selection.state === "user-overridden" && props.onRestore ? <button onClick={props.onRestore} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold">Restore market value</button> : null}
    </div>
  </article>;
}
const stateLabel = (value: string) => value.split("-").map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ");

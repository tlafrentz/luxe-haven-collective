"use client";

import { useActionState } from "react";
import { generateFinancialSnapshotAction } from "@/app/actions/financial-snapshots";

export function FinancialSnapshotForm({workspaceId,propertyIds,from,to}:{workspaceId:string;propertyIds:readonly string[];from:string;to:string}){
  const[state,action,pending]=useActionState(generateFinancialSnapshotAction,{});
  return <form action={action} className="flex flex-wrap items-center justify-end gap-3">
    <input type="hidden" name="workspaceId" value={workspaceId}/>
    <input type="hidden" name="propertyIds" value={propertyIds.join(",")}/>
    <input type="hidden" name="from" value={from}/><input type="hidden" name="to" value={to}/>
    <label className="sr-only" htmlFor="snapshot-basis">Snapshot basis</label>
    <select id="snapshot-basis" name="basis" className="ui-control text-sm">
      <option value="actual">Actual</option><option value="forecast">Forecast</option>
      <option value="scenario">Scenario</option><option value="budget">Budget</option><option value="target">Target</option>
    </select>
    <button disabled={pending||!propertyIds.length} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{pending?"Generating…":"Generate Financial Snapshot"}</button>
    <span className={state.ok?"text-sm text-emerald-700":"text-sm text-red-700"} aria-live="polite">{state.message}{state.correlationId&&!state.ok?` Correlation: ${state.correlationId}`:""}</span>
  </form>;
}

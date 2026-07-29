"use client";
import { useActionState, useEffect, useRef } from "react";
import { recordFinancialExpenseAction } from "@/app/actions/financial-observations";
import { financialExpenseCategories } from "../domain";

export function FinancialExpenseForm({workspaceId,properties,currency}:{workspaceId:string;properties:readonly{id:string;name:string}[];currency:string}){
  const[state,action,pending]=useActionState(recordFinancialExpenseAction,{});
  const commandId=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(state.ok&&commandId.current)commandId.current.value=crypto.randomUUID()},[state.ok]);
  return <form action={action} onSubmit={()=>{if(commandId.current&&!commandId.current.value)commandId.current.value=crypto.randomUUID()}} className="space-y-6 rounded-3xl border bg-white p-6 shadow-sm">
    <input type="hidden" name="workspaceId" value={workspaceId}/><input ref={commandId} type="hidden" name="idempotencyKey"/><input type="hidden" name="currency" value={currency}/>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Property"><select name="propertyId" required className="ui-control mt-2 w-full">{properties.map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></Field>
      <Field label="Expense category"><select name="category" required className="ui-control mt-2 w-full">{financialExpenseCategories.map(category=><option key={category} value={category}>{title(category)}</option>)}</select></Field>
      <Field label={`Amount (${currency})`}><input name="amount" type="number" min="0.01" step="0.01" required className="ui-control mt-2 w-full"/></Field>
      <Field label="Basis"><select name="basis" className="ui-control mt-2 w-full"><option value="actual">Actual</option><option value="forecast">Forecast</option><option value="scenario">Scenario</option><option value="budget">Budget</option><option value="target">Target</option></select></Field>
      <Field label="Frequency"><select name="frequency" className="ui-control mt-2 w-full"><option value="one-time">One time</option><option value="nightly">Nightly</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></Field>
      <Field label="Effective date"><input name="effectiveDate" type="date" required className="ui-control mt-2 w-full"/></Field>
      <Field label="Effective through (optional)"><input name="effectiveTo" type="date" className="ui-control mt-2 w-full"/></Field>
      <Field label="Source reference"><input name="sourceReference" maxLength={200} placeholder="Invoice, statement, or provider reference" className="ui-control mt-2 w-full"/></Field>
    </div>
    <div aria-live="polite">{state.message?<p className={state.ok?"text-emerald-700":"text-red-700"}>{state.message}{state.correlationId?` Correlation: ${state.correlationId}`:""}</p>:state.ok?<p className="text-emerald-700">{state.duplicate?"This expense was already recorded.":"Expense recorded successfully."}</p>:null}</div>
    <button disabled={pending||!properties.length} className="rounded-full bg-stone-950 px-5 py-3 font-semibold text-white disabled:opacity-40">{pending?"Saving…":"Record Expense"}</button>
  </form>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return<label className="text-sm font-semibold">{label}{children}</label>}
function title(value:string){return value.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase())}

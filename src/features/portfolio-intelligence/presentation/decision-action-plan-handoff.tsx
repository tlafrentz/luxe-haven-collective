"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createExecutePlanFromDecisionAction } from "@/app/actions/execute-plans";

export function DecisionActionPlanHandoff({ decisionId }: Readonly<{ decisionId: string }>) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Readonly<{ ok: boolean; message?: string; planId?: string }> | null>(null);
  return <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6" aria-labelledby="execution-handoff-title">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-800">Decide → Execute</p>
    <h2 className="mt-2 text-xl font-semibold" id="execution-handoff-title">Create the canonical Action Plan</h2>
    <p className="mt-2 text-sm text-stone-700">The draft will retain this decision, rationale, authorized scope, expected outcomes, and proposed work. Creating it does not activate or assign execution.</p>
    {result?.ok && result.planId ? <Link className="mt-5 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white" href={`/dashboard/execute/plans/${encodeURIComponent(result.planId)}`}>Open Action Plan →</Link> : <button className="mt-5 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" disabled={pending} onClick={() => startTransition(async () => { const response = await createExecutePlanFromDecisionAction({ decisionId }); setResult(response.ok ? { ok: true, planId: response.value.id } : { ok: false, message: response.message }); })}>{pending ? "Creating plan…" : "Create Action Plan"}</button>}
    {result && !result.ok ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">{result.message}</p> : null}
  </section>;
}

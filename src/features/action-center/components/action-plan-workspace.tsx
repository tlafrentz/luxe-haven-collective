"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  activateExecutePlanAction,
  cancelExecutePlanAction,
  completeExecutePlanAction,
  updateExecuteDraftAction,
} from "@/app/actions/execute-plans";
import type { ActionPlanProps, ExecuteActivityEvent } from "@/platform/actions";
import { actionPlanBackPath } from "../domain/action-plan-route";

type CommandResult = Readonly<{ ok: boolean; message?: string }>;

export function ActionPlanWorkspace({ plan, history,backContext }: Readonly<{ plan: ActionPlanProps; history: readonly ExecuteActivityEvent[];backContext?:string }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const missingDeadlines = plan.actions.filter((action) => !action.dueAt);
  const missingOwners = plan.actions.filter((action) => !action.owner);

  function run(operation: () => Promise<CommandResult>) {
    startTransition(async () => {
      const result = await operation();
      if (result.ok) { setMessage(""); router.refresh(); }
      else setMessage(result.message ?? "The Action Plan could not be changed.");
    });
  }

  function saveDeadline(actionId: string, dueAt: string) {
    if (!dueAt) return;
    run(() => updateExecuteDraftAction({
      planId: plan.id,
      actionId,
      expectedVersion: plan.version,
      changes: { dueAt: new Date(`${dueAt}T23:59:00`) },
      correlationId: `customer-plan-deadline:${crypto.randomUUID()}`,
    }));
  }

  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
    <nav aria-label="Breadcrumb" className="text-sm text-stone-600"><Link className="font-semibold hover:text-stone-950" href={actionPlanBackPath(plan.workspaceId,backContext)}>Execute › Action Center</Link><span aria-hidden="true"> › </span><span>Action Plan</span></nav>
    <header className="rounded-3xl bg-stone-950 p-7 text-white sm:p-9"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Execute › Action Center › Action Plan</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">{plan.title}</h1>{plan.description ? <p className="mt-3 max-w-3xl text-stone-300">{plan.description}</p> : null}</div><span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold capitalize">{plan.status.replaceAll("-", " ")}</span></div></header>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Plan context"><Fact label="Version" value={String(plan.version)} /><Fact label="Source" value={plan.origin.type === "decision" ? `Decision ${plan.linkedDecisionId ?? plan.origin.id ?? "unavailable"}` : plan.origin.type} /><Fact label="Scope" value={plan.scope.type.replaceAll("-", " ")} /><Fact label="Created" value={plan.createdAt.toLocaleString()} /></dl>
    {plan.linkedDecisionId ? <p><Link className="font-semibold text-teal-800 underline-offset-4 hover:underline" href={`/dashboard/portfolio/decisions/${encodeURIComponent(plan.linkedDecisionId)}`}>View source decision →</Link></p> : null}
    <section><h2 className="text-2xl font-semibold">Actions</h2><div className="mt-4 space-y-4">{plan.actions.map((action, index) => <article className="rounded-2xl border bg-white p-5" key={action.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold text-stone-500">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-1 font-semibold">{action.title}</h3>{action.dependencies?.length ? <p className="mt-2 text-sm text-amber-800">Depends on: {action.dependencies.join(", ")}</p> : null}</div><span className="text-sm text-stone-600">{action.owner?.id ? `Assigned: ${action.owner.id}` : "Unassigned"}</span></div>{plan.status === "draft" ? <DeadlineForm current={action.dueAt} disabled={pending} onSave={(value) => saveDeadline(action.id, value)} /> : <p className="mt-3 text-sm">Due: {action.dueAt?.toLocaleString() ?? "Not scheduled"}</p>}</article>)}</div></section>
    <section className="rounded-2xl border bg-stone-50 p-6"><h2 className="text-xl font-semibold">Activation readiness</h2><ul className="mt-4 space-y-2 text-sm"><Check ok={plan.actions.length > 0}>At least one canonical Action</Check><Check ok={!missingOwners.length}>{missingOwners.length ? `${missingOwners.length} Action owner${missingOwners.length === 1 ? " is" : "s are"} missing` : "Every Action has an owner"}</Check><Check ok={!missingDeadlines.length}>{missingDeadlines.length ? `${missingDeadlines.length} required deadline${missingDeadlines.length === 1 ? " is" : "s are"} missing` : "Every Action has a deadline"}</Check><Check ok={Boolean(plan.linkedDecisionId) || plan.origin.type !== "decision"}>{plan.origin.type === "decision" ? "Decision lineage retained" : "Manual plan origin recorded"}</Check></ul>{plan.status === "draft" ? <button className="mt-5 rounded-full bg-stone-950 px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={pending || !plan.actions.length || Boolean(missingOwners.length || missingDeadlines.length)} onClick={() => run(() => activateExecutePlanAction({ planId: plan.id, expectedVersion: plan.version, acknowledgeUnassigned: false, correlationId: `customer-plan-activation:${crypto.randomUUID()}` }))}>Activate Plan</button> : null}</section>
    {plan.status !== "draft" ? <section className="rounded-2xl border p-6"><h2 className="text-xl font-semibold">Available commands</h2><div className="mt-4 flex flex-wrap gap-3">{["active", "at-risk", "blocked"].includes(plan.status) ? <><button disabled={pending} onClick={() => run(() => completeExecutePlanAction({ planId: plan.id, expectedVersion: plan.version }))} className="rounded-full bg-stone-950 px-5 py-3 font-semibold text-white disabled:opacity-40">Complete Plan</button><CancelButton disabled={pending} onCancel={(reason) => run(() => cancelExecutePlanAction({ planId: plan.id, expectedVersion: plan.version, reason }))} /></> : <p className="text-sm text-stone-600">No lifecycle commands are available for this plan.</p>}</div></section> : null}
    {message ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">{message}</p> : null}
    <section><h2 className="text-2xl font-semibold">History</h2>{history.length ? <ol className="mt-4 space-y-3">{history.map((event) => <li className="rounded-xl border p-4 text-sm" key={event.id}><span className="font-semibold">{event.eventType.replaceAll("-", " ")}</span><span className="block text-stone-600">{event.occurredAt.toLocaleString()} · {event.actor.id ?? event.actor.type}</span></li>)}</ol> : <p className="mt-4 rounded-xl border bg-stone-50 p-5 text-sm text-stone-600">No plan history is available.</p>}</section>
  </main>;
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) { return <div className="rounded-2xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-2 break-words font-semibold capitalize">{value}</dd></div>; }
function Check({ ok, children }: Readonly<{ ok: boolean; children: ReactNode }>) { return <li className={ok ? "text-emerald-800" : "text-amber-900"}>{ok ? "✓" : "○"} {children}</li>; }
function DeadlineForm({ current, disabled, onSave }: Readonly<{ current?: Date; disabled: boolean; onSave: (value: string) => void }>) { const currentValue = current?.toISOString().slice(0, 10) ?? ""; const [value, setValue] = useState(currentValue); return <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Due date<input className="mt-1 block rounded-lg border p-2 font-normal" disabled={disabled} onChange={(event) => setValue(event.target.value)} type="date" value={value} /></label><button className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={disabled || !value || value === currentValue} onClick={() => onSave(value)} type="button">Save due date</button></div>; }
function CancelButton({ disabled, onCancel }: Readonly<{ disabled: boolean; onCancel: (reason: string) => void }>) { const [open, setOpen] = useState(false), [reason, setReason] = useState(""); return open ? <form className="w-full rounded-xl border bg-stone-50 p-4" onSubmit={(event) => { event.preventDefault(); onCancel(reason); }}><label className="text-sm font-semibold">Cancellation reason<textarea className="mt-2 block min-h-20 w-full rounded-lg border p-3 font-normal" onChange={(event) => setReason(event.target.value)} required value={reason} /></label><div className="mt-3 flex gap-2"><button className="rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white" disabled={disabled || !reason.trim()}>Confirm cancellation</button><button className="rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)} type="button">Keep plan</button></div></form> : <button className="rounded-full border border-rose-300 px-5 py-3 font-semibold text-rose-800" disabled={disabled} onClick={() => setOpen(true)} type="button">Cancel Plan</button>; }

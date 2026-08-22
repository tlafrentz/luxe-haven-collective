import type { ActionPlanProps } from "@/platform/actions";

export function ActionPlanQueue({ plans }: { plans: readonly ActionPlanProps[] }) {
  return <section><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Planning queue</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Action Plans</h2>
    {plans.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{plans.map((plan) => <article key={plan.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold text-stone-950">{plan.title}</h3><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold capitalize text-stone-600">{plan.status}</span></div><p className="mt-3 text-sm text-stone-600">{plan.actions.length} planned action{plan.actions.length === 1 ? "" : "s"}</p></article>)}</div> : <div role="status" className="mt-5 rounded-3xl border border-stone-200 bg-stone-50 p-8 text-center"><h3 className="font-semibold text-stone-950">No action plans yet</h3><p className="mt-2 text-sm text-stone-600">Draft, active, and completed plans will appear here.</p></div>}
  </section>;
}

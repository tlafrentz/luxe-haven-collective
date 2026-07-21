import { CheckCircle2 } from "lucide-react";
import type { ActionCenterAction } from "../domain";
import { ActionCard } from "./action-card";

export function ActionQueue({ actions, isEmpty }: { actions: readonly ActionCenterAction[]; isEmpty: boolean }) {
  return <section><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Execution queue</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Active actions</h2>
    <div className="mt-5 space-y-4">{actions.length ? actions.map((action) => <ActionCard key={action.id} action={action} />) : <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-stone-500"/><h3 className="mt-4 font-semibold text-stone-950">{isEmpty ? "No committed actions yet" : "No active actions"}</h3><p className="mt-2 text-sm text-stone-600">{isEmpty ? "Actions will appear here when work is created or accepted through the platform." : "The execution queue is clear."}</p></div>}</div>
  </section>;
}

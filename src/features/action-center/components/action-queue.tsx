import { CheckCircle2 } from "lucide-react";
import type { ActionCenterAction, ActionCenterViewSelection } from "../domain";
import { ActionCard } from "./action-card";

type QueueView = Exclude<ActionCenterViewSelection, "plans">;
const copy: Record<QueueView, Readonly<{ eyebrow: string; title: string; empty: string; detail: string }>> = {
  overview: { eyebrow: "Execution queue", title: "Active actions", empty: "No committed actions yet", detail: "Actions will appear here when work is created or accepted through the platform." },
  "my-work": { eyebrow: "Personal queue", title: "My Work", empty: "No actions are assigned to you", detail: "Assigned work for the selected workspace will appear here." },
  all: { eyebrow: "Authorized queue", title: "All Actions", empty: "No actions in this workspace", detail: "Created and accepted actions will appear here." },
  completed: { eyebrow: "Execution history", title: "Completed Actions", empty: "No completed actions yet", detail: "Completed and cancelled work will appear here." },
};

export function ActionQueue({ actions, selectedView }: { actions: readonly ActionCenterAction[]; selectedView: QueueView }) {
  const state = copy[selectedView];
  return <section><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{state.eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{state.title}</h2>
    <div className="mt-5 space-y-4">{actions.length ? actions.map((action) => <ActionCard key={action.id} action={action} />) : <div role="status" className="rounded-3xl border border-stone-200 bg-stone-50 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-stone-500"/><h3 className="mt-4 font-semibold text-stone-950">{state.empty}</h3><p className="mt-2 text-sm text-stone-600">{state.detail}</p></div>}</div>
  </section>;
}

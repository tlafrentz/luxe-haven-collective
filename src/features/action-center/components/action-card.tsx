import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import type { ActionCenterAction } from "../domain";
import { ActionPriorityBadge } from "./action-priority-badge";
import { ActionStatusBadge } from "./action-status-badge";

export function ActionCard({ action }: { action: ActionCenterAction }) { return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><ActionPriorityBadge priority={action.priority}/><ActionStatusBadge status={action.status}/>{action.actionType ? <span className="text-xs text-stone-500">{action.actionType}</span> : null}</div><h3 className="mt-4 text-lg font-semibold text-stone-950">{action.title}</h3>{action.description ? <p className="mt-2 text-sm text-stone-600">{action.description}</p> : null}<div className="mt-5 flex gap-5 text-xs text-stone-500"><span className="inline-flex gap-2"><UserRound className="h-3.5 w-3.5"/>Owner: {action.owner.label}</span>{action.assignee ? <span>Assignee: {action.assignee.label}</span> : <span>Unassigned</span>}<span>Source: {action.sourceLabel}</span></div></div><Link href={`/dashboard/actions/${action.id}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold">Open <ArrowRight className="h-4 w-4"/></Link></div></article>; }

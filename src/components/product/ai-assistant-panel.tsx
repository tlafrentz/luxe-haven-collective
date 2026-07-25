import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/patterns/card";

export function AiAssistantPanel({ title = "AI Assistant", summary, confidence, children, actions }: Readonly<{ title?: string; summary: string; confidence?: Readonly<{ label: string; explanation: string }>; children?: ReactNode; actions?: ReactNode }>) {
  return <Card className="bg-stone-50/70 p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-950 text-teal-100"><Sparkles aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-stone-950">{title}</h3><p className="text-xs text-stone-500">Assists—never acts without approval</p></div></div><p className="mt-4 text-sm leading-6 text-stone-700">{summary}</p>{confidence ? <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3"><p className="text-xs font-semibold text-stone-800">{confidence.label}</p><p className="mt-1 text-xs leading-5 text-stone-500">{confidence.explanation}</p></div> : null}{children ? <div className="mt-4">{children}</div> : null}{actions ? <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-200 pt-4">{actions}</div> : null}</Card>;
}

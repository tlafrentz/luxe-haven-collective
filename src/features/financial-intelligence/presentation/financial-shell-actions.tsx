"use client";

import { Download, ExternalLink, HelpCircle, MoreHorizontal, RefreshCw, Settings2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PAGE_HEADER_ACTIONS_SLOT_ID } from "@/components/intelligence-workspace-navigation";

export function FinancialShellActions() {
  const pathname = usePathname();
  const [target] = useState<Element | null>(() => typeof document === "undefined" ? null : document.getElementById(PAGE_HEADER_ACTIONS_SLOT_ID));
  return target ? createPortal(<Actions key={pathname} />, target) : null;
}

function Actions() {
  const pathname = usePathname(), router = useRouter(), ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false), [drawer, setDrawer] = useState<"sources"|"export"|"help"|null>(null);
  const [refreshing, setRefreshing] = useState(false), [feedback, setFeedback] = useState("");
  useEffect(() => { if (!menu) return; const close=(event:MouseEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setMenu(false)}; document.addEventListener("mousedown",close); return()=>document.removeEventListener("mousedown",close); }, [menu]);
  function refresh() { setMenu(false); setRefreshing(true); setFeedback(""); router.refresh(); window.setTimeout(()=>{setRefreshing(false);setFeedback(`Data refreshed ${new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date())}`)},500); }
  return <>
    <button type="button" onClick={()=>setDrawer("export")} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-800"><Download className="h-3.5 w-3.5"/>Export</button>
    <div ref={ref} className="relative"><button type="button" aria-label="Financial Intelligence actions" aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(v=>!v)} className="grid h-10 w-10 place-items-center rounded-md border border-stone-200 bg-white"><MoreHorizontal className="h-4 w-4"/></button>{menu?<div role="menu" aria-label="Financial Intelligence actions" className="absolute right-0 z-30 mt-1 w-60 rounded-lg border bg-white py-1 text-sm shadow-xl">
      <MenuButton icon={<RefreshCw/>} onClick={refresh}>{refreshing?"Refreshing…":"Refresh data"}</MenuButton>
      <MenuButton icon={<ExternalLink/>} onClick={()=>{setMenu(false);setDrawer("sources")}}>View data sources</MenuButton>
      <Link role="menuitem" href="/dashboard/workspace/connected-systems" className="flex min-h-10 items-center gap-3 px-4 hover:bg-stone-50"><Settings2 className="h-4 w-4"/>Manage financial data</Link>
      <MenuButton icon={<Download/>} onClick={()=>{setMenu(false);setDrawer("export")}}>Export options</MenuButton>
      <div className="my-1 border-t"/><MenuButton icon={<HelpCircle/>} onClick={()=>{setMenu(false);setDrawer("help")}}>Financial Intelligence help</MenuButton>
    </div>:null}</div>
    <span className="sr-only" role="status" aria-live="polite">{feedback}</span>
    {drawer?<Panel title={drawer==="sources"?"Data Sources":drawer==="export"?"Export Financial Intelligence":"Financial Intelligence help"} onClose={()=>setDrawer(null)}>{drawer==="sources"?<Sources/>:drawer==="export"?<ExportOptions pathname={pathname}/>:<Help/>}</Panel>:null}
  </>;
}

function MenuButton({icon,children,onClick}:{icon:React.ReactElement;children:React.ReactNode;onClick:()=>void}){return <button role="menuitem" type="button" onClick={onClick} className="flex min-h-10 w-full items-center gap-3 px-4 text-left hover:bg-stone-50"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{children}</button>}
function Panel({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){return <div className="fixed inset-0 z-50 bg-black/20" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside role="dialog" aria-modal="true" aria-label={title} className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-stone-100"><X className="h-4 w-4"/></button></header><div className="flex-1 overflow-y-auto p-5">{children}</div></aside></div>}
function Sources(){const sources=[["Hospitable","Connected","Operational revenue and reservations"],["Bank Accounts","Not connected","No supported bank provider is enabled"],["Manual Financial Inputs","Available","Entered values and imported evidence"],["Market Intelligence","Available","Market context for assumptions"]];return <><ul className="divide-y rounded-xl border">{sources.map(([name,status,detail])=><li key={name} className="p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{name}</strong><span className={status==="Not connected"?"text-xs text-rose-700":"text-xs text-emerald-700"}>{status}</span></div><p className="mt-1 text-xs text-stone-500">{detail}</p></li>)}</ul><Link href="/dashboard/workspace/connected-systems" className="mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md border text-sm font-semibold">Manage all data sources</Link></>}
function ExportOptions({pathname}:{pathname:string}){const label=pathname.endsWith("/expenses")?"Expenses":pathname.endsWith("/cash-flow")?"Cash Flow":pathname.endsWith("/forecast")?"Forecast":"Overview";return <div className="space-y-4"><label className="flex gap-3 rounded-xl border p-4"><input defaultChecked type="radio" name="scope"/><span><strong className="block text-sm">Current view</strong><small className="text-stone-500">Export {label.toLowerCase()} details.</small></span></label><label className="flex gap-3 rounded-xl border p-4"><input type="radio" name="scope"/><span><strong className="block text-sm">Full Financial Intelligence report</strong><small className="text-stone-500">Include all available views and provenance.</small></span></label><label className="block text-sm font-semibold">Format<select className="ui-control mt-2 w-full"><option>PDF</option><option>CSV</option></select></label><button onClick={()=>window.print()} className="min-h-11 w-full rounded-md bg-emerald-800 text-sm font-semibold text-white">Export</button></div>}
function Help(){return <div className="space-y-5 text-sm leading-6 text-stone-600"><p><strong className="text-stone-900">Overview</strong> answers whether the business is financially healthy.</p><p><strong className="text-stone-900">Expenses</strong> explains where money is being spent.</p><p><strong className="text-stone-900">Cash Flow</strong> measures liquidity from cash evidence, never inferred profit.</p><p><strong className="text-stone-900">Forecast</strong> projects performance only when its required inputs are complete.</p></div>}

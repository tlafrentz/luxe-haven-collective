"use client";
import{useActionState}from"react";
import{regenerateReportShareAction,type ReportShareActionState}from"@/app/actions/reporting";
const initial:ReportShareActionState={ok:false,message:""};
export function RegenerateShareForm({reportId,shareId}:{reportId:string;shareId:string}){const[state,action,pending]=useActionState(regenerateReportShareAction,initial);return <form action={action}><input name="reportId" type="hidden" value={reportId}/><input name="shareId" type="hidden" value={shareId}/><button disabled={pending} className="font-semibold underline">{pending?"Regenerating…":"Regenerate link"}</button>{state.message?<p aria-live="polite" className="mt-2 text-xs">{state.message}</p>:null}{state.url?<output className="mt-2 block max-w-md break-all rounded-lg bg-amber-50 p-2 text-xs">{state.url}</output>:null}</form>;}

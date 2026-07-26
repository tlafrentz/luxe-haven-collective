"use client";
import { FinancialPlanningErrorView } from "@/features/financial-intelligence/presentation";
export default function Error({reset}:{error:Error;reset:()=>void}){return <><FinancialPlanningErrorView code="unexpected" message="Financial Planning could not be completed. No plan data was changed."/><div className="mx-auto max-w-3xl px-4"><button onClick={reset} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">Try again</button></div></>}

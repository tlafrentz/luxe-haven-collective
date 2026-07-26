"use client";
import { CashFlowErrorView } from "@/features/financial-intelligence/presentation";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <><CashFlowErrorView code="unexpected" message="Cash Flow could not be completed. No financial data was changed." /><div className="mx-auto max-w-3xl px-4"><button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white" onClick={reset}>Try again</button></div></>;
}

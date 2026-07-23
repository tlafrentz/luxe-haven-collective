"use client";
import { useEffect } from "react";

export default function InvestmentOpportunityWorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Investment opportunity workspace render failed.", { digest: error.digest }); }, [error]);
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-8"><h1 className="text-2xl font-semibold text-rose-950">This opportunity could not be loaded</h1><p className="mt-2 text-sm leading-6 text-rose-800">The workspace encountered an unexpected problem. No infrastructure details were exposed.</p><button type="button" onClick={reset} className="mt-6 rounded-xl bg-rose-950 px-4 py-2.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Try again</button></div></main>;
}

"use client";
export default function PortfolioDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-4 py-16"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8"><h1 className="text-2xl font-semibold text-stone-950">Portfolio dashboard could not be loaded.</h1><p className="mt-3 text-sm text-stone-600">The error was contained and no stale intelligence was substituted.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Try again</button></section></main>;
}

"use client";
export default function PortfolioPropertiesError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-4 py-16"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8"><h1 className="text-3xl font-semibold">Property comparison is unavailable</h1><p className="mt-3 text-sm text-stone-600">No portfolio data was changed.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-teal-600">Try again</button></section></main>;
}

"use client";

import Link from "next/link";

export default function ReportGenerationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-5 py-16"><section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center"><h1 className="text-3xl font-semibold">We couldn&apos;t generate this report</h1><p className="mt-3 text-stone-600">Your Intelligence data is unchanged.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={reset} className="rounded-full bg-stone-950 px-5 py-3 font-semibold text-white">Try again</button><Link href="/dashboard/reports" className="rounded-full border px-5 py-3 font-semibold">View Reports</Link></div></section></main>;
}

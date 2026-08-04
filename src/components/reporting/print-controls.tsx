"use client";

import Link from "next/link";

export function PrintControls({ reportId }: { reportId: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-3 shadow-sm print:hidden">
      <Link className="font-semibold" href={`/dashboard/reports/${reportId}`}>
        ← Report
      </Link>
      <button
        className="rounded-full bg-stone-950 px-5 py-2.5 font-semibold text-white"
        onClick={() => window.print()}
      >
        Print report
      </button>
    </div>
  );
}

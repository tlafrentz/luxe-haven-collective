"use client";

import {
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

type DashboardErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function DashboardError({
  error,
  reset,
}: DashboardErrorProps) {
  return (
    <main className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">
          Executive Intelligence could not load
        </h1>

        <p className="mt-3 text-sm leading-6 text-stone-600">
          The Command Center encountered a problem while
          loading portfolio performance. Try the request
          again. If the issue continues, review the
          server logs and connected data sources.
        </p>

        {process.env.NODE_ENV ===
        "development" ? (
          <p className="mt-4 rounded-xl bg-stone-100 p-3 text-left font-mono text-xs text-stone-600">
            {error.message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </main>
  );
}

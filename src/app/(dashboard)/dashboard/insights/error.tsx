"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

type InsightsErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function InsightsError({
  error,
  reset,
}: InsightsErrorProps) {
  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-medium text-neutral-500">
          Luxe Insights
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">
          Property performance
        </h1>
      </header>

      <section
        role="alert"
        className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <AlertTriangle
            aria-hidden="true"
            className="h-6 w-6"
          />
        </div>

        <h2 className="mt-5 text-xl font-semibold text-neutral-950">
          Insights could not be loaded
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
          We encountered a problem while retrieving the latest property
          and booking metrics. Try loading the report again.
        </p>

        {process.env.NODE_ENV === "development" ? (
          <pre className="mt-5 overflow-x-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100">
            {error.message}
          </pre>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
        >
          <RotateCcw
            aria-hidden="true"
            className="h-4 w-4"
          />
          Try again
        </button>
      </section>
    </main>
  );
}

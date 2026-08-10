"use client";
export default function AutomationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section
        role="alert"
        className="rounded-2xl border border-rose-200 bg-white p-8"
      >
        <h1 className="text-2xl font-semibold">Automation could not load</h1>
        <p className="mt-3 text-stone-600">
          No automation records were changed. Refresh the authoritative
          projection before attempting another command.
        </p>
        <button
          onClick={reset}
          className="mt-6 min-h-11 rounded-full bg-stone-950 px-5 font-semibold text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}

"use client";
import { useRouter } from "next/navigation";

export default function FurnishingOwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter(),
    code = /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "FURNISHING_REQUEST_NOT_APPLIED";
  return (
    <main className="mx-auto max-w-2xl p-6">
      <section
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-amber-300 bg-amber-50 p-6"
      >
        <h1 className="text-xl font-semibold">Your change was not applied</h1>
        <p className="mt-2">
          Your existing plan is unchanged. Refresh to load the latest
          authoritative version.
        </p>
        <p className="mt-3 font-mono text-sm" data-error-code={code}>
          {code}
        </p>
        <button
          className="mt-5 rounded-xl border px-4 py-2 font-semibold"
          onClick={() => {
            router.refresh();
            reset();
          }}
        >
          Refresh project
        </button>
      </section>
    </main>
  );
}

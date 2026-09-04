"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FurnishingAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error("furnishing_admin_typed_error", {
      code: error.message,
      digest: error.digest,
    });
  }, [error]);
  const code = /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "FURNISHING_OPERATION_FAILED";
  return (
    <main className="mx-auto max-w-2xl p-6">
      <section
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-red-300 bg-red-50 p-6"
      >
        <h1 className="text-xl font-semibold">
          The Furnishing command was not applied
        </h1>
        <p className="mt-2">
          No retry was performed automatically. Refresh authoritative state
          before trying again.
        </p>
        <p className="mt-3 font-mono text-sm" data-error-code={code}>
          {code}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="rounded-xl border px-4 py-2 font-semibold"
            onClick={() => {
              router.refresh();
              reset();
            }}
          >
            Refresh authoritative state
          </button>
        </div>
      </section>
    </main>
  );
}

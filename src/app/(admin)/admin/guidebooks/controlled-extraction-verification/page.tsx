import {
  cleanupControlledExtractionAction,
  getControlledExtractionLaunchProjection,
} from "@/app/actions/controlled-guidebook-extraction";
import { requireRole } from "@/lib/auth/session";
import { LaunchForm } from "./launch-form";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    result?: string;
    correlation?: string;
    failure?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const q = await searchParams,
    projection = await getControlledExtractionLaunchProjection();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-700">
          Internal production verification
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Guidebook Auto-Create</h1>
        <p className="mt-3 text-stone-600">
          One fictional property, safe text and image sources, Nano extraction,
          Mini draft generation, canonical Builder edit and revision checks,
          then complete server-side cleanup. Publication remains unavailable.
        </p>
      </header>
      {q.result ? (
        <section className="rounded-xl border bg-white p-4">
          <p className="font-semibold">Status: {q.result}</p>
          {q.correlation ? (
            <p className="mt-2 text-sm">Correlation: {q.correlation}</p>
          ) : null}
          {q.failure && /^[A-Z][A-Z0-9_]{2,100}$/.test(q.failure) ? (
            <p className="mt-2 text-sm">Application error: {q.failure}</p>
          ) : null}
        </section>
      ) : null}
      {projection.launch ? (
        <section className="rounded-xl border bg-stone-50 p-5">
          <h2 className="font-semibold">Operation claimed</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="font-medium">Status</dt>
              <dd>{projection.launch.status}</dd>
            </div>
            <div>
              <dt className="font-medium">Correlation</dt>
              <dd>{projection.launch.correlationId}</dd>
            </div>
          </dl>
          {["running", "cleanup_required"].includes(
            projection.launch.status,
          ) ? (
            <form action={cleanupControlledExtractionAction} className="mt-4">
              <button className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-800">
                Clean up and retry verification once
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <LaunchForm
          customers={projection.customers}
          emptyReason={projection.emptyReason ?? null}
        />
      )}
    </main>
  );
}

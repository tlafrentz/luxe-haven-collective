import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFurnishingStudio,
  updateInstallationStatusAction,
} from "@/app/actions/furnishing-studio";
import {
  Badge,
  FurnishingHeader,
} from "@/components/furnishing/furnishing-navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ installationId: string }>;
}) {
  const { installationId } = await params,
    data = await getFurnishingStudio(),
    task = data.installations.find(
      (x: Record<string, unknown>) => x.id === installationId,
    ) as Record<string, unknown> | undefined;
  if (!task) notFound();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title={String(task.item_name)}
        description={`${String(task.room)} installation checklist`}
        current="installation"
      />
      <nav className="text-sm">
        <Link href="/admin/furnishing/installation">Installation</Link> ›{" "}
        {String(task.item_name)}
      </nav>
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-stone-500">Project</p>
            <p className="font-semibold">
              {String(
                (task.furnishing_projects as Record<string, unknown>)?.name ??
                  "—",
              )}
            </p>
          </div>
          <Badge value={String(task.status)} />
        </div>
        <dl className="mt-6 grid gap-5 md:grid-cols-2">
          <D l="Expected" v={String(task.quantity_expected)} />
          <D l="Installed" v={String(task.quantity_installed)} />
          <D l="Condition" v={String(task.condition ?? "Not recorded")} />
          <D l="Installer" v={String(task.installer ?? "Unassigned")} />
          <D l="Notes" v={String(task.notes ?? "No notes")} />
          <D l="Photo evidence" v={String(task.photo_url ?? "Not attached")} />
        </dl>
        <form
          action={updateInstallationStatusAction}
          className="mt-6 flex gap-3"
        >
          <input type="hidden" name="installationId" value={installationId} />
          <select
            name="status"
            defaultValue={String(task.status)}
            className="rounded-xl border px-3 py-2"
          >
            {[
              "pending",
              "ready",
              "installed",
              "damaged",
              "missing",
              "incorrect",
              "deferred",
              "not_required",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Update checklist
          </button>
        </form>
      </section>
    </main>
  );
}
function D({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-stone-500">{l}</dt>
      <dd className="mt-1 font-semibold">{v}</dd>
    </div>
  );
}

import { notFound } from "next/navigation";
import { AUTOMATION_TEMPLATES } from "@/features/automation-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params,
    item = AUTOMATION_TEMPLATES.find(({ id }) => id === templateId);
  if (!item) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
        Automation template
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{item.name}</h1>
      <p className="mt-4 text-stone-600">{item.purpose}</p>
      <dl className="mt-8 grid gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-stone-500">Version</dt>
          <dd className="font-semibold">{item.version}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-500">Scope</dt>
          <dd className="font-semibold">{item.scope}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-500">Trigger</dt>
          <dd className="font-semibold">{item.trigger}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-500">Approval</dt>
          <dd className="font-semibold">{item.approval}</dd>
        </div>
      </dl>
    </main>
  );
}

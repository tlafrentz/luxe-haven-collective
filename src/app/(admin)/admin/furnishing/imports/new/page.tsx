import { startInventoryImportAction } from "@/app/actions/furnishing-inventory-import";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
import { issueFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const workspace = (params.workspace ?? params.workspaceId ?? "").trim();
  const context = UUID.test(workspace)
    ? await issueFurnishingCommandContext({
        workflow: "fs008g-finalization:fs-ux-003-inventory-import",
        workspaceId: workspace,
        commandType: "catalog.import.parse",
        targetType: "workspace",
        targetId: workspace,
      })
    : null;
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-0">
      <FurnishingHeader
        title="Import inventory"
        description="Upload a governed CSV or XLSX source for mapping, validation, and reconciliation."
        current="imports"
      />
      <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 sm:p-10">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <strong>Platform drafts only.</strong> Imported products are not
          approved, orderable, or added to a workspace until separately reviewed
          and adopted.
        </div>
        {context ? (
          <form action={startInventoryImportAction} className="mt-6">
            <input
              type="hidden"
              name="commandContextId"
              value={context.contextId}
            />
            <label
              htmlFor="inventory-file"
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 p-6 text-center focus-within:ring-2 focus-within:ring-emerald-700"
            >
              <strong>Choose an inventory file</strong>
              <span className="mt-2 text-sm text-stone-600">
                CSV or XLSX · maximum 25 MB · up to 25,000 rows
              </span>
              <input
                id="inventory-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="mt-5 min-h-11 max-w-full rounded-xl border p-2"
              />
            </label>
            <button className="mt-6 min-h-11 rounded-xl bg-emerald-800 px-5 font-semibold text-white">
              Upload and inspect
            </button>
          </form>
        ) : (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Select an authorized workspace before beginning an import.
          </p>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { FurnishingHeader, Badge } from "./furnishing-navigation";
import {
  commitInventoryImportAction,
  confirmInventoryMappingAction,
  getInventoryImport,
  reconcileInventoryImportAction,
  selectInventorySheetAction,
  skipInventoryRowAction,
} from "@/app/actions/furnishing-inventory-import";
import { issueFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";

// Supabase import projections are intentionally dynamic while generated types lag the forward migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const panel = "rounded-2xl border border-stone-200 bg-white p-5";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2";
const stageOrder = [
  "created",
  "uploaded",
  "parsed",
  "mapping_required",
  "validating",
  "validation_blocked",
  "ready_to_reconcile",
  "reconciling",
  "ready_to_commit",
  "committing",
  "complete",
  "complete_with_skips",
  "complete_with_warnings",
];
const validStages: Record<string, string[]> = {
  detail: stageOrder,
  mapping: ["mapping_required"],
  validation: ["validation_blocked", "ready_to_reconcile", "ready_to_commit"],
  reconciliation: ["ready_to_reconcile", "ready_to_commit"],
  complete: ["complete", "complete_with_skips", "complete_with_warnings"],
};

export async function InventoryImportWorkflow({
  importId,
  stage = "detail",
}: {
  importId: string;
  stage?: string;
}) {
  const { run, items } = (await getInventoryImport(importId)) as {
    run: Row;
    items: Row[];
  };
  if (!(validStages[stage] ?? stageOrder).includes(run.status))
    return (
      <main className="space-y-6 px-4 pb-12 sm:px-0">
        <FurnishingHeader
          title="Import stage unavailable"
          description={`This import is currently ${String(run.status).replaceAll("_", " ")}. Complete the required prior stage before continuing.`}
          current="imports"
        />
        <Link
          className={primary}
          href={`/admin/furnishing/imports/${importId}`}
        >
          Return to current stage
        </Link>
      </main>
    );
  const metadata = run.workbook_metadata as {
    sheets?: Array<{
      name: string;
      hidden: boolean;
      rowCount: number;
      headers: string[];
    }>;
  };
  const commitContext =
    run.status === "ready_to_commit"
      ? await issueFurnishingCommandContext({
          workflow: "fs008g-finalization:fs-ux-003-inventory-import",
          workspaceId: String(run.workspace_id),
          commandType: "catalog.import.apply",
          targetType: "import",
          targetId: String(run.id),
        })
      : null;
  const counts = {
    total: items.length,
    valid: items.filter((x) => x.validation_classification === "valid").length,
    warnings: items.filter(
      (x) => x.validation_classification === "valid_with_warnings",
    ).length,
    blocking: items.filter(
      (x) => x.validation_classification === "blocking_error",
    ).length,
    skipped: items.filter((x) => x.reconciliation_decision === "skip").length,
    new: items.filter((x) => x.reconciliation_decision === "create").length,
    updates: items.filter((x) => x.reconciliation_decision === "update_draft")
      .length,
    revisions: items.filter(
      (x) => x.reconciliation_decision === "propose_revision",
    ).length,
    matches: items.filter((x) => x.reconciliation_decision === "link_unchanged")
      .length,
    unresolved: items.filter((x) => x.reconciliation_decision === "unresolved")
      .length,
  };
  return (
    <main className="space-y-6 px-4 pb-12 sm:px-0">
      <FurnishingHeader
        title={stage === "complete" ? "Import complete" : "Inventory import"}
        description={`${run.sanitized_filename ?? run.source_filename} · ${run.source_type.toUpperCase()} · ${String(run.status).replaceAll("_", " ")}`}
        current="imports"
        action={
          <Link
            href="/admin/furnishing/imports"
            className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold"
          >
            Import history
          </Link>
        }
      />
      <ol
        aria-label="Import progress"
        className="grid gap-2 text-xs sm:grid-cols-5"
      >
        {["Upload", "Mapping", "Validation", "Reconciliation", "Complete"].map(
          (x, i) => (
            <li
              className={`rounded-xl border p-3 font-semibold ${Math.max(0, stageOrder.indexOf(run.status)) >= i * 2 ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "text-stone-500"}`}
              key={x}
            >
              {i + 1}. {x}
            </li>
          ),
        )}
      </ol>
      {stage === "detail" && run.status === "parsed" ? (
        <section className={panel}>
          <h2 className="text-xl font-semibold">Select a worksheet</h2>
          <p className="mt-2 text-sm text-stone-600">
            Only one visible worksheet can be imported at a time. Hidden
            worksheets remain excluded.
          </p>
          <div className="mt-4 grid gap-3">
            {metadata.sheets?.map((sheet) => (
              <form
                action={selectInventorySheetAction}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                key={sheet.name}
              >
                <input type="hidden" name="importId" value={importId} />
                <input type="hidden" name="sheet" value={sheet.name} />
                <div>
                  <strong>{sheet.name}</strong>
                  <p className="text-sm text-stone-500">
                    {sheet.rowCount} rows ·{" "}
                    {sheet.hidden ? "Hidden" : "Visible"}
                  </p>
                </div>
                <button disabled={sheet.hidden} className={primary}>
                  Use worksheet
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
      {stage === "mapping" ||
      (stage === "detail" && run.status === "mapping_required") ? (
        <section className={panel}>
          <h2 className="text-xl font-semibold">Confirm field mapping</h2>
          <p className="mt-2 text-sm text-stone-600">
            Proposed mappings are based on normalized header aliases. Ignored
            columns remain unchanged.
          </p>
          <form action={confirmInventoryMappingAction} className="mt-5">
            <input type="hidden" name="importId" value={importId} />
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(run.column_mapping ?? {}).map(
                ([source, target]) => (
                  <label
                    className="grid gap-1 rounded-xl bg-stone-50 p-3 text-sm"
                    key={source}
                  >
                    <span className="font-semibold">{source}</span>
                    <select
                      name={`mapping:${source}`}
                      defaultValue={String(target ?? "")}
                      className="min-h-11 rounded-lg border bg-white px-3"
                    >
                      <option value="">Ignore this column</option>
                      {[
                        "name",
                        "retailer",
                        "sku",
                        "brand",
                        "model",
                        "variant",
                        "category",
                        "price",
                        "currency",
                        "product_url",
                        "availability",
                        "delivery_estimate",
                        "description",
                        "color",
                        "finish",
                        "materials",
                        "width",
                        "height",
                        "depth",
                        "weight",
                        "dimensions_unit",
                        "weight_unit",
                        "room_type",
                        "priority",
                        "quantity_recommendation",
                        "guest_capacity_relevance",
                        "durability_notes",
                        "assembly_requirement",
                        "tv_compatibility",
                        "primary_image_url",
                        "additional_image_urls",
                      ].map((field) => (
                        <option value={field} key={field}>
                          {field.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
            </div>
            <button className={primary}>Confirm mapping and validate</button>
          </form>
        </section>
      ) : null}
      {stage === "validation" ||
      (stage === "detail" &&
        ["validation_blocked", "ready_to_reconcile"].includes(run.status)) ? (
        <>
          <Summary counts={counts} />
          <section className={panel}>
            <h2 className="text-xl font-semibold">Row validation</h2>
            <div className="mt-4 space-y-3">
              {items
                .filter((x) => x.validation_classification !== "valid")
                .slice(0, 200)
                .map((item) => (
                  <article className="rounded-xl border p-4" key={item.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>
                        Row {item.source_row}: {item.proposed_name}
                      </strong>
                      <Badge value={item.validation_classification} />
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-stone-700">
                      {(item.validation_evidence ?? []).map((issue: Row) => (
                        <li key={issue.code}>{issue.explanation}</li>
                      ))}
                    </ul>
                    {item.validation_classification === "blocking_error" ? (
                      <form
                        action={skipInventoryRowAction}
                        className="mt-3 flex flex-wrap gap-2"
                      >
                        <input type="hidden" name="importId" value={importId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          required
                          minLength={3}
                          name="reason"
                          aria-label={`Skip reason for row ${item.source_row}`}
                          className="min-h-11 flex-1 rounded-xl border px-3"
                          placeholder="Reason for skipping this row"
                        />
                        <button className="min-h-11 rounded-xl border px-4 font-semibold">
                          Skip row
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
            </div>
            {run.status === "ready_to_reconcile" ? (
              <form action={reconcileInventoryImportAction} className="mt-5">
                <input type="hidden" name="importId" value={importId} />
                <button className={primary}>Reconcile catalog matches</button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
      {stage === "reconciliation" ||
      (stage === "detail" && run.status === "ready_to_commit") ? (
        <>
          <Summary counts={counts} />
          <section className={panel}>
            <h2 className="text-xl font-semibold">Reconciliation decisions</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Product</th>
                    <th>Decision</th>
                    <th>Existing product</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr className="border-t" key={x.id}>
                      <td className="py-3">{x.source_row}</td>
                      <td>{x.proposed_name}</td>
                      <td>
                        <Badge
                          value={x.reconciliation_decision ?? "unresolved"}
                        />
                      </td>
                      <td>{x.matched_product_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {run.status === "ready_to_commit" ? (
              <form action={commitInventoryImportAction} className="mt-5">
                <input type="hidden" name="importId" value={importId} />
                <input
                  type="hidden"
                  name="commandContextId"
                  value={commitContext?.contextId ?? ""}
                />
                <button className={primary}>Commit platform drafts</button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
      {stage === "complete" ||
      (stage === "detail" && String(run.status).startsWith("complete")) ? (
        <>
          <Summary
            counts={{
              ...counts,
              new: Number(run.created_count),
              updates: Number(run.updated_draft_count),
              revisions: Number(run.proposed_revision_count),
              matches: Number(run.matched_count),
              skipped: Number(run.skipped_count),
            }}
          />
          <section className={panel}>
            <h2 className="text-xl font-semibold">Platform Library handoff</h2>
            <p className="mt-2 text-stone-600">
              Imported products remain Platform Library drafts. They are not
              approved, orderable, or added to a workspace until separately
              adopted and reviewed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className={primary}
                href="/admin/furnishing/catalog?view=platform"
              >
                Open Platform Library
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
                href="/admin/furnishing/imports/new"
              >
                Start another import
              </Link>
              <a
                className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
                href={`/admin/furnishing/imports/${importId}/report`}
              >
                Download outcome report
              </a>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
function Summary({ counts }: { counts: Record<string, number> }) {
  return (
    <section
      aria-label="Import summary"
      className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {Object.entries(counts).map(([label, count]) => (
        <div className={panel} key={label}>
          <p className="text-xs uppercase tracking-wide text-stone-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{count}</p>
        </div>
      ))}
    </section>
  );
}

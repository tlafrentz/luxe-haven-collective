import Link from "next/link";
import { FileUp } from "lucide-react";
import {
  FurnishingHeader,
  Badge,
} from "@/components/furnishing/furnishing-navigation";
import { getInventoryImports } from "@/app/actions/furnishing-inventory-import";
export const dynamic = "force-dynamic";
export default async function Page() {
  const imports = await getInventoryImports();
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-0">
      <FurnishingHeader
        title="Inventory imports"
        description="Upload, validate, reconcile, and review governed Platform Library imports."
        current="imports"
        action={
          <Link
            href="/admin/furnishing/imports/new"
            className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white"
          >
            New import
          </Link>
        }
      />
      {imports.length === 0 ? (
        <section className="rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
          <FileUp
            className="mx-auto h-8 w-8 text-emerald-800"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">
            No inventory imports yet
          </h2>
          <p className="mt-2 text-stone-600">
            Upload a CSV or XLSX file to create governed platform product
            drafts.
          </p>
          <Link
            href="/admin/furnishing/imports/new"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold"
          >
            Import inventory
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="p-4">Import</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Rows</th>
                  <th>Created</th>
                  <th>Skipped</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((x: Record<string, unknown>) => (
                  <tr className="border-t" key={String(x.id)}>
                    <td className="p-4 font-mono text-xs">
                      {String(x.id).slice(0, 8)}
                    </td>
                    <td>
                      <strong>
                        {String(x.sanitized_filename ?? x.source_filename)}
                      </strong>
                      <br />
                      <span className="text-xs text-stone-500">
                        {String(x.source_sha256 ?? "").slice(0, 16)}…
                      </span>
                    </td>
                    <td>
                      <Badge value={String(x.status)} />
                    </td>
                    <td>{new Date(String(x.created_at)).toLocaleString()}</td>
                    <td>{String(x.total_rows)}</td>
                    <td>{String(x.created_count)}</td>
                    <td>{String(x.skipped_count)}</td>
                    <td>
                      <Link
                        className="font-semibold text-emerald-800 underline"
                        href={`/admin/furnishing/imports/${String(x.id)}`}
                      >
                        {String(x.status).startsWith("complete")
                          ? "View results"
                          : x.status === "failed"
                            ? "Review failure"
                            : "Continue"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeSpreadsheetCell } from "@/features/furnishing-studio/inventory-import";

const csv = (value: unknown) =>
  `"${escapeSpreadsheetCell(String(value ?? "")).replaceAll('"', '""')}"`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  await requireRole(["admin"]);
  const { importId } = await params,
    db = createAdminClient();
  const [run, items] = await Promise.all([
    db
      .from("furnishing_catalog_imports")
      .select("id,sanitized_filename,source_sha256,status")
      .eq("id", importId)
      .single(),
    db
      .from("furnishing_catalog_import_items")
      .select(
        "source_row,proposed_name,validation_classification,reconciliation_decision,outcome,outcome_reason,imported_product_id",
      )
      .eq("import_id", importId)
      .order("source_row"),
  ]);
  if (run.error || items.error)
    return NextResponse.json(
      { error: "IMPORT_REPORT_NOT_FOUND_OR_DENIED" },
      { status: 404 },
    );
  const lines = [
    [
      "Source row",
      "Product",
      "Validation",
      "Decision",
      "Outcome",
      "Reason",
      "Platform product",
    ]
      .map(csv)
      .join(","),
    ...(items.data ?? []).map((row) =>
      [
        row.source_row,
        row.proposed_name,
        row.validation_classification,
        row.reconciliation_decision,
        row.outcome,
        row.outcome_reason,
        row.imported_product_id,
      ]
        .map(csv)
        .join(","),
    ),
  ];
  const safeName = String(run.data.sanitized_filename ?? "inventory")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-");
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-outcomes.csv"`,
      "X-Import-Digest": String(run.data.source_sha256),
    },
  });
}

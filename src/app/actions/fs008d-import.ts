"use server";
import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { parseFs008dWorkbook } from "@/platform/commerce";

export async function importFs008dWorkbook(input: Readonly<{ file: File; sourceReference: string; correlationId: string; idempotencyKey: string }>) {
  await requireRole(["admin"]);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 25 * 1024 * 1024) throw new Error("FS008D_FILE_SIZE_INVALID");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const db = await createClient();
  const run = await db.rpc("create_fs008d_import_run", { p_source_filename: input.file.name, p_source_sha256: sha256, p_source_reference: input.sourceReference, p_correlation_id: input.correlationId, p_idempotency_key: input.idempotencyKey });
  if (run.error || !run.data) throw new Error("FS008D_IMPORT_UNAVAILABLE");
  const runResult = run.data as { id: string; status: string };
  if (runResult.status === "replayed") return runResult;
  const rows = await parseFs008dWorkbook(bytes, input.correlationId);
  let version = 1;
  for (const row of rows) {
    const result = await db.rpc("record_fs008d_import_row", { p_import_id: runResult.id, p_expected_version: version, p_sheet_name: row.sheet, p_source_row: row.sourceRow, p_outcome: row.outcome === "invalid" ? "incomplete" : row.outcome, p_formula_present: row.formulaEvidence.length > 0, p_formula_hash: row.formulaEvidence[0]?.formulaHash ?? null, p_cached_value: row.formulaEvidence[0]?.cachedValue ?? null, p_canonical_value: row.canonicalExtendedCost ?? null, p_validation_reasons: row.reasons, p_raw_source: { productId: row.productId, offerUrl: row.offerUrl }, p_correlation_id: input.correlationId, p_idempotency_key: `${input.idempotencyKey}:${row.sourceRow}` });
    if (result.error) throw new Error("FS008D_IMPORT_ROW_UNAVAILABLE");
    version += 1;
  }
  return { ...runResult, rows: rows.length, sha256 };
}

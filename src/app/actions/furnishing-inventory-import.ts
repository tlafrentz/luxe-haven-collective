"use server";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";
import {
  detectInventoryFile,
  parseCsv,
  parseXlsx,
  proposeMapping,
  sanitizeFilename,
  validateRows,
  type Mapping,
  type ParsedInventory,
} from "@/features/furnishing-studio/inventory-import";

const BUCKET = "furnishing-import-sources";
const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
async function admin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
async function parse(
  type: "csv" | "xlsx",
  bytes: Uint8Array,
  delimiter?: string,
) {
  return type === "csv"
    ? parseCsv(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        delimiter,
      )
    : parseXlsx(bytes);
}
async function loadSource(importId: string) {
  const { db } = await admin();
  const { data: run, error } = await db
    .from("furnishing_catalog_imports")
    .select("*")
    .eq("id", importId)
    .single();
  if (error || !run?.storage_path) throw new Error("IMPORT_NOT_FOUND");
  const downloaded = await db.storage.from(BUCKET).download(run.storage_path);
  if (downloaded.error || !downloaded.data)
    throw new Error("IMPORT_STORAGE_UNAVAILABLE");
  return {
    db,
    run,
    bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
  };
}
async function persistSheet(
  importId: string,
  parsed: ParsedInventory,
  sheetName: string,
) {
  const { db } = await admin();
  const sheet = parsed.sheets.find(
    (x) => x.name === sheetName && !x.hidden && !x.structuralError,
  );
  if (!sheet) throw new Error("IMPORT_SHEET_INVALID");
  const mapping = proposeMapping(sheet);
  await db
    .from("furnishing_catalog_import_items")
    .delete()
    .eq("import_id", importId);
  const rows = sheet.rows.map((cells, index) => ({
    import_id: importId,
    source_sheet: sheet.name,
    source_row: index + sheet.headerRow + 1,
    source_item: cells[0] ?? `Row ${index + 2}`,
    proposed_name: cells[0] ?? `Row ${index + 2}`,
    review_action: "review",
    validation_issues: [],
    raw_source: Object.fromEntries(
      sheet.columns.map((column, i) => [column.id, cells[i] ?? ""]),
    ),
    source_values: Object.fromEntries(
      sheet.columns.map((column, i) => [column.id, cells[i] ?? ""]),
    ),
    source_row_digest: createHash("sha256")
      .update(JSON.stringify(cells))
      .digest("hex"),
  }));
  if (rows.length) {
    const inserted = await db
      .from("furnishing_catalog_import_items")
      .insert(rows);
    if (inserted.error) throw new Error("IMPORT_ROWS_PERSIST_FAILED");
  }
  const updated = await db
    .from("furnishing_catalog_imports")
    .update({
      selected_sheet: sheet.name,
      column_mapping: mapping,
      total_rows: sheet.rowCount,
      status: "mapping_required",
      parsing_configuration: {
        headerRow: sheet.headerRow,
        delimiter: parsed.type === "csv" ? "detected" : null,
        columns: sheet.columns,
      },
      mapping_version: 0,
      validation_version: 0,
      reconciliation_version: 0,
      optimistic_version: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);
  if (updated.error) throw new Error("IMPORT_PARSE_PERSIST_FAILED");
}

export async function startInventoryImportAction(formData: FormData) {
  const { user, db } = await admin();
  const context = await resolveFurnishingCommandContext(
    value(formData, "commandContextId"),
    { commandType: "catalog.import.parse", targetType: "workspace" },
  );
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("IMPORT_FILE_REQUIRED");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    type = detectInventoryFile(file.name, file.type, bytes),
    digest = createHash("sha256").update(bytes).digest("hex"),
    importId = randomUUID(),
    safe = sanitizeFilename(file.name),
    storagePath = `${context.workspaceId}/${importId}/${digest}.${type}`;
  const parsed = await parse(type, bytes);
  const visible = parsed.sheets.filter((x) => !x.hidden && !x.structuralError);
  const duplicate = await db
    .from("furnishing_catalog_imports")
    .select("id,status")
    .eq("organization_id", context.workspaceId)
    .eq("source_sha256", digest)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const upload = await db.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType:
      type === "csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,
  });
  if (upload.error) throw new Error("IMPORT_STORAGE_UNAVAILABLE");
  const inserted = await db.from("furnishing_catalog_imports").insert({
    id: importId,
    workspace_id: context.workspaceId,
    organization_id: context.workspaceId,
    source_type: type,
    source_filename: file.name,
    sanitized_filename: safe,
    source_size_bytes: file.size,
    source_sha256: digest,
    storage_path: storagePath,
    status: visible.length === 1 ? "parsed" : "parsed",
    created_by: user.id,
    correlation_id: context.correlationId,
    idempotency_key: context.idempotencyKey,
    candidate_version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    duplicate_source_import_id: duplicate.data?.id ?? null,
    workbook_metadata: {
      sheets: parsed.sheets.map((s) => ({
        name: s.name,
        hidden: s.hidden,
        headerRow: s.headerRow,
        rowCount: s.rowCount,
        structuralError: s.structuralError ?? null,
        columns: s.columns.slice(0, 20).map((column) => ({
          index: column.index,
          address: column.address,
          header: column.header,
          normalizedHeader: column.normalizedHeader,
          id: column.id,
          displayLabel: column.displayLabel,
        })),
      })),
    },
    safe_diagnostics: { externalEffects: false },
  });
  if (inserted.error) {
    await db.storage.from(BUCKET).remove([storagePath]);
    throw new Error("IMPORT_CREATE_FAILED");
  }
  if (visible.length === 1)
    await persistSheet(importId, parsed, visible[0].name);
  redirect(
    `/admin/furnishing/imports/${importId}${visible.length === 1 ? "/mapping" : ""}`,
  );
}
export async function selectInventorySheetAction(formData: FormData) {
  const importId = value(formData, "importId"),
    sheet = value(formData, "sheet");
  const { run, bytes } = await loadSource(importId);
  const parsed = await parse(run.source_type, bytes);
  await persistSheet(importId, parsed, sheet);
  redirect(`/admin/furnishing/imports/${importId}/mapping`);
}
export async function confirmInventoryMappingAction(formData: FormData) {
  const importId = value(formData, "importId"),
    { user, db } = await admin(),
    { run } = await loadSource(importId);
  const items = await db
    .from("furnishing_catalog_import_items")
    .select("source_values")
    .eq("import_id", importId)
    .order("source_row");
  if (items.error) throw new Error("IMPORT_ROWS_UNAVAILABLE");
  const columns = ((run.parsing_configuration as { columns?: unknown[] } | null)
    ?.columns ?? []) as Array<{
    index: number;
    address: string;
    header: string;
    normalizedHeader: string;
    id: string;
    displayLabel: string;
  }>;
  const headers = columns.length
    ? columns.map((column) => column.id)
    : Object.keys(items.data[0]?.source_values ?? {});
  const mapping = Object.fromEntries(
    headers.map((header) => [
      header,
      value(formData, `mapping:${header}`) || null,
    ]),
  ) as Mapping;
  const sheet = {
    name: run.selected_sheet,
    hidden: false,
    headerRow: Number(
      (run.parsing_configuration as { headerRow?: number } | null)?.headerRow ??
        1,
    ),
    rowCount: items.data.length,
    headers,
    columns: columns.length
      ? columns
      : headers.map((header, index) => ({
          index,
          address: String(index + 1),
          header,
          normalizedHeader: header.trim().toLowerCase(),
          id: header,
          displayLabel: header,
        })),
    rows: items.data.map((x) =>
      headers.map((header) =>
        String((x.source_values as Record<string, unknown>)[header] ?? ""),
      ),
    ),
  };
  const validated = validateRows(sheet, mapping);
  for (const row of validated) {
    const canonical = row.canonical;
    const updated = await db
      .from("furnishing_catalog_import_items")
      .update({
        proposed_name: canonical.name || `Row ${row.sourceRow}`,
        proposed_product_url: canonical.product_url || null,
        proposed_price_minor: canonical.price
          ? Math.round(Number(canonical.price) * 100)
          : null,
        currency: (canonical.currency || "USD").toUpperCase(),
        canonical_values: canonical,
        validation_classification: row.classification,
        validation_evidence: row.issues,
        validation_issues: row.issues.map((x) => x.code),
        review_action:
          row.classification === "blocking_error" ? "review" : "create",
      })
      .eq("import_id", importId)
      .eq("source_row", row.sourceRow);
    if (updated.error) throw new Error("IMPORT_VALIDATION_PERSIST_FAILED");
  }
  const blocking = validated.filter(
      (x) => x.classification === "blocking_error",
    ).length,
    warnings = validated.filter(
      (x) => x.classification === "valid_with_warnings",
    ).length;
  const mappingVersion = Number(run.mapping_version) + 1,
    validationVersion = Number(run.validation_version) + 1;
  await db
    .from("furnishing_catalog_imports")
    .update({
      column_mapping: mapping,
      status: blocking ? "validation_blocked" : "ready_to_reconcile",
      mapping_version: mappingVersion,
      validation_version: validationVersion,
      reconciliation_version: 0,
      blocking_count: blocking,
      warning_count: warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);
  await db.from("furnishing_import_stage_evidence").insert([
    {
      import_id: importId,
      stage: "mapping",
      version: mappingVersion,
      result: "confirmed",
      actor_id: user.id,
      correlation_id: String(run.correlation_id),
      idempotency_key: `mapping:${importId}:${mappingVersion}`,
      evidence: { mapping, sourceDigest: run.source_sha256 },
    },
    {
      import_id: importId,
      stage: "validation",
      version: validationVersion,
      result: blocking ? "blocked" : "ready",
      actor_id: user.id,
      correlation_id: String(run.correlation_id),
      idempotency_key: `validation:${importId}:${validationVersion}`,
      evidence: {
        blocking,
        warnings,
        total: validated.length,
        mappingVersion,
      },
    },
  ]);
  redirect(`/admin/furnishing/imports/${importId}/validation`);
}
export async function skipInventoryRowAction(formData: FormData) {
  const importId = value(formData, "importId"),
    itemId = value(formData, "itemId"),
    reason = value(formData, "reason");
  if (reason.length < 3) throw new Error("IMPORT_SKIP_REASON_REQUIRED");
  const { user, db } = await admin();
  await db
    .from("furnishing_catalog_import_items")
    .update({
      validation_classification: "intentionally_skipped",
      reconciliation_decision: "skip",
      review_action: "skip",
      outcome_reason: reason,
      corrected_by: user.id,
      corrected_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("import_id", importId);
  const remaining = await db
    .from("furnishing_catalog_import_items")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId)
    .eq("validation_classification", "blocking_error");
  await db
    .from("furnishing_catalog_imports")
    .update({
      blocking_count: remaining.count ?? 0,
      status:
        (remaining.count ?? 0) === 0
          ? "ready_to_reconcile"
          : "validation_blocked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);
  revalidatePath(`/admin/furnishing/imports/${importId}/validation`);
}
export async function reconcileInventoryImportAction(formData: FormData) {
  const importId = value(formData, "importId"),
    { db, run } = await loadSource(importId);
  if (run.status !== "ready_to_reconcile")
    throw new Error("IMPORT_VALIDATION_BLOCKED");
  const items = await db
    .from("furnishing_catalog_import_items")
    .select("id,canonical_values,validation_classification")
    .eq("import_id", importId);
  for (const item of items.data ?? []) {
    if (item.validation_classification === "intentionally_skipped") continue;
    const c = item.canonical_values as Record<string, string>,
      matches = await db
        .from("furnishing_products")
        .select("id,status,revision,name,manufacturer_part_number")
        .eq("scope", "platform")
        .is("workspace_id", null)
        .eq("manufacturer_part_number", c.sku || "__none__")
        .limit(2);
    const match = matches.data?.[0];
    await db
      .from("furnishing_catalog_import_items")
      .update(
        match
          ? {
              matched_product_id: match.id,
              expected_product_revision: match.revision,
              reconciliation_decision:
                match.status === "approved"
                  ? "propose_revision"
                  : match.status === "draft"
                    ? "update_draft"
                    : "unresolved",
              review_action:
                match.status === "approved"
                  ? "propose_revision"
                  : match.status === "draft"
                    ? "update_draft"
                    : "unresolved",
              validation_classification:
                matches.data?.length === 1
                  ? "existing_product_match"
                  : "ambiguous_match",
              reconciliation_evidence: {
                rule: "normalized_retailer_sku",
                matches: matches.data?.map((x) => x.id),
              },
            }
          : {
              reconciliation_decision: "create",
              review_action: "create",
              reconciliation_evidence: { rule: "no_platform_match" },
            },
      )
      .eq("id", item.id);
  }
  const unresolved = await db
    .from("furnishing_catalog_import_items")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId)
    .eq("reconciliation_decision", "unresolved");
  await db
    .from("furnishing_catalog_imports")
    .update({
      status:
        (unresolved.count ?? 0) > 0 ? "ready_to_reconcile" : "ready_to_commit",
      reconciliation_version: Number(run.reconciliation_version) + 1,
      unresolved_count: unresolved.count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);
  redirect(`/admin/furnishing/imports/${importId}/reconciliation`);
}
export async function commitInventoryImportAction(formData: FormData) {
  const importId = value(formData, "importId"),
    { user, db } = await admin();
  const context = await resolveFurnishingCommandContext(
    value(formData, "commandContextId"),
    { commandType: "catalog.import.apply", targetType: "import" },
  );
  if (context.targetId !== importId) throw new Error("IMPORT_CONTEXT_MISMATCH");
  const run = await db
    .from("furnishing_catalog_imports")
    .select("optimistic_version,workspace_id")
    .eq("id", importId)
    .single();
  if (run.error || run.data.workspace_id !== context.workspaceId)
    throw new Error("IMPORT_SCOPE_DENIED");
  const result = await db.rpc(
    "commit_furnishing_inventory_import" as never,
    {
      p_input: {
        actor_id: user.id,
        import_id: importId,
        expected_version: run.data.optimistic_version,
        correlation_id: context.correlationId,
        idempotency_key: context.idempotencyKey,
      },
    } as never,
  );
  if (result.error)
    throw new Error(
      result.error.message.match(/FURNISHING_IMPORT_[A-Z_]+/)?.[0] ??
        "IMPORT_COMMIT_FAILED",
    );
  redirect(`/admin/furnishing/imports/${importId}/complete`);
}
export async function getInventoryImports() {
  const { db } = await admin();
  const result = await db
    .from("furnishing_catalog_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw new Error("IMPORT_HISTORY_UNAVAILABLE");
  return result.data;
}
export async function getInventoryImport(importId: string) {
  const { db } = await admin();
  const [run, items] = await Promise.all([
    db
      .from("furnishing_catalog_imports")
      .select("*")
      .eq("id", importId)
      .single(),
    db
      .from("furnishing_catalog_import_items")
      .select("*")
      .eq("import_id", importId)
      .order("source_row")
      .limit(25000),
  ]);
  if (run.error) throw new Error("IMPORT_NOT_FOUND_OR_DENIED");
  return { run: run.data, items: items.data ?? [] };
}

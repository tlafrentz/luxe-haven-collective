import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { canonicalizeRetailerUrl } from "../../src/features/furnishing-studio/catalog";
import { normalizeOfferTarget } from "../../src/features/furnishing-studio/catalog-offer-normalization";

const url = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("LOCAL_SUPABASE_SERVICE_ROLE_KEY_REQUIRED");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function main() {
const bytes = await import("node:fs/promises").then((fs) => fs.readFile("docs/evidence/FS-008D/source/Catalog Review (1).xlsx"));
const hash = createHash("sha256").update(bytes).digest("hex");
if (hash !== "ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823") throw new Error("AUTHORITATIVE_WORKBOOK_HASH_MISMATCH");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
const sheet = workbook.getWorksheet("Catalog Review");
if (!sheet) throw new Error("CATALOG_REVIEW_SHEET_MISSING");
const cellText = (value: ExcelJS.CellValue) => {
  if (value && typeof value === "object" && "hyperlink" in value) return String(value.hyperlink ?? value.text ?? "");
  if (value && typeof value === "object" && "result" in value) return String(value.result ?? "");
  return String(value ?? "").trim();
};
const headers = (sheet.getRow(4).values as ExcelJS.CellValue[]).map((value) => cellText(value).toLowerCase());
const itemColumn = headers.indexOf("item"), linkColumn = Math.max(headers.indexOf("link"), headers.indexOf("source url")), priceColumn = Math.max(headers.indexOf("price"), headers.indexOf("unit price"));
const { data: retailers, error: retailerError } = await db.from("furnishing_retailers").select("id,name,domain").eq("status", "active");
if (retailerError || !retailers?.length) throw retailerError ?? new Error("LOCAL_CATALOG_PREREQUISITES_MISSING");
const amazon = retailers.find((row) => row.name === "Amazon");
const targets = [...retailers.flatMap((row) => row.domain ? [{ retailerId: row.id, hostname: row.domain, provenance: "retailer_domain" as const }] : []),
  ...(amazon ? [{ retailerId: amazon.id, hostname: "amzn.to", provenance: "allowlisted_alias" as const }] : [])];
const items: Record<string, unknown>[] = [];
let aliasCount = 0, reviewCount = 0;
for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber++) {
  const row = sheet.getRow(rowNumber), name = cellText(row.getCell(itemColumn).value);
  if (!name) continue;
  const offer = normalizeOfferTarget(cellText(row.getCell(linkColumn).value), targets, canonicalizeRetailerUrl);
  if (offer.status === "needs_review") reviewCount++;
  if (offer.provenance === "allowlisted_alias") aliasCount++;
  const price = Number(cellText(row.getCell(priceColumn).value));
  items.push({ source_sheet: sheet.name, source_row: rowNumber, source_item: name, proposed_name: name,
    proposed_category_id: null, proposed_room_type_id: null, proposed_retailer_id: offer.retailerId,
    proposed_product_url: offer.productUrl, proposed_price_minor: Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
    duplicate_product_id: null, review_action: offer.status === "needs_review" ? "review" : "create", matched_product_id: null,
    validation_issues: offer.status === "needs_review" ? ["OFFER_TARGET_INVALID: retailer could not be resolved from the allowlisted hostname"] : [],
    raw_source: { offerNormalization: { version: "FS-008G-C7", status: offer.status, hostname: offer.hostname, provenance: offer.provenance, retailerId: offer.retailerId, productUrl: offer.productUrl } } });
}
if (items.length !== 110 || aliasCount !== 11 || reviewCount !== 1) throw new Error(`NORMALIZED_ROW_SET_INVALID:${items.length}:${aliasCount}:${reviewCount}`);
const email = `fs008g-c7-${randomUUID()}@local.invalid`;
const { data: created, error: userError } = await db.auth.admin.createUser({ email, email_confirm: true });
if (userError || !created.user) throw userError ?? new Error("LOCAL_ADMIN_CREATE_FAILED");
await db.from("profiles").update({ role: "admin" }).eq("id", created.user.id).throwOnError();
const { data: owner } = await db.from("owners").insert({ profile_id: created.user.id, company_name: "FS008G C7 local apply" }).select("id").single().throwOnError();
const correlationId = randomUUID(), parseKey = `fs008g-c7-local-parse-${randomUUID()}`;
const { data: committed, error: commitError } = await db.rpc("commit_fs008g_c3_catalog_import", { p_input: { actorId: created.user.id, workspaceId: owner.id, sourceFilename: "Catalog Review (1).xlsx", sourceSha256: hash, correlationId, idempotencyKey: parseKey }, p_items: items });
if (commitError || !committed) throw commitError ?? new Error("LOCAL_COMMIT_FAILED");
const importId = String((committed as { id: string }).id), applyKey = `fs008g-c7-local-apply-${randomUUID()}`;
const { data: applied, error: applyError } = await db.rpc("apply_fs008g_c7_catalog_import", { p_input: { actorId: created.user.id, importId, workspaceId: owner.id, correlationId, idempotencyKey: applyKey, expectedVersion: 0 } });
if (applyError || !applied) throw applyError ?? new Error("LOCAL_APPLY_FAILED");
const [{ count: products }, { count: offers }, { data: replay, error: replayError }] = await Promise.all([
  db.from("furnishing_products").select("*", { count: "exact", head: true }).eq("source_import_id", importId),
  db.from("furnishing_product_offers").select("*", { count: "exact", head: true }).eq("source_import_id", importId),
  db.rpc("apply_fs008g_c7_catalog_import", { p_input: { actorId: created.user.id, importId, workspaceId: owner.id, correlationId, idempotencyKey: applyKey, expectedVersion: 0 } }),
]);
if (products !== 109 || offers !== 109 || replayError || (replay as { status: string })?.status !== "replayed") throw new Error(`LOCAL_RECONCILIATION_FAILED:${products}:${offers}`);
process.stdout.write(JSON.stringify({ workbookHash: hash, rows: items.length, allowlistedAliasRows: aliasCount, excludedReviewRows: reviewCount, importId, apply: applied, replay: (replay as { status: string }).status, products, offers, automaticProductApprovals: 0, downstreamEffects: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

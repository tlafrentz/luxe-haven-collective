"use server";
import "server-only";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";
import { assertFurnishingCatalogMutationAllowed } from "./furnishing-catalog-activation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { resolveFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeRetailerUrl,
  minorUnits,
  normalizeCatalogName,
} from "@/features/furnishing-studio";
import { normalizeOfferTarget } from "@/features/furnishing-studio/catalog-offer-normalization";

async function catalogAdmin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();

export async function getFurnishingCatalog(
  filters: Readonly<Record<string, string | undefined>> = {},
) {
  const { db } = await catalogAdmin();
  let products = db
    .from("furnishing_products")
    .select(
      "*,furnishing_product_categories(id,name,slug,group_name),furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(id,name,domain)),furnishing_product_room_compatibility(room_type_id),furnishing_product_media(id,source_url,storage_path,alt_text,is_primary,sort_order)",
    )
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(50);
  const view = filters.view ?? (filters.workspace && /^[0-9a-f-]{36}$/i.test(filters.workspace) ? "workspace" : "platform");
  if (view === "workspace") {
    products = products.eq("scope", "workspace");
    if (filters.workspace && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(filters.workspace)) products = products.eq("workspace_id", filters.workspace);
  } else if (view === "platform") products = products.eq("scope", "platform");
  else if (view === "review") products = products.in("status", ["draft", "in_review"]);
  else if (view === "retired") products = products.in("status", ["discontinued", "archived"]);
  if (filters.q) products = products.or(`name.ilike.%${filters.q.replaceAll("%", "")}%,brand.ilike.%${filters.q.replaceAll("%", "")}%,manufacturer_part_number.ilike.%${filters.q.replaceAll("%", "")}%`);
  if (filters.status) products = products.eq("status", filters.status);
  if (filters.scope) products = products.eq("scope", filters.scope);
  if (filters.category) products = products.eq("category_id", filters.category);
  if (filters.retailer) products = products.eq("furnishing_product_offers.retailer_id", filters.retailer);
  const [productRows, categories, retailers, roomTypes, imports] =
    await Promise.all([
      products,
      db
        .from("furnishing_product_categories")
        .select("*")
        .eq("status", "active")
        .order("sort_order"),
      db.from("furnishing_retailers").select("*").order("name"),
      db
        .from("furnishing_room_types")
        .select("*")
        .eq("status", "active")
        .order("sort_order"),
      db
        .from("furnishing_catalog_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  const error = [productRows, categories, retailers, roomTypes, imports].find(
    (result) => result.error,
  )?.error;
  if (error) throw new Error(error.message);
  return {
    products: productRows.data ?? [],
    categories: categories.data ?? [],
    retailers: retailers.data ?? [],
    roomTypes: roomTypes.data ?? [],
    imports: imports.data ?? [],
  };
}

export async function getFurnishingProduct(productId: string) {
  const { db } = await catalogAdmin();
  const [
    { data: product, error },
    { data: categories },
    { data: retailers },
    { data: roomTypes },
    { data: activity },
  ] = await Promise.all([
    db
      .from("furnishing_products")
      .select(
        "*,furnishing_product_categories(id,name,slug,group_name),furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(id,name,domain)),furnishing_product_room_compatibility(room_type_id),furnishing_product_media(*),furnishing_product_specifications(*)",
      )
      .eq("id", productId)
      .single(),
    db
      .from("furnishing_product_categories")
      .select("*")
      .eq("status", "active")
      .order("sort_order"),
    db
      .from("furnishing_retailers")
      .select("*")
      .eq("status", "active")
      .order("name"),
    db
      .from("furnishing_room_types")
      .select("*")
      .eq("status", "active")
      .order("sort_order"),
    db
      .from("furnishing_catalog_activity")
      .select("event_type,occurred_at,metadata")
      .eq("product_id", productId)
      .order("occurred_at", { ascending: false })
      .limit(25),
  ]);
  if (error) throw new Error(error.message);
  return {
    product,
    categories: categories ?? [],
    retailers: retailers ?? [],
    roomTypes: roomTypes ?? [],
    activity: activity ?? [],
  };
}

export async function getFurnishingProductEditContext(productId: string) {
  const { db } = await catalogAdmin();
  const [{ data: product, error }, { data: categories }, { data: packageItems }, { data: selections }, { data: procurementItems }, { data: versions }] = await Promise.all([
    db.from("furnishing_products").select("id,name,description,brand,category_id,color,material,finish,assembly_required,scope,workspace_id,status,revision,updated_at").eq("id", productId).single(),
    db.from("furnishing_product_categories").select("id,name,group_name").eq("status", "active").order("sort_order"),
    db.from("furnishing_room_package_items").select("id,requirement_key,room_package_version_id").eq("recommended_product_id", productId).limit(100),
    db.from("furnishing_product_selections").select("id,furnishing_plan_id,selection_status,furnishing_plans!inner(project_id,furnishing_projects!inner(id,name,workspace_id))").eq("product_id", productId).limit(100),
    db.from("furnishing_procurement_items").select("id,project_id,status").eq("product_id", productId).limit(100),
    db.from("furnishing_product_versions").select("id,version,lifecycle_status,base_version,change_reason,product_snapshot,created_at,created_by,approved_at").eq("product_id", productId).order("version", { ascending: false }).limit(25),
  ]);
  if (error || !product) throw new Error("CATALOG_PRODUCT_NOT_FOUND");
  const projects = new Map<string,string>();
  for (const selection of selections ?? []) { const project = (selection.furnishing_plans as unknown as { furnishing_projects?: { id?: string; name?: string } })?.furnishing_projects; if (project?.id) projects.set(project.id, project.name ?? "Design workspace"); }
  const projectIds = [...projects.keys()];
  const { data: budgets } = projectIds.length ? await db.from("furnishing_budgets").select("id,project_id,status,target_amount_minor,currency").in("project_id", projectIds) : { data: [] };
  return { product, categories: categories ?? [], usage: { packageItems: packageItems ?? [], designWorkspaces: [...projects].map(([id,name])=>({id,name})), budgets: budgets ?? [], procurementItems: procurementItems ?? [] }, versions: versions ?? [] };
}

export async function createFurnishingProductAction(formData: FormData) {
  assertFurnishingActivationMutationDisabled();
  const { user, db } = await catalogAdmin();
  const scope = text(formData, "scope") === "workspace" ? "workspace" : "platform";
  let workspaceId: string | null = null;
  if (scope === "workspace") {
    const context = await resolveFurnishingCommandContext(text(formData, "commandContextId"), { commandType: "catalog.product.create", targetType: "workspace" });
    workspaceId = context.workspaceId;
    await assertFurnishingCatalogMutationAllowed(workspaceId);
  }
  const name = text(formData, "name"),
    categoryId = text(formData, "categoryId");
  if (!name || !categoryId) throw new Error("PRODUCT_NAME_CATEGORY_REQUIRED");
  const { data: possible } = await db
    .from("furnishing_products")
    .select("id,name,brand,manufacturer_part_number")
    .ilike("name", name)
    .limit(5);
  if (
    (possible ?? []).some(
      (row) => normalizeCatalogName(row.name) === normalizeCatalogName(name),
    ) &&
    formData.get("createAnyway") !== "true"
  )
    throw new Error("PRODUCT_DUPLICATE_REVIEW_REQUIRED");
  const { data: product, error } = await db
    .from("furnishing_products")
    .insert({
      workspace_id: workspaceId,
      scope,
      name,
      description: text(formData, "description") || null,
      product_type: text(formData, "productType") || "furnishing",
      category: text(formData, "categoryLabel") || "Catalog",
      category_id: categoryId,
      subcategory: text(formData, "subcategory") || null,
      brand: text(formData, "brand") || null,
      manufacturer_part_number:
        text(formData, "manufacturerPartNumber") || null,
      status: "draft",
      tags: formData.getAll("tags").map(String),
      style_tags: formData.getAll("styleTags").map(String),
      durability_type: text(formData, "durabilityType") || "durable",
      replenishment_type: text(formData, "replenishmentType") || "one_time",
      purchase_unit: text(formData, "purchaseUnit") || "each",
      units_per_purchase: Number(formData.get("unitsPerPurchase")) || 1,
      usable_unit: text(formData, "usableUnit") || "item",
      hospitality_attributes: formData
        .getAll("hospitalityAttributes")
        .map(String),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const rooms = formData.getAll("rooms").map(String);
  if (rooms.length)
    await db
      .from("furnishing_product_room_compatibility")
      .insert(
        rooms.map((room) => ({ product_id: product.id, room_type_id: room })),
      );
  await db.from("furnishing_catalog_activity").insert({
    workspace_id: workspaceId,
    product_id: product.id,
    event_type: "furnishing_product_created",
    actor_id: user.id,
    metadata: {},
  });
  revalidatePath("/admin/furnishing/catalog");
  redirect(`/admin/furnishing/catalog/${product.id}${workspaceId ? `?workspace=${workspaceId}` : ""}`);
}

export async function createProductOfferAction(formData: FormData) {
  assertFurnishingActivationMutationDisabled();
  const { user, db } = await catalogAdmin();
  const productId = text(formData, "productId"),
    retailerId = text(formData, "retailerId"),
    rawUrl = text(formData, "productUrl");
  if (!productId || !retailerId || !rawUrl)
    throw new Error("OFFER_REQUIRED_FIELDS_MISSING");
  const productUrl = canonicalizeRetailerUrl(rawUrl),
    listed = text(formData, "listedPrice"),
    shipping = text(formData, "shippingPrice");
  const { data: offer, error } = await db
    .from("furnishing_product_offers")
    .insert({
      product_id: productId,
      retailer_id: retailerId,
      retailer_product_id: text(formData, "retailerProductId") || null,
      sku: text(formData, "sku") || null,
      product_url: productUrl,
      affiliate_url: text(formData, "affiliateUrl") || null,
      listed_price_minor: listed ? minorUnits(listed).amountMinor : null,
      shipping_price_minor: shipping ? minorUnits(shipping).amountMinor : null,
      availability: text(formData, "availability") || "unknown",
      notes: text(formData, "notes") || null,
      last_verified_at: new Date().toISOString(),
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("furnishing_catalog_activity").insert({
    product_id: productId,
    offer_id: offer.id,
    event_type: "product_offer_created",
    actor_id: user.id,
    metadata: { retailerId },
  });
  revalidatePath(`/admin/furnishing/products/${productId}`);
}

export async function setPreferredProductOfferAction(formData: FormData) {
  assertFurnishingActivationMutationDisabled();
  const { user, db } = await catalogAdmin();
  const productId = text(formData, "productId"),
    offerId = text(formData, "offerId");
  const { data: offer } = await db
    .from("furnishing_product_offers")
    .select("id")
    .eq("id", offerId)
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!offer) throw new Error("PREFERRED_OFFER_INVALID");
  const { error } = await db
    .from("furnishing_products")
    .update({
      preferred_offer_id: offerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await db.from("furnishing_catalog_activity").insert({
    product_id: productId,
    offer_id: offerId,
    event_type: "product_preferred_offer_updated",
    actor_id: user.id,
    metadata: {},
  });
  revalidatePath(`/admin/furnishing/products/${productId}`);
}

export async function createRetailerAction(formData: FormData) {
  assertFurnishingActivationMutationDisabled();
  const { db } = await catalogAdmin();
  const name = text(formData, "name"),
    websiteUrl = canonicalizeRetailerUrl(text(formData, "websiteUrl"));
  const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
  const { error } = await db.from("furnishing_retailers").insert({
    name,
    website_url: websiteUrl,
    domain,
    supports_affiliate_links: formData.get("supportsAffiliateLinks") === "on",
    status: "active",
    notes: text(formData, "notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/furnishing/retailers");
}

const cellText = (value: ExcelJS.CellValue) => {
  if (value && typeof value === "object" && "hyperlink" in value)
    return String(value.hyperlink ?? value.text ?? "");
  if (value && typeof value === "object" && "result" in value)
    return String(value.result ?? "");
  return String(value ?? "").trim();
};
const roomForSheet = (sheet: string) =>
  ({
    "living room": "living_room",
    bedrooms: "bedroom",
    bathroom: "bathroom",
    kitchen: "kitchen",
  })[sheet.toLowerCase()] ?? "other";
const roomForLabel = (room: string) => {
  const value = normalizeCatalogName(room);
  if (value === "living room") return "living_room";
  if (value === "primary bedroom") return "primary_bedroom";
  if (/bedroom/.test(value)) return "bedroom";
  if (/bath/.test(value)) return "bathroom";
  if (/kitchen/.test(value)) return "kitchen";
  if (/dining/.test(value)) return "dining_room";
  if (/office|workspace/.test(value)) return "office";
  if (/outdoor|patio/.test(value)) return "outdoor";
  if (/entry/.test(value)) return "entry";
  if (/laundry/.test(value)) return "laundry";
  return "other";
};
const catalogHeader = (sheet: ExcelJS.Worksheet) => {
  for (
    let rowNumber = 1;
    rowNumber <= Math.min(sheet.rowCount, 20);
    rowNumber++
  ) {
    const values = sheet.getRow(rowNumber).values as ExcelJS.CellValue[];
    const names = values.map((value) => cellText(value).toLowerCase());
    const itemColumn = names.findIndex((value) => value === "item");
    const linkColumn = names.findIndex(
      (value) => value === "link" || value === "source url",
    );
    const priceColumn = names.findIndex(
      (value) => value === "price" || value === "unit price",
    );
    if (itemColumn > 0 && linkColumn > 0 && priceColumn > 0)
      return {
        rowNumber,
        itemColumn,
        linkColumn,
        priceColumn,
        roomColumn: names.findIndex((value) => value === "room"),
        quantityColumn: names.findIndex((value) => value === "quantity"),
        extendedCostColumn: names.findIndex(
          (value) => value === "extended cost",
        ),
      };
  }
  return null;
};
const categoryHint = (name: string) => {
  const value = normalizeCatalogName(name);
  if (/bed frame/.test(value)) return "beds-frames";
  if (/mattress/.test(value)) return "mattresses";
  if (/lamp|lighting/.test(value)) return "table-lamps";
  if (/towel/.test(value)) return "towels";
  if (/coffee|mug|kettle/.test(value)) return "coffee-beverage";
  if (/trash/.test(value)) return "trash";
  if (/curtain/.test(value)) return "curtains";
  if (/rug|mat/.test(value)) return "rugs";
  return "custom";
};

export async function startCatalogImportAction(formData: FormData) {
  const { user, db } = await catalogAdmin();
  const context = await resolveFurnishingCommandContext(text(formData, "commandContextId"), { commandType: "catalog.import.parse", targetType: "workspace" });
  const workspaceId = context.workspaceId;
  const correlationId = context.correlationId;
  const idempotencyKey = context.idempotencyKey;
  await assertFurnishingCatalogMutationAllowed(workspaceId);
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 25 * 1024 * 1024 ||
    !/\.xlsx$/i.test(file.name)
  )
    throw new Error("CATALOG_IMPORT_FILE_INVALID");
  const bytes = Buffer.from(await file.arrayBuffer());
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const rpcInput = {
    actorId: user.id,
    workspaceId,
    sourceFilename: file.name,
    sourceSha256,
    correlationId,
    idempotencyKey,
  };
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    await db.rpc(
      "fail_fs008g_c3_catalog_import" as never,
      {
        p_input: rpcInput,
        p_failure_code: "FS008G_C3_WORKBOOK_INVALID",
        p_safe_diagnostics: { stage: "xlsx_parse" },
      } as never,
    );
    throw new Error("FS008G_C3_WORKBOOK_INVALID");
  }
  const [{ data: categories }, { data: retailers }, { data: products }] =
    await Promise.all([
      db.from("furnishing_product_categories").select("id,slug"),
      db.from("furnishing_retailers").select("id,name,domain").eq("status", "active"),
      db
        .from("furnishing_products")
        .select("id,name,brand,manufacturer_part_number"),
    ]);
  const categoryBySlug = new Map(
    (categories ?? []).map((row) => [row.slug, row.id]),
  );
  const retailerRows = retailers ?? [],
    amazon = retailerRows.find((retailer) => retailer.name === "Amazon"),
    retailerTargets = [
      ...retailerRows.flatMap((retailer) => retailer.domain ? [{ retailerId: retailer.id, hostname: retailer.domain, provenance: "retailer_domain" as const }] : []),
      ...(amazon ? [{ retailerId: amazon.id, hostname: "amzn.to", provenance: "allowlisted_alias" as const }] : []),
    ],
    existing = products ?? [],
    proposals: Record<string, unknown>[] = [];
  const sheet = workbook.getWorksheet("Catalog Review");
  const mapping = sheet ? catalogHeader(sheet) : null;
  if (sheet && mapping) {
    const {
      itemColumn,
      linkColumn,
      priceColumn,
      roomColumn,
      quantityColumn,
      extendedCostColumn,
    } = mapping;
    for (
      let rowNumber = mapping.rowNumber + 1;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber),
        sourceItem = cellText(row.getCell(itemColumn).value);
      if (!sourceItem) continue;
      const rawUrl = cellText(row.getCell(linkColumn).value),
        price = Number(cellText(row.getCell(priceColumn).value)),
        quantity = Number(cellText(row.getCell(quantityColumn).value));
      const offer = normalizeOfferTarget(rawUrl, retailerTargets, canonicalizeRetailerUrl);
      const duplicate = existing.find(
        (product) =>
          normalizeCatalogName(product.name) ===
          normalizeCatalogName(sourceItem),
      );
      proposals.push({
        source_sheet: sheet.name,
        source_row: rowNumber,
        source_item: sourceItem,
        proposed_name: sourceItem,
        proposed_category_id:
          categoryBySlug.get(categoryHint(sourceItem)) ?? null,
        proposed_room_type_id:
          roomColumn > 0
            ? roomForLabel(cellText(row.getCell(roomColumn).value))
            : roomForSheet(sheet.name),
        proposed_retailer_id: offer.retailerId,
        proposed_product_url: offer.productUrl,
        proposed_price_minor:
          Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
        duplicate_product_id: duplicate?.id ?? null,
        review_action: offer.status === "needs_review" ? "review" : duplicate ? "match" : "create",
        matched_product_id: duplicate?.id ?? null,
        validation_issues: [
          ...(offer.status === "needs_review" ? ["OFFER_TARGET_INVALID: retailer could not be resolved from the allowlisted hostname"] : []),
          ...(!(price > 0) ? ["Missing price"] : []),
        ],
        raw_source: {
          item: sourceItem,
          room:
            roomColumn > 0
              ? cellText(row.getCell(roomColumn).value)
              : sheet.name,
          quantity: Number.isFinite(quantity) ? quantity : null,
          canonicalExtendedCostMinor:
            Number.isFinite(quantity) && Number.isFinite(price)
              ? Math.round(quantity * price * 100)
              : null,
          cachedExtendedCostIgnored:
            extendedCostColumn > 0 &&
            Boolean(row.getCell(extendedCostColumn).value),
          offerNormalization: {
            version: "FS-008G-C7",
            status: offer.status,
            hostname: offer.hostname,
            provenance: offer.provenance,
            retailerId: offer.retailerId,
            productUrl: offer.productUrl,
          },
        },
      });
    }
  }
  if (
    !sheet ||
    !mapping ||
    mapping.rowNumber !== 4 ||
    proposals.length !== 110 ||
    sourceSha256 !==
      "ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823"
  ) {
    const failed = await db.rpc(
      "fail_fs008g_c3_catalog_import" as never,
      {
        p_input: rpcInput,
        p_failure_code: "FS008G_C3_AUTHORITATIVE_WORKBOOK_MISMATCH",
        p_safe_diagnostics: {
          stage: "catalog_parse",
          sheetFound: Boolean(sheet),
          headerRow: mapping?.rowNumber ?? null,
          rowCount: proposals.length,
        },
      } as never,
    );
    if (failed.error || !failed.data)
      throw new Error("FS008G_C3_FAILURE_TERMINALIZATION_UNAVAILABLE");
    redirect(
      `/admin/furnishing/products/import/${(failed.data as { id: string }).id}`,
    );
  }
  const committed = await db.rpc(
    "commit_fs008g_c3_catalog_import" as never,
    { p_input: rpcInput, p_items: proposals } as never,
  );
  if (committed.error || !committed.data)
    throw new Error("FS008G_C3_ATOMIC_COMMIT_UNAVAILABLE");
  redirect(
    `/admin/furnishing/products/import/${(committed.data as { id: string }).id}`,
  );
}

export async function completeCatalogImportAction(formData: FormData) {
  const { user, db } = await catalogAdmin();
  const importId = text(formData, "importId");
  const context = await resolveFurnishingCommandContext(text(formData, "commandContextId"), { commandType: "catalog.import.apply", targetType: "import" });
  if (context.targetId !== importId) throw new Error("FS008G_CONTEXT_TARGET_MISMATCH");
  const { data: importTarget, error: importTargetError } = await db
    .from("furnishing_catalog_imports")
    .select("workspace_id,status,correlation_id,optimistic_version")
    .eq("id", importId)
    .maybeSingle();
  if (
    importTargetError ||
    !importTarget?.workspace_id ||
    !["review_required", "complete"].includes(importTarget.status)
  )
    throw new Error("CATALOG_IMPORT_REVIEW_REQUIRED");
  if (String(importTarget.workspace_id) !== context.workspaceId)
    throw new Error("FS008G_C6_TARGET_MISMATCH");
  const workspaceId = context.workspaceId;
  const correlationId = String(importTarget.correlation_id);
  const idempotencyKey = context.idempotencyKey;
  const expectedVersion = Number(importTarget.optimistic_version);
  await assertFurnishingCatalogMutationAllowed(
    String(importTarget.workspace_id),
  );
  const applied = await db.rpc("apply_fs008g_c7_catalog_import" as never, {
    p_input: {
      actorId: user.id,
      importId,
      workspaceId,
      correlationId,
      idempotencyKey,
      expectedVersion,
    },
  } as never);
  if (applied.error || !applied.data)
    throw new Error(
      applied.error?.message.match(/(?:FS008G_C7_|OFFER_)[A-Z_]+/)?.[0] ??
        "FS008G_C7_ATOMIC_APPLY_UNAVAILABLE",
    );
  revalidatePath("/admin/furnishing/products");
  redirect(`/admin/furnishing/products/import/${importId}`);
}

export async function getCatalogImport(importId: string) {
  const { db } = await catalogAdmin();
  const [{ data: catalogImport, error }, { data: items }] = await Promise.all([
    db
      .from("furnishing_catalog_imports")
      .select("*")
      .eq("id", importId)
      .single(),
    db
      .from("furnishing_catalog_import_items")
      .select(
        "*,furnishing_product_categories(name),furnishing_retailers(name)",
      )
      .eq("import_id", importId)
      .order("source_sheet")
      .order("source_row")
      .limit(500),
  ]);
  if (error) throw new Error(error.message);
  return { catalogImport, items: items ?? [] };
}

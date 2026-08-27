"use server";
import "server-only";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";
import { assertFurnishingCatalogMutationAllowed } from "./furnishing-catalog-activation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeRetailerUrl,
  minorUnits,
  normalizeCatalogName,
} from "@/features/furnishing-studio";

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
    .limit(100);
  if (filters.q) products = products.ilike("name", `%${filters.q}%`);
  if (filters.status) products = products.eq("status", filters.status);
  if (filters.scope) products = products.eq("scope", filters.scope);
  if (filters.category) products = products.eq("category_id", filters.category);
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

export async function createFurnishingProductAction(formData: FormData) {
  assertFurnishingActivationMutationDisabled();
  const { user, db } = await catalogAdmin();
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
      workspace_id: null,
      scope: "platform",
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
    product_id: product.id,
    event_type: "furnishing_product_created",
    actor_id: user.id,
    metadata: {},
  });
  revalidatePath("/admin/furnishing/products");
  redirect(`/admin/furnishing/products/${product.id}`);
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
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber++) {
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
  const workspaceId = text(formData, "workspaceId");
  await assertFurnishingCatalogMutationAllowed(workspaceId);
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 25 * 1024 * 1024 ||
    !/\.xlsx$/i.test(file.name)
  )
    throw new Error("CATALOG_IMPORT_FILE_INVALID");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const [{ data: categories }, { data: retailers }, { data: products }] =
    await Promise.all([
      db.from("furnishing_product_categories").select("id,slug"),
      db.from("furnishing_retailers").select("id,domain"),
      db
        .from("furnishing_products")
        .select("id,name,brand,manufacturer_part_number"),
    ]);
  const { data: catalogImport, error } = await db
    .from("furnishing_catalog_imports")
    .insert({
      workspace_id: workspaceId,
      source_filename: file.name,
      status: "parsing",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const categoryBySlug = new Map(
    (categories ?? []).map((row) => [row.slug, row.id]),
  );
  const retailerRows = retailers ?? [],
    existing = products ?? [],
    proposals: Record<string, unknown>[] = [];
  for (const sheet of workbook.worksheets) {
    const mapping = catalogHeader(sheet);
    if (!mapping) continue;
    const { itemColumn, linkColumn, priceColumn, roomColumn } = mapping;
    for (
      let rowNumber = mapping.rowNumber + 1;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber),
        sourceItem = cellText(row.getCell(itemColumn).value);
      if (!sourceItem) continue;
      const rawUrl = cellText(row.getCell(linkColumn).value),
        price = Number(cellText(row.getCell(priceColumn).value));
      let productUrl: string | null = null,
        domain = "";
      try {
        productUrl = rawUrl ? canonicalizeRetailerUrl(rawUrl) : null;
        domain = productUrl
          ? new URL(productUrl).hostname.replace(/^www\./, "")
          : "";
      } catch {
        productUrl = null;
      }
      const duplicate = existing.find(
        (product) =>
          normalizeCatalogName(product.name) ===
          normalizeCatalogName(sourceItem),
      );
      proposals.push({
        import_id: catalogImport.id,
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
        proposed_retailer_id:
          retailerRows.find((retailer) =>
            domain.endsWith(retailer.domain ?? "--"),
          )?.id ?? null,
        proposed_product_url: productUrl,
        proposed_price_minor:
          Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null,
        duplicate_product_id: duplicate?.id ?? null,
        review_action: duplicate ? "match" : "create",
        matched_product_id: duplicate?.id ?? null,
        validation_issues: [
          ...(!productUrl ? ["Missing or invalid URL"] : []),
          ...(!(price > 0) ? ["Missing price"] : []),
        ],
        raw_source: {
          item: sourceItem,
          room: sheet.name,
          hasQuantityOrTotal: sheet.columnCount > 3,
        },
      });
    }
  }
  if (!proposals.length) {
    await db
      .from("furnishing_catalog_imports")
      .update({ status: "failed", error_code: "CATALOG_IMPORT_NO_ROWS" })
      .eq("id", catalogImport.id)
      .eq("status", "parsing");
    await db.from("furnishing_catalog_activity").insert({
      workspace_id: workspaceId,
      import_id: catalogImport.id,
      event_type: "catalog_inventory_import_failed",
      actor_id: user.id,
      metadata: { code: "CATALOG_IMPORT_NO_ROWS" },
    });
    redirect(`/admin/furnishing/products/import/${catalogImport.id}`);
  }
  if (proposals.length)
    await db.from("furnishing_catalog_import_items").insert(proposals);
  await db
    .from("furnishing_catalog_imports")
    .update({ status: "review_required", total_rows: proposals.length })
    .eq("id", catalogImport.id);
  await db.from("furnishing_catalog_activity").insert({
    workspace_id: workspaceId,
    import_id: catalogImport.id,
    event_type: "catalog_inventory_import_started",
    actor_id: user.id,
    metadata: { rows: proposals.length },
  });
  redirect(`/admin/furnishing/products/import/${catalogImport.id}`);
}

export async function completeCatalogImportAction(formData: FormData) {
  const { user, db } = await catalogAdmin();
  const importId = text(formData, "importId");
  const { data: importTarget, error: importTargetError } = await db
    .from("furnishing_catalog_imports")
    .select("workspace_id,status")
    .eq("id", importId)
    .maybeSingle();
  if (
    importTargetError ||
    !importTarget?.workspace_id ||
    importTarget.status !== "review_required"
  )
    throw new Error("CATALOG_IMPORT_REVIEW_REQUIRED");
  await assertFurnishingCatalogMutationAllowed(String(importTarget.workspace_id));
  const { data: items, error } = await db
    .from("furnishing_catalog_import_items")
    .select("*")
    .eq("import_id", importId)
    .order("source_sheet")
    .order("source_row");
  if (error) throw new Error(error.message);
  await db
    .from("furnishing_catalog_imports")
    .update({ status: "importing" })
    .eq("id", importId);
  let created = 0,
    matched = 0,
    skipped = 0,
    failed = 0;
  for (const item of items ?? []) {
    if (item.review_action === "skip") {
      skipped++;
      continue;
    }
    try {
      let productId = item.matched_product_id as string | null;
      if (!productId) {
        const { data: product, error: productError } = await db
          .from("furnishing_products")
          .insert({
            scope: "platform",
            workspace_id: null,
            name: item.proposed_name,
            description: null,
            product_type: "catalog_item",
            category: "Imported",
            category_id: item.proposed_category_id,
            status: "draft",
            created_by: user.id,
            source_type: "xlsx",
            source_import_id: importId,
            source_sheet: item.source_sheet,
            source_row: item.source_row,
            imported_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (productError) throw productError;
        productId = product.id;
        created++;
        if (item.proposed_room_type_id)
          await db.from("furnishing_product_room_compatibility").insert({
            product_id: productId,
            room_type_id: item.proposed_room_type_id,
          });
      } else matched++;
      let offerId: string | null = null;
      if (item.proposed_product_url && item.proposed_retailer_id) {
        const { data: offer, error: offerError } = await db
          .from("furnishing_product_offers")
          .insert({
            product_id: productId,
            retailer_id: item.proposed_retailer_id,
            product_url: item.proposed_product_url,
            listed_price_minor: item.proposed_price_minor,
            availability: "unknown",
            status: "active",
            source_type: "xlsx",
            source_import_id: importId,
            source_sheet: item.source_sheet,
            source_row: item.source_row,
            imported_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (offerError) throw offerError;
        offerId = offer.id;
      }
      await db
        .from("furnishing_catalog_import_items")
        .update({ imported_product_id: productId, imported_offer_id: offerId })
        .eq("id", item.id);
    } catch {
      failed++;
    }
  }
  const status = failed
    ? created || matched
      ? "partial_success"
      : "failed"
    : "complete";
  await db
    .from("furnishing_catalog_imports")
    .update({
      status,
      created_count: created,
      matched_count: matched,
      skipped_count: skipped,
      failed_count: failed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);
  await db.from("furnishing_catalog_activity").insert({
    import_id: importId,
    event_type: failed
      ? "catalog_inventory_import_failed"
      : "catalog_inventory_import_completed",
    actor_id: user.id,
    metadata: { created, matched, skipped, failed },
  });
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

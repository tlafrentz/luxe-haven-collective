"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
async function packageAdmin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}

export async function getPackageLibrary() {
  const { db } = await packageAdmin();
  const [
    rooms,
    propertyPackages,
    requirements,
    rules,
    products,
    roomTypes,
    categories,
  ] = await Promise.all([
    db
      .from("furnishing_room_packages")
      .select(
        "*,furnishing_room_package_versions!furnishing_room_package_versions_room_package_id_fkey(id,version_number,lifecycle_status,estimated_budget_minor,furnishing_room_package_items(id))",
      )
      .order("updated_at", { ascending: false }),
    db
      .from("furnishing_packages")
      .select(
        "*,furnishing_package_versions!furnishing_package_versions_furnishing_package_id_fkey(id,version_number,lifecycle_status,estimated_budget_low_minor,estimated_budget_high_minor,furnishing_package_room_composition(id))",
      )
      .order("updated_at", { ascending: false }),
    db
      .from("furnishing_room_requirements")
      .select("*,furnishing_product_categories(name)")
      .neq("lifecycle_status", "archived")
      .order("name"),
    db
      .from("furnishing_quantity_rules")
      .select("*")
      .order("rule_type")
      .order("multiplier"),
    db
      .from("furnishing_products")
      .select(
        "id,name,status,category_id,units_per_purchase,furnishing_product_offers!furnishing_product_offers_product_id_fkey(id,status,availability,listed_price_minor,last_verified_at)",
      )
      .eq("status", "approved")
      .order("name")
      .limit(500),
    db
      .from("furnishing_room_types")
      .select("*")
      .eq("status", "active")
      .order("sort_order"),
    db
      .from("furnishing_product_categories")
      .select("*")
      .eq("status", "active")
      .order("sort_order"),
  ]);
  const error = [
    rooms,
    propertyPackages,
    requirements,
    rules,
    products,
    roomTypes,
    categories,
  ].find((x) => x.error)?.error;
  if (error) throw new Error(error.message);
  return {
    roomPackages: rooms.data ?? [],
    propertyPackages: propertyPackages.data ?? [],
    requirements: requirements.data ?? [],
    rules: rules.data ?? [],
    products: products.data ?? [],
    roomTypes: roomTypes.data ?? [],
    categories: categories.data ?? [],
  };
}

export async function getRoomPackage(packageId: string) {
  const { db } = await packageAdmin();
  const [
    { data: pkg, error },
    { data: rules },
    { data: requirements },
    { data: products },
  ] = await Promise.all([
    db
      .from("furnishing_room_packages")
      .select(
        "*,furnishing_room_package_versions!furnishing_room_package_versions_room_package_id_fkey(*,furnishing_room_package_items(*,furnishing_room_requirements(*),furnishing_products(id,name,status,units_per_purchase,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(name))),furnishing_quantity_rules(*),furnishing_package_product_alternatives(*,furnishing_products(id,name,status))))",
      )
      .eq("id", packageId)
      .single(),
    db
      .from("furnishing_quantity_rules")
      .select("*")
      .order("rule_type")
      .order("multiplier"),
    db
      .from("furnishing_room_requirements")
      .select("*")
      .neq("lifecycle_status", "archived")
      .order("name"),
    db
      .from("furnishing_products")
      .select(
        "id,name,status,furnishing_product_offers!furnishing_product_offers_product_id_fkey(id,status,availability,listed_price_minor,last_verified_at)",
      )
      .eq("status", "approved")
      .order("name")
      .limit(500),
  ]);
  if (error) throw new Error(error.message);
  return {
    pkg,
    rules: rules ?? [],
    requirements: requirements ?? [],
    products: products ?? [],
  };
}

export async function createRoomRequirementAction(formData: FormData) {
  const { user, db } = await packageAdmin();
  const name = value(formData, "name"),
    key =
      value(formData, "key") ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
  const { error } = await db.from("furnishing_room_requirements").insert({
    workspace_id: null,
    scope: "platform",
    key,
    name,
    description: value(formData, "description") || null,
    category_id: value(formData, "categoryId"),
    default_room_type: value(formData, "roomType"),
    requirement_type: value(formData, "requirementType"),
    lifecycle_status: "draft",
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/furnishing/packages/rooms/new");
}

export async function createRoomPackageAction(formData: FormData) {
  const { user, db } = await packageAdmin();
  const { data: pkg, error } = await db
    .from("furnishing_room_packages")
    .insert({
      workspace_id: null,
      scope: "platform",
      name: value(formData, "name"),
      room_type: value(formData, "roomType"),
      tier: value(formData, "tier"),
      description: value(formData, "description") || null,
      style_tags: value(formData, "styleTags")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: versionError } = await db
    .from("furnishing_room_package_versions")
    .insert({
      room_package_id: pkg.id,
      version_number: 1,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);
  await db
    .from("furnishing_room_packages")
    .update({ current_version_id: version.id })
    .eq("id", pkg.id);
  redirect(`/admin/furnishing/packages/rooms/${pkg.id}`);
}

export async function addRoomPackageItemAction(formData: FormData) {
  const { db } = await packageAdmin();
  const packageId = value(formData, "packageId"),
    versionId = value(formData, "versionId"),
    requirementId = value(formData, "requirementId");
  const { data: editableVersion } = await db
    .from("furnishing_room_package_versions")
    .select("id")
    .eq("id", versionId)
    .eq("lifecycle_status", "draft")
    .maybeSingle();
  if (!editableVersion) throw new Error("APPROVED_PACKAGE_VERSION_IMMUTABLE");
  const { data: req } = await db
    .from("furnishing_room_requirements")
    .select("key,furnishing_product_categories(name)")
    .eq("id", requirementId)
    .single();
  const { count } = await db
    .from("furnishing_room_package_items")
    .select("id", { count: "exact", head: true })
    .eq("room_package_version_id", versionId);
  const category = Array.isArray(req?.furnishing_product_categories)
    ? req.furnishing_product_categories[0]?.name
    : (
        req?.furnishing_product_categories as unknown as {
          name?: string;
        } | null
      )?.name;
  const { error } = await db.from("furnishing_room_package_items").insert({
    room_package_version_id: versionId,
    room_requirement_id: requirementId,
    requirement_key: req?.key ?? requirementId,
    category: category ?? "Other",
    quantity_rule_id: value(formData, "quantityRuleId"),
    recommended_product_id: value(formData, "productId") || null,
    required: value(formData, "priority") === "required",
    priority: value(formData, "priority"),
    substitution_policy: value(formData, "substitutionPolicy"),
    sort_order: count ?? 0,
    notes: value(formData, "notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/packages/rooms/${packageId}`);
}

export async function addProductAlternativeAction(formData: FormData) {
  const { db } = await packageAdmin();
  const packageId = value(formData, "packageId"),
    itemId = value(formData, "itemId");
  const { data: editableItem } = await db
    .from("furnishing_room_package_items")
    .select("id,furnishing_room_package_versions!inner(lifecycle_status)")
    .eq("id", itemId)
    .eq("furnishing_room_package_versions.lifecycle_status", "draft")
    .maybeSingle();
  if (!editableItem) throw new Error("APPROVED_PACKAGE_VERSION_IMMUTABLE");
  const { count } = await db
    .from("furnishing_package_product_alternatives")
    .select("id", { count: "exact", head: true })
    .eq("room_package_item_id", itemId);
  const { error } = await db
    .from("furnishing_package_product_alternatives")
    .insert({
      room_package_item_id: itemId,
      product_id: value(formData, "productId"),
      rank: (count ?? 0) + 1,
      status: "approved",
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/packages/rooms/${packageId}`);
}

export async function submitRoomPackageAction(formData: FormData) {
  const { db } = await packageAdmin();
  const packageId = value(formData, "packageId"),
    versionId = value(formData, "versionId"),
    status = value(formData, "status");
  if (!["in_review", "approved"].includes(status))
    throw new Error("PACKAGE_STATUS_INVALID");
  const { error } = await db
    .from("furnishing_room_package_versions")
    .update({
      lifecycle_status: status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", versionId);
  if (error) throw new Error(error.message);
  await db
    .from("furnishing_room_packages")
    .update({ lifecycle_status: status, updated_at: new Date().toISOString() })
    .eq("id", packageId);
  revalidatePath(`/admin/furnishing/packages/rooms/${packageId}`);
}

async function copyRoomPackageItems(
  db: ReturnType<typeof createAdminClient>,
  sourceItems: Row[],
  targetVersionId: string,
) {
  for (const [index, item] of sourceItems.entries()) {
    const alternatives =
      (item.furnishing_package_product_alternatives as Row[] | undefined) ?? [];
    const { data: newItem, error } = await db
      .from("furnishing_room_package_items")
      .insert({
        room_package_version_id: targetVersionId,
        room_requirement_id: item.room_requirement_id,
        requirement_key: item.requirement_key,
        category: item.category,
        recommended_product_id: item.recommended_product_id,
        quantity_rule_id: item.quantity_rule_id,
        required: item.required,
        priority: item.priority,
        substitution_policy: item.substitution_policy,
        sort_order: index,
        notes: item.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (alternatives.length)
      await db
        .from("furnishing_package_product_alternatives")
        .insert(
          alternatives.map((alt) => ({
            room_package_item_id: newItem.id,
            product_id: alt.product_id,
            rank: alt.rank,
            status: alt.status,
            notes: alt.notes,
          })),
        );
  }
}

export async function createNextRoomPackageVersionAction(formData: FormData) {
  const { user, db } = await packageAdmin(),
    packageId = value(formData, "packageId"),
    sourceVersionId = value(formData, "versionId");
  const { data: source, error } = await db
    .from("furnishing_room_package_versions")
    .select(
      "*,furnishing_room_package_items(*,furnishing_package_product_alternatives(*))",
    )
    .eq("id", sourceVersionId)
    .eq("room_package_id", packageId)
    .single();
  if (error || !source)
    throw new Error(error?.message ?? "PACKAGE_VERSION_NOT_FOUND");
  const { data: max } = await db
    .from("furnishing_room_package_versions")
    .select("version_number")
    .eq("room_package_id", packageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  const { data: next, error: nextError } = await db
    .from("furnishing_room_package_versions")
    .insert({
      room_package_id: packageId,
      version_number: Number(max?.version_number ?? 0) + 1,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (nextError) throw new Error(nextError.message);
  await copyRoomPackageItems(
    db,
    source.furnishing_room_package_items as Row[],
    next.id,
  );
  await db
    .from("furnishing_room_packages")
    .update({
      current_version_id: next.id,
      lifecycle_status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", packageId);
  redirect(`/admin/furnishing/packages/rooms/${packageId}`);
}

export async function duplicateRoomPackageAction(formData: FormData) {
  const { user, db } = await packageAdmin(),
    sourcePackageId = value(formData, "packageId"),
    newName = value(formData, "name");
  const { data: source, error } = await db
    .from("furnishing_room_packages")
    .select(
      "*,furnishing_room_package_versions!furnishing_room_package_versions_room_package_id_fkey(*,furnishing_room_package_items(*,furnishing_package_product_alternatives(*)))",
    )
    .eq("id", sourcePackageId)
    .single();
  if (error || !source) throw new Error(error?.message ?? "PACKAGE_NOT_FOUND");
  const sourceVersion =
    source.furnishing_room_package_versions.find(
      (version: Row) => version.id === source.current_version_id,
    ) ?? source.furnishing_room_package_versions.at(-1);
  const { data: copy, error: copyError } = await db
    .from("furnishing_room_packages")
    .insert({
      workspace_id: source.workspace_id,
      scope: source.scope,
      name: newName || `Copy of ${source.name}`,
      room_type: source.room_type,
      tier: source.tier,
      description: source.description,
      style_tags: source.style_tags,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (copyError) throw new Error(copyError.message);
  const { data: version, error: versionError } = await db
    .from("furnishing_room_package_versions")
    .insert({
      room_package_id: copy.id,
      version_number: 1,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);
  await copyRoomPackageItems(
    db,
    sourceVersion.furnishing_room_package_items as Row[],
    version.id,
  );
  await db
    .from("furnishing_room_packages")
    .update({ current_version_id: version.id })
    .eq("id", copy.id);
  redirect(`/admin/furnishing/packages/rooms/${copy.id}`);
}

export async function createPropertyPackageAction(formData: FormData) {
  const { db } = await packageAdmin();
  const tier = value(formData, "tier");
  const { data: pkg, error } = await db
    .from("furnishing_packages")
    .insert({
      name: value(formData, "name"),
      description: value(formData, "description"),
      property_type: value(formData, "propertyType"),
      style: value(formData, "style") || "custom",
      budget_tier: tier === "elevated" ? "premium" : tier,
      starting_budget: 0,
      status: "draft",
      tier,
      lifecycle_status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: ve } = await db
    .from("furnishing_package_versions")
    .insert({
      furnishing_package_id: pkg.id,
      version_number: 1,
      lifecycle_status: "draft",
      target_property_type: value(formData, "propertyType"),
      bedroom_min: Number(formData.get("bedroomMin")) || null,
      bedroom_max: Number(formData.get("bedroomMax")) || null,
      bathroom_min: Number(formData.get("bathroomMin")) || null,
      bathroom_max: Number(formData.get("bathroomMax")) || null,
      guest_min: Number(formData.get("guestMin")) || null,
      guest_max: Number(formData.get("guestMax")) || null,
    })
    .select("id")
    .single();
  if (ve) throw new Error(ve.message);
  await db
    .from("furnishing_packages")
    .update({ current_version_id: version.id })
    .eq("id", pkg.id);
  redirect(`/admin/furnishing/packages/${pkg.id}`);
}

export async function getPropertyPackage(packageId: string) {
  const { db } = await packageAdmin();
  const [{ data: pkg, error }, { data: rooms }, { data: rules }] =
    await Promise.all([
      db
        .from("furnishing_packages")
        .select(
          "*,furnishing_package_versions!furnishing_package_versions_furnishing_package_id_fkey(*,furnishing_package_room_composition(*,furnishing_room_package_versions(*,furnishing_room_packages!furnishing_room_package_versions_room_package_id_fkey(*))))",
        )
        .eq("id", packageId)
        .single(),
      db
        .from("furnishing_room_package_versions")
        .select(
          "id,version_number,lifecycle_status,furnishing_room_packages!furnishing_room_package_versions_room_package_id_fkey(id,name,room_type,tier)",
        )
        .eq("lifecycle_status", "approved"),
      db.from("furnishing_quantity_rules").select("*").order("rule_type"),
    ]);
  if (error) throw new Error(error.message);
  return { pkg, rooms: rooms ?? [], rules: rules ?? [] };
}

export async function addPropertyPackageRoomAction(formData: FormData) {
  const { db } = await packageAdmin();
  const packageId = value(formData, "packageId"),
    versionId = value(formData, "versionId"),
    roomVersionId = value(formData, "roomVersionId");
  const { data: room } = await db
    .from("furnishing_room_package_versions")
    .select(
      "furnishing_room_packages!furnishing_room_package_versions_room_package_id_fkey(room_type)",
    )
    .eq("id", roomVersionId)
    .single();
  const relation = room?.furnishing_room_packages;
  const roomType = Array.isArray(relation)
    ? relation[0]?.room_type
    : (relation as unknown as { room_type?: string } | null)?.room_type;
  const { count } = await db
    .from("furnishing_package_room_composition")
    .select("id", { count: "exact", head: true })
    .eq("furnishing_package_version_id", versionId);
  const { error } = await db
    .from("furnishing_package_room_composition")
    .insert({
      furnishing_package_version_id: versionId,
      room_package_version_id: roomVersionId,
      room_type: roomType ?? "other",
      quantity_rule_id: value(formData, "quantityRuleId"),
      composition_rule: {
        kind: value(formData, "compositionKind"),
        value: Number(formData.get("compositionValue")) || 1,
      },
      sort_order: count ?? 0,
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/packages/${packageId}`);
}

const excelText = (cell: ExcelJS.CellValue) => {
  if (cell && typeof cell === "object" && "result" in cell)
    return String(cell.result ?? "");
  if (cell && typeof cell === "object" && "text" in cell)
    return String(cell.text ?? "");
  return String(cell ?? "").trim();
};
const importRoom = (sheet: string) =>
  ({
    "living room": "living_room",
    bedrooms: "bedroom",
    bathroom: "bathroom",
    kitchen: "kitchen",
  })[sheet.toLowerCase()] ?? "other";
const proposedRule = (
  sheet: string,
  item: string,
  sourceQuantity: string,
  rules: Row[],
) => {
  const normalized = item.toLowerCase();
  let type = "fixed",
    multiplier = 1;
  if (sheet.toLowerCase() === "bedrooms") {
    type = "per_bedroom";
    multiplier =
      /nightstand|lamp/.test(normalized) || /\b2\b/.test(sourceQuantity)
        ? 2
        : 1;
  } else if (sheet.toLowerCase() === "bathroom") type = "per_bathroom";
  else if (/towel|plate|bowl|glass|mug/.test(normalized)) type = "per_guest";
  return (
    rules.find(
      (r) => r.rule_type === type && Number(r.multiplier) === multiplier,
    )?.id ?? null
  );
};
type Row = Record<string, unknown>;

export async function startPackageImportAction(formData: FormData) {
  const { user, db } = await packageAdmin();
  const file = formData.get("file"),
    sheetName = value(formData, "sheet");
  if (
    !(file instanceof File) ||
    !/\.xlsx$/i.test(file.name) ||
    file.size > 25 * 1024 * 1024
  )
    throw new Error("PACKAGE_IMPORT_FILE_INVALID");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error("PACKAGE_IMPORT_SHEET_INVALID");
  const [{ data: requirements }, { data: products }, { data: rules }] =
    await Promise.all([
      db.from("furnishing_room_requirements").select("id,name"),
      db.from("furnishing_products").select("id,name"),
      db.from("furnishing_quantity_rules").select("id,rule_type,multiplier"),
    ]);
  const { data: catalogImport, error } = await db
    .from("furnishing_package_imports")
    .insert({
      source_filename: file.name,
      source_sheet: sheet.name,
      status: "parsed",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((x) =>
      excelText(x).toLowerCase(),
    ),
    itemCol = headers.findIndex((x) => x === "item"),
    quantityCol = headers.findIndex((x) => x === "quanity" || x === "quantity"),
    totalCol = headers.findIndex((x) => x === "total");
  const proposals = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber),
      item = excelText(row.getCell(itemCol).value);
    if (!item) continue;
    const sourceQuantity =
      quantityCol > 0
        ? excelText(row.getCell(quantityCol).value)
        : totalCol > 0
          ? excelText(row.getCell(totalCol).value)
          : "";
    const norm = item.toLowerCase().replace(/[^a-z0-9]/g, "");
    const requirement = (requirements ?? []).find(
        (r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm,
      ),
      product = (products ?? []).find(
        (p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm,
      ),
      ruleId = proposedRule(
        sheet.name,
        item,
        sourceQuantity,
        (rules ?? []) as unknown as Row[],
      );
    proposals.push({
      import_id: catalogImport.id,
      source_row: rowNumber,
      source_item: item,
      source_quantity: sourceQuantity || null,
      proposed_requirement_id: requirement?.id ?? null,
      proposed_product_id: product?.id ?? null,
      proposed_quantity_rule_id: ruleId,
      review_status:
        requirement && product && ruleId ? "matched" : "requires_review",
      notes: [
        ...(!requirement ? ["New requirement will be created"] : []),
        ...(!product ? ["Catalog product unmapped"] : []),
        "Quantity interpretation requires author review",
      ],
      raw_source: { sheet: sheet.name, quantityOrFormula: sourceQuantity },
    });
  }
  if (proposals.length)
    await db.from("furnishing_package_import_items").insert(proposals);
  await db
    .from("furnishing_package_imports")
    .update({ status: "review_required" })
    .eq("id", catalogImport.id);
  redirect(`/admin/furnishing/packages/import/${catalogImport.id}`);
}

export async function getPackageImport(importId: string) {
  const { db } = await packageAdmin();
  const [{ data: catalogImport, error }, { data: items }, { data: rules }] =
    await Promise.all([
      db
        .from("furnishing_package_imports")
        .select("*")
        .eq("id", importId)
        .single(),
      db
        .from("furnishing_package_import_items")
        .select(
          "*,furnishing_room_requirements(name),furnishing_products(name),furnishing_quantity_rules(rule_type,multiplier)",
        )
        .eq("import_id", importId)
        .order("source_row"),
      db.from("furnishing_quantity_rules").select("*").order("rule_type"),
    ]);
  if (error) throw new Error(error.message);
  return { catalogImport, items: items ?? [], rules: rules ?? [] };
}

export async function completePackageImportAction(formData: FormData) {
  const { user, db } = await packageAdmin();
  const importId = value(formData, "importId"),
    name = value(formData, "name");
  const { data: catalogImport } = await db
    .from("furnishing_package_imports")
    .select("*")
    .eq("id", importId)
    .single();
  const { data: items } = await db
    .from("furnishing_package_import_items")
    .select("*")
    .eq("import_id", importId)
    .neq("review_status", "skip")
    .order("source_row");
  if (!catalogImport) throw new Error("PACKAGE_IMPORT_NOT_FOUND");
  await db
    .from("furnishing_package_imports")
    .update({ status: "importing" })
    .eq("id", importId);
  const roomType = importRoom(catalogImport.source_sheet);
  const { data: pkg, error } = await db
    .from("furnishing_room_packages")
    .insert({
      workspace_id: null,
      scope: "platform",
      name: name || `Imported ${catalogImport.source_sheet}`,
      room_type: roomType,
      tier: "custom",
      description: `Converted from ${catalogImport.source_filename}; quantity interpretations reviewed during import.`,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: ve } = await db
    .from("furnishing_room_package_versions")
    .insert({
      room_package_id: pkg.id,
      version_number: 1,
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ve) throw new Error(ve.message);
  await db
    .from("furnishing_room_packages")
    .update({ current_version_id: version.id })
    .eq("id", pkg.id);
  const { data: customCategory } = await db
    .from("furnishing_product_categories")
    .select("id")
    .eq("slug", "custom")
    .single();
  for (const [index, item] of (items ?? []).entries()) {
    let requirementId = item.proposed_requirement_id;
    if (!requirementId) {
      const key = `${roomType}_${String(item.source_item)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}`;
      const { data: req } = await db
        .from("furnishing_room_requirements")
        .insert({
          workspace_id: null,
          scope: "platform",
          key,
          name: item.source_item,
          category_id: customCategory?.id,
          default_room_type: roomType,
          requirement_type: "furnishing",
          lifecycle_status: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      requirementId = req?.id;
    }
    if (!requirementId || !item.proposed_quantity_rule_id) continue;
    await db.from("furnishing_room_package_items").insert({
      room_package_version_id: version.id,
      room_requirement_id: requirementId,
      requirement_key: String(item.source_item)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
      category: "Imported",
      quantity_rule_id: item.proposed_quantity_rule_id,
      recommended_product_id: item.proposed_product_id,
      required: true,
      priority: "required",
      substitution_policy: "allowed",
      sort_order: index,
      notes:
        "Converted from reviewed workbook source; no spreadsheet formula persisted.",
    });
  }
  await db
    .from("furnishing_package_imports")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", importId);
  redirect(`/admin/furnishing/packages/rooms/${pkg.id}`);
}

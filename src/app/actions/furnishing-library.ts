"use server";
import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { importProductFromLink, validateProductLinkUrl, detectRetailer } from "@/features/furnishing-studio/link-import";
import type { ExtractedProduct } from "@/features/furnishing-studio/link-import";

async function libraryAdmin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const typed = (error: unknown, fallback: string) =>
  String((error as { message?: unknown } | null)?.message ?? "").match(/(?:FURNISHING|CATALOG|OFFER)_[A-Z0-9_]+/)?.[0] ?? fallback;

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

const PAGE_SIZE = 24;
type Cursor = Readonly<{ updatedAt: string; id: string }>;

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed?.updatedAt === "string" && typeof parsed?.id === "string") return parsed;
  } catch {
    // fall through
  }
  return null;
}
export type LibraryFilterValue = string | readonly string[] | undefined;
export type LibraryFilters = Readonly<Record<string, LibraryFilterValue>>;
const toArray = (value: LibraryFilterValue): string[] =>
  Array.isArray(value) ? value.filter(Boolean) : typeof value === "string" && value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
const toSingle = (value: LibraryFilterValue): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

export async function getFurnishingLibrary(filters: LibraryFilters = {}) {
  const { db } = await libraryAdmin();
  const roomIds = toArray(filters.room);
  const styleIds = toArray(filters.style);
  const retailerIds = toArray(filters.retailer);
  const q = toSingle(filters.q);
  const category = toSingle(filters.category);
  const availability = toSingle(filters.availability);
  const includeArchived = availability === "archived" || toSingle(filters.status) === "archived";

  let query = db
    .from("furnishing_products")
    .select(
      "*,furnishing_product_categories(id,name,slug,group_name),furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(id,name,domain)),furnishing_product_room_compatibility(room_type_id),furnishing_product_style_tags(style_tag_id),furnishing_product_media(id,source_url,storage_path,alt_text,is_primary,sort_order)",
    )
    .eq("scope", "platform")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  query = includeArchived ? query.eq("status", "archived") : query.neq("status", "archived");

  if (q) {
    const term = q.replaceAll("%", "");
    query = query.or(
      `name.ilike.%${term}%,brand.ilike.%${term}%,manufacturer_part_number.ilike.%${term}%,tags.cs.{${term}}`,
    );
  }
  if (category) query = query.eq("category_id", category);
  if (roomIds.length) query = query.in("furnishing_product_room_compatibility.room_type_id", roomIds);
  if (styleIds.length) query = query.in("furnishing_product_style_tags.style_tag_id", styleIds);
  if (retailerIds.length) query = query.in("furnishing_product_offers.retailer_id", retailerIds);
  if (availability && availability !== "archived") {
    query = query.eq("furnishing_product_offers.availability", availability);
  }

  const cursor = decodeCursor(toSingle(filters.cursor));
  if (cursor) {
    query = query.or(
      `updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`,
    );
  }

  const [productRows, categories, retailers, roomTypes, styleTags] = await Promise.all([
    query,
    db.from("furnishing_product_categories").select("*").eq("status", "active").order("sort_order"),
    db.from("furnishing_retailers").select("*").order("name"),
    db.from("furnishing_room_types").select("*").eq("status", "active").order("sort_order"),
    db.from("furnishing_style_tags").select("*").eq("status", "active").order("sort_order"),
  ]);
  const error = [productRows, categories, retailers, roomTypes, styleTags].find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  const products = productRows.data ?? [];
  const last = products[products.length - 1] as { updated_at?: string; id?: string } | undefined;
  const nextCursor =
    products.length === PAGE_SIZE && last?.updated_at && last.id
      ? encodeCursor({ updatedAt: last.updated_at, id: last.id })
      : null;
  return {
    products,
    categories: categories.data ?? [],
    retailers: retailers.data ?? [],
    roomTypes: roomTypes.data ?? [],
    styleTags: styleTags.data ?? [],
    nextCursor,
  };
}

export async function getLibraryTaxonomy() {
  const { db } = await libraryAdmin();
  const [{ data: categories }, { data: retailers }, { data: roomTypes }, { data: styleTags }] = await Promise.all([
    db.from("furnishing_product_categories").select("*").eq("status", "active").order("sort_order"),
    db.from("furnishing_retailers").select("*").eq("status", "active").order("name"),
    db.from("furnishing_room_types").select("*").eq("status", "active").order("sort_order"),
    db.from("furnishing_style_tags").select("*").eq("status", "active").order("sort_order"),
  ]);
  return {
    categories: categories ?? [],
    retailers: retailers ?? [],
    roomTypes: roomTypes ?? [],
    styleTags: styleTags ?? [],
  };
}

export async function getFurnishingLibraryProduct(productId: string) {
  const { db } = await libraryAdmin();
  const [{ data: product, error }, { data: categories }, { data: retailers }, { data: roomTypes }, { data: styleTags }, { data: activity }] =
    await Promise.all([
      db
        .from("furnishing_products")
        .select(
          "*,furnishing_product_categories(id,name,slug,group_name),furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(id,name,domain)),furnishing_product_room_compatibility(room_type_id),furnishing_product_style_tags(style_tag_id),furnishing_product_media(*)",
        )
        .eq("id", productId)
        .single(),
      db.from("furnishing_product_categories").select("*").eq("status", "active").order("sort_order"),
      db.from("furnishing_retailers").select("*").eq("status", "active").order("name"),
      db.from("furnishing_room_types").select("*").eq("status", "active").order("sort_order"),
      db.from("furnishing_style_tags").select("*").eq("status", "active").order("sort_order"),
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
    styleTags: styleTags ?? [],
    activity: activity ?? [],
  };
}

// ---------------------------------------------------------------------
// Add by link
// ---------------------------------------------------------------------

export type LinkValidationState = Readonly<{ ok?: boolean; message?: string }>;

export async function validateProductLinkAction(
  _previous: LinkValidationState,
  formData: FormData,
): Promise<LinkValidationState> {
  await requireRole(["admin"]);
  const url = text(formData, "url");
  const result = validateProductLinkUrl(url);
  if (result.ok) return { ok: true };
  const messages: Record<string, string> = {
    malformed: "Enter a valid product link.",
    unsupported_scheme: "That link type isn't supported. Paste a standard web link.",
    insecure_scheme: "Product links must use a secure (https://) address.",
    private_network_host: "That address can't be used as a product link.",
  };
  return { ok: false, message: messages[result.reason] ?? "Enter a valid product link." };
}

export type ExtractionState = Readonly<{
  status: "idle" | "invalid_url" | "extracted" | "manual";
  submittedUrl?: string;
  canonicalUrl?: string;
  extracted?: ExtractedProduct | null;
  retailerId?: string | null;
  message?: string;
}>;

export async function extractProductFromLinkAction(
  _previous: ExtractionState,
  formData: FormData,
): Promise<ExtractionState> {
  const { db } = await libraryAdmin();
  const url = text(formData, "url");
  const result = await importProductFromLink(url);
  if (result.status === "invalid_url") {
    return { status: "invalid_url", message: "Enter a valid, secure product link." };
  }
  let retailerId: string | null = null;
  if (result.extracted || result.canonicalUrl) {
    const { data: retailers } = await db.from("furnishing_retailers").select("id,domain").eq("status", "active");
    retailerId = detectRetailer(result.canonicalUrl, retailers ?? []);
  }
  return {
    status: result.status,
    submittedUrl: result.submittedUrl,
    canonicalUrl: result.canonicalUrl,
    extracted: result.extracted,
    retailerId,
  };
}

export type DuplicateCheckState = Readonly<{
  checked?: boolean;
  duplicate?: boolean;
  existingProductId?: string;
  existingProductName?: string;
}>;

export async function checkLibraryProductDuplicateAction(
  _previous: DuplicateCheckState,
  formData: FormData,
): Promise<DuplicateCheckState> {
  const { db } = await libraryAdmin();
  const canonicalUrl = text(formData, "canonicalUrl");
  if (!canonicalUrl) return { checked: true, duplicate: false };
  const { data } = await db
    .from("furnishing_product_offers")
    .select("product_id,furnishing_products!inner(id,name,scope,status)")
    .eq("product_url", canonicalUrl)
    .eq("furnishing_products.scope", "platform")
    .not("furnishing_products.status", "in", "(discontinued,archived)")
    .limit(1)
    .maybeSingle();
  const match = data?.furnishing_products as unknown as { id: string; name: string } | undefined;
  if (!match) return { checked: true, duplicate: false };
  return { checked: true, duplicate: true, existingProductId: match.id, existingProductName: match.name };
}

export type SaveProductState = Readonly<{
  ok?: boolean;
  status?: "created" | "replayed" | "duplicate";
  productId?: string;
  existingProductId?: string;
  existingProductName?: string;
  message?: string;
}>;

export async function createLibraryProductAction(
  _previous: SaveProductState,
  formData: FormData,
): Promise<SaveProductState> {
  try {
    const { user } = await libraryAdmin();
    const canonicalUrl = text(formData, "canonicalUrl");
    const submittedUrl = text(formData, "submittedUrl") || canonicalUrl;
    const name = text(formData, "name");
    const categoryId = text(formData, "categoryId");
    const roomTypeIds = formData.getAll("roomTypeIds").map(String).filter(Boolean);
    const styleTagIds = formData.getAll("styleTagIds").map(String).filter(Boolean);
    const forceCreate = text(formData, "forceCreate") === "true";
    if (!canonicalUrl || !name || !categoryId || roomTypeIds.length === 0) {
      return { ok: false, message: "Enter a product name, product type, and at least one room." };
    }
    const retailerId = text(formData, "retailerId") || null;
    const sku = text(formData, "sku") || null;
    const fingerprint = JSON.stringify({ actor: user.id, canonicalUrl, retailerId, sku });
    const idempotencyKey = `library-create:${createHash("sha256").update(fingerprint).digest("hex")}`;
    const client = await createClient();
    const result = await client.rpc("create_furnishing_library_product" as never, {
      p_input: {
        correlation_id: randomUUID(),
        idempotency_key: idempotencyKey,
        submitted_url: submittedUrl,
        canonical_url: canonicalUrl,
        name,
        description: text(formData, "description") || null,
        brand: text(formData, "brand") || null,
        color: text(formData, "color") || null,
        finish: text(formData, "finish") || null,
        category_id: categoryId,
        room_type_ids: roomTypeIds,
        style_tag_ids: styleTagIds,
        retailer_id: retailerId,
        retailer_product_id: text(formData, "retailerProductId") || null,
        sku,
        listed_price_minor: text(formData, "listedPriceMinor") || null,
        currency: text(formData, "currency") || "USD",
        availability: text(formData, "availability") || "unknown",
        notes: text(formData, "notes") || null,
        tags: formData.getAll("tags").map(String).filter(Boolean),
        extraction_source: text(formData, "extractionSource") || null,
        extraction_confidence: text(formData, "extractionConfidence") || null,
        extracted_snapshot: {},
        force_create: forceCreate,
      },
    } as never);
    if (result.error) throw result.error;
    const data = result.data as unknown as {
      status: "created" | "replayed" | "duplicate";
      productId?: string;
      existingProductId?: string;
      existingProductName?: string;
    };
    if (data.status === "duplicate") {
      return {
        ok: true,
        status: "duplicate",
        existingProductId: data.existingProductId,
        existingProductName: data.existingProductName,
      };
    }
    revalidatePath("/admin/furnishing/products");
    return { ok: true, status: data.status, productId: data.productId };
  } catch (error) {
    return { ok: false, message: typed(error, "CATALOG_LIBRARY_CREATE_UNAVAILABLE") };
  }
}

export async function createLibraryProductAndRedirectAction(formData: FormData) {
  const result = await createLibraryProductAction({}, formData);
  if (result.ok && result.productId) redirect(`/admin/furnishing/products/${result.productId}`);
  throw new Error(result.message ?? "CATALOG_LIBRARY_CREATE_UNAVAILABLE");
}

export type ArchiveState = Readonly<{ ok?: boolean; message?: string }>;

export async function archiveLibraryProductAction(
  _previous: ArchiveState,
  formData: FormData,
): Promise<ArchiveState> {
  try {
    await requireRole(["admin"]);
    const productId = text(formData, "productId");
    const expectedRevision = Number(text(formData, "revision"));
    const client = await createClient();
    const result = await client.rpc("archive_furnishing_library_product" as never, {
      p_input: {
        product_id: productId,
        expected_revision: expectedRevision,
        reason: text(formData, "reason") || null,
        correlation_id: randomUUID(),
        idempotency_key: `library-archive:${productId}:${expectedRevision}`,
      },
    } as never);
    if (result.error) throw result.error;
    revalidatePath(`/admin/furnishing/products/${productId}`);
    revalidatePath("/admin/furnishing/products");
    return { ok: true, message: "Product archived. Historical usage remains available." };
  } catch (error) {
    const code = typed(error, "CATALOG_LIBRARY_ARCHIVE_UNAVAILABLE");
    return { ok: false, message: code === "CATALOG_PRODUCT_VERSION_STALE" ? "This product changed. Refresh before trying again." : code };
  }
}

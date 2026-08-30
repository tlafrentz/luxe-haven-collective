"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";
import { resolveFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";
import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

export type FurnishingGovernanceState = Readonly<{
  ok?: boolean;
  code?: string;
  message?: string;
}>;

export async function adoptPlatformProductAction(formData: FormData) {
  await requireRole(["admin"]);
  const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), { commandType: "catalog.product.adopt", targetType: "workspace" });
  const client = await createClient();
  const result = await client.rpc("adopt_furnishing_platform_product" as never, { p_input: { workspace_id: context.workspaceId, source_product_id: value(formData, "sourceProductId"), workspace_overrides: {}, correlation_id: context.correlationId, idempotency_key: context.idempotencyKey } } as never);
  if (result.error) throw new Error(typed(result.error, "CATALOG_ADOPTION_FAILED"));
  const productId = String((result.data as unknown as { workspaceProductId?: string })?.workspaceProductId ?? "");
  if (!productId) throw new Error("CATALOG_ADOPTION_FAILED");
  revalidatePath("/admin/furnishing/catalog");
  redirect(`/admin/furnishing/catalog/${productId}?workspace=${context.workspaceId}`);
}

async function transitionProductReview(operation: "submit" | "changes_requested" | "retire", previous: FurnishingGovernanceState, formData: FormData): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), { commandType: `catalog.product.${operation}`, targetType: "product" });
    const client = await createClient();
    const result = await client.rpc("transition_furnishing_product_review" as never, { p_input: { workspace_id: context.workspaceId, product_id: context.targetId, operation, expected_revision: Number(value(formData, "revision")), reason: value(formData, "reason"), correlation_id: context.correlationId, idempotency_key: context.idempotencyKey } } as never);
    if (result.error) throw result.error;
    revalidatePath(`/admin/furnishing/catalog/${context.targetId}`);
    revalidatePath("/admin/furnishing/catalog");
    return { ok: true, message: operation === "submit" ? "Product submitted for review." : operation === "retire" ? "Product retired. Historical usage remains available." : "Changes requested." };
  } catch (error) { const code = typed(error, "CATALOG_REVIEW_UNAVAILABLE"); return { ok: false, code, message: code === "CATALOG_PRODUCT_VERSION_STALE" ? "This product changed. Refresh before trying again." : code }; }
}
export async function submitProductReviewAction(previous: FurnishingGovernanceState, formData: FormData) { return transitionProductReview("submit", previous, formData); }
export async function requestProductChangesAction(previous: FurnishingGovernanceState, formData: FormData) { return transitionProductReview("changes_requested", previous, formData); }
export async function retireProductAction(previous: FurnishingGovernanceState, formData: FormData) { return transitionProductReview("retire", previous, formData); }

export async function editFurnishingProductAction(_previous: FurnishingGovernanceState, formData: FormData): Promise<FurnishingGovernanceState> {
  try {
    const { user } = await requireRole(["admin"]), productId = value(formData, "productId"), expectedRevision = Number(value(formData, "revision"));
    const db = createAdminClient(), { data: product } = await db.from("furnishing_products").select("id,scope,workspace_id,status,revision").eq("id", productId).maybeSingle();
    if (!product) throw new Error("CATALOG_EDIT_TARGET_NOT_FOUND");
    let workspaceId = "", correlationId: string = randomUUID(), idempotencyKey = "";
    if (product.scope === "workspace") {
      const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), { commandType: "catalog.product.edit", targetType: "product" });
      workspaceId = context.workspaceId; correlationId = context.correlationId; idempotencyKey = context.idempotencyKey;
    } else {
      const fingerprint = JSON.stringify({ productId, expectedRevision, name: value(formData, "name"), description: value(formData, "description"), brand: value(formData, "brand"), categoryId: value(formData, "categoryId"), color: value(formData, "color"), material: value(formData, "material"), finish: value(formData, "finish"), assemblyRequired: formData.get("assemblyRequired") === "on", reason: value(formData, "reason") });
      idempotencyKey = `platform-edit:${user.id}:${createHash("sha256").update(fingerprint).digest("hex")}`;
    }
    const client = await createClient(), result = await client.rpc("edit_furnishing_product" as never, { p_input: { workspace_id: workspaceId, product_id: productId, expected_revision: expectedRevision, reason: value(formData, "reason"), changes: { name: value(formData, "name"), description: value(formData, "description") || null, brand: value(formData, "brand") || null, category_id: value(formData, "categoryId") || null, color: value(formData, "color") || null, material: value(formData, "material") || null, finish: value(formData, "finish") || null, assembly_required: formData.get("assemblyRequired") === "on" }, correlation_id: correlationId, idempotency_key: idempotencyKey } } as never);
    if (result.error) throw result.error;
    const status = String((result.data as unknown as { status?: string })?.status ?? "");
    revalidatePath(`/admin/furnishing/catalog/${productId}`); revalidatePath("/admin/furnishing/catalog");
    return { ok: true, message: status === "revision_proposed" ? "A governed revision was proposed. The approved version remains unchanged." : "Draft changes saved." };
  } catch (error) { const code = typed(error, "CATALOG_EDIT_UNAVAILABLE"); return { ok: false, code, message: code === "CATALOG_PRODUCT_VERSION_STALE" ? "This product changed after the form loaded. Refresh and review the latest version." : code }; }
}

export async function approveProductRevisionAction(_previous: FurnishingGovernanceState, formData: FormData): Promise<FurnishingGovernanceState> {
  try {
    const { user } = await requireRole(["admin"]), productId = value(formData, "productId"), proposalId = value(formData, "proposalId"), expectedRevision = Number(value(formData, "revision"));
    const db = createAdminClient(), { data: product } = await db.from("furnishing_products").select("id,scope,workspace_id").eq("id", productId).maybeSingle();
    if (!product) throw new Error("CATALOG_REVISION_TARGET_NOT_FOUND");
    let workspaceId = "", correlationId: string = randomUUID(), idempotencyKey = "";
    if (product.scope === "workspace") {
      const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), { commandType: "catalog.product.revision.approve", targetType: "product" });
      workspaceId = context.workspaceId; correlationId = context.correlationId; idempotencyKey = context.idempotencyKey;
    } else {
      idempotencyKey = `platform-revision-approval:${user.id}:${createHash("sha256").update(JSON.stringify({ productId, proposalId, expectedRevision, reason: value(formData, "reason") })).digest("hex")}`;
    }
    const client = await createClient(), result = await client.rpc("approve_furnishing_product_revision" as never, { p_input: { workspace_id: workspaceId, product_id: productId, proposal_id: proposalId, expected_revision: expectedRevision, reason: value(formData, "reason"), correlation_id: correlationId, idempotency_key: idempotencyKey } } as never);
    if (result.error) throw result.error;
    revalidatePath(`/admin/furnishing/catalog/${productId}`); revalidatePath("/admin/furnishing/catalog");
    return { ok: true, message: "Product revision approved. The previous approved version remains in history." };
  } catch (error) { const code = typed(error, "CATALOG_REVISION_APPROVAL_UNAVAILABLE"); return { ok: false, code, message: code === "CATALOG_PRODUCT_VERSION_STALE" ? "The product changed. Refresh before approving this revision." : code }; }
}

const typed = (error: unknown, fallback: string) =>
  String((error as { message?: unknown } | null)?.message ?? "").match(
    /(?:FURNISHING|CATALOG|OFFER|PACKAGE|REQUIREMENT|FS008G)_[A-Z0-9_]+/,
  )?.[0] ?? fallback;
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

async function approveControlledCatalogTarget(
  commandType: "catalog.product.approve" | "catalog.offer.approve",
  targetType: "product" | "offer",
  _previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), {
      commandType,
      targetType,
    });
    const client = await createClient();
    const result = await client.rpc("approve_controlled_furnishing_catalog_target" as never, {
      p_input: {
        workspace_id: context.workspaceId,
        target_type: targetType,
        target_id: context.targetId,
        status: "approved",
        reason: value(formData, "reason"),
        correlation_id: context.correlationId,
        idempotency_key: context.idempotencyKey,
      },
    } as never);
    if (result.error) throw result.error;
    revalidatePath(`/admin/furnishing/products/${context.targetId}`);
    revalidatePath("/admin/furnishing/products");
    return { ok: true, message: `${targetType === "product" ? "Product" : "Offer"} approved.` };
  } catch (error) {
    const code = typed(error, "CATALOG_APPROVAL_UNAVAILABLE");
    return { ok: false, code, message: code };
  }
}

export async function approveControlledProductAction(
  previous: FurnishingGovernanceState,
  formData: FormData,
) {
  return approveControlledCatalogTarget(
    "catalog.product.approve",
    "product",
    previous,
    formData,
  );
}

export async function approveControlledOfferAction(
  previous: FurnishingGovernanceState,
  formData: FormData,
) {
  return approveControlledCatalogTarget(
    "catalog.offer.approve",
    "offer",
    previous,
    formData,
  );
}

export async function submitControlledRequirementAction(
  _previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(
      value(formData, "commandContextId"),
      { commandType: "catalog.requirement.submit", targetType: "requirement" },
    );
    const client = await createClient();
    const result = await client.rpc("submit_controlled_furnishing_requirement" as never, {
      p_input: {
        workspace_id: context.workspaceId,
        target_id: context.targetId,
        idempotency_key: context.idempotencyKey,
      },
    } as never);
    if (result.error) throw result.error;
    revalidatePath("/admin/furnishing/packages/requirements");
    return { ok: true, message: "Requirement submitted for review." };
  } catch (error) {
    const code = typed(error, "REQUIREMENT_REVIEW_UNAVAILABLE");
    return { ok: false, code, message: code };
  }
}

export async function approveControlledRequirementAction(
  _previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(
      value(formData, "commandContextId"),
      { commandType: "catalog.requirement.approve", targetType: "requirement" },
    );
    const client = await createClient();
    const result = await client.rpc("approve_controlled_furnishing_catalog_target" as never, {
      p_input: {
        workspace_id: context.workspaceId,
        target_type: "requirement",
        target_id: context.targetId,
        status: "approved",
        reason: value(formData, "reason"),
        correlation_id: context.correlationId,
        idempotency_key: context.idempotencyKey,
      },
    } as never);
    if (result.error) throw result.error;
    revalidatePath("/admin/furnishing/packages/requirements");
    return { ok: true, message: "Requirement approved." };
  } catch (error) {
    const code = typed(error, "REQUIREMENT_APPROVAL_UNAVAILABLE");
    return { ok: false, code, message: code };
  }
}

export async function assignControlledOfferAction(
  _previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), {
      commandType: "catalog.offer.assign",
      targetType: "offer",
    });
    const role = value(formData, "role"), rank = Number(value(formData, "rank"));
    if (!['preferred', 'alternate'].includes(role) || !Number.isInteger(rank) || rank < 1)
      throw new Error("OFFER_ASSIGNMENT_COMMAND_INVALID");
    const db = createAdminClient();
    const { data: offer } = await db.from("furnishing_product_offers").select("id,product_id,workspace_id").eq("id", context.targetId).maybeSingle();
    if (!offer || String(offer.workspace_id) !== context.workspaceId)
      throw new Error("OFFER_ASSIGNMENT_TARGET_MISMATCH");
    const { data: approval } = await db.from("furnishing_catalog_approvals").select("id").eq("workspace_id", context.workspaceId).eq("target_type", "offer").eq("target_id", context.targetId).eq("status", "approved").order("approved_at", { ascending: false }).limit(1).maybeSingle();
    if (!approval) throw new Error("OFFER_ASSIGNMENT_NOT_APPROVED");
    const client = await createClient();
    const result = await client.rpc("assign_controlled_furnishing_offer" as never, {
      p_input: {
        workspace_id: context.workspaceId,
        product_id: offer.product_id,
        offer_id: context.targetId,
        approval_id: approval.id,
        role,
        rank,
      },
    } as never);
    if (result.error) throw result.error;
    revalidatePath(`/admin/furnishing/products/${offer.product_id}`);
    return { ok: true, message: `${role === "preferred" ? "Preferred" : "Alternate"} offer assigned.` };
  } catch (error) {
    const code = typed(error, "OFFER_ASSIGNMENT_UNAVAILABLE");
    return { ok: false, code, message: code };
  }
}

export async function createControlledAlternateOfferAction(
  _previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    const { user } = await requireRole(["admin"]);
    const context = await resolveFurnishingCommandContext(
      value(formData, "commandContextId"),
      { commandType: "catalog.offer.alternate.create", targetType: "product" },
    );
    const db = createAdminClient();
    const { data: product } = await db.from("furnishing_products")
      .select("id,workspace_id,scope")
      .eq("id", context.targetId).eq("workspace_id", context.workspaceId)
      .eq("scope", "workspace").maybeSingle();
    const { data: offers } = await db.from("furnishing_product_offers")
      .select("*").eq("product_id", context.targetId)
      .eq("workspace_id", context.workspaceId).order("created_at");
    const source = (offers as Row[] | null)?.[0];
    if (!product || !source) throw new Error("OFFER_ALTERNATE_SOURCE_INVALID");
    if ((offers?.length ?? 0) > 1)
      return { ok: true, message: "Controlled alternate offer already exists." };
    const sourceUrl = new URL(String(source.product_url));
    sourceUrl.searchParams.set("fs008g_offer", context.idempotencyKey.slice(-12));
    const { error } = await db.from("furnishing_product_offers").insert({
      workspace_id: context.workspaceId,
      product_id: context.targetId,
      retailer_id: source.retailer_id,
      retailer_product_id: source.retailer_product_id ? `${source.retailer_product_id}-alternate` : null,
      sku: source.sku ? `${source.sku}-alternate` : null,
      product_url: sourceUrl.toString(),
      listed_price_minor: source.listed_price_minor,
      shipping_price_minor: source.shipping_price_minor,
      availability: source.availability,
      notes: "Server-derived controlled alternate candidate",
      last_verified_at: source.last_verified_at,
      status: "unavailable",
    });
    if (error) throw error;
    await db.from("furnishing_catalog_activity").insert({ product_id: context.targetId, event_type: "controlled_alternate_offer_created", actor_id: user.id, metadata: { externalEffects: false } });
    revalidatePath(`/admin/furnishing/products/${context.targetId}`);
    return { ok: true, message: "Controlled alternate offer created." };
  } catch (error) {
    const code = typed(error, "OFFER_ALTERNATE_CREATE_UNAVAILABLE");
    return { ok: false, code, message: code };
  }
}

async function controlledPackageAction(
  operation: "validate" | "approve",
  kind: "room" | "property",
  previous: FurnishingGovernanceState,
  formData: FormData,
): Promise<FurnishingGovernanceState> {
  try {
    await requireRole(["admin"]);
    const targetType = kind === "room" ? "room_package_version" : "package_version";
    const context = await resolveFurnishingCommandContext(value(formData, "commandContextId"), {
      commandType: `package.${kind}.${operation}`,
      targetType,
    });
    const client = await createClient();
    if (operation === "validate") {
      const result = await client.rpc("validate_controlled_furnishing_package" as never, { p_input: { workspace_id: context.workspaceId, package_kind: kind, package_version_id: context.targetId, correlation_id: context.correlationId } } as never);
      if (result.error) throw result.error;
      const status = String((result.data as unknown as { status?: string })?.status ?? "");
      if (status !== "valid") throw new Error("PACKAGE_VALIDATION_FAILED");
      revalidatePath("/admin/furnishing/packages");
      return { ok: true, message: "Package validation passed." };
    }
    const db = createAdminClient();
    const { data: validation } = await db.from("furnishing_package_validation_runs").select("id").eq("workspace_id", context.workspaceId).eq("package_kind", kind).eq("package_version_id", context.targetId).eq("status", "valid").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!validation) throw new Error("PACKAGE_VALIDATION_REQUIRED");
    const result = await client.rpc("approve_controlled_furnishing_package" as never, { p_input: { workspace_id: context.workspaceId, package_kind: kind, package_version_id: context.targetId, validation_run_id: validation.id, reason: value(formData, "reason"), correlation_id: context.correlationId, idempotency_key: context.idempotencyKey } } as never);
    if (result.error) throw result.error;
    revalidatePath("/admin/furnishing/packages");
    return { ok: true, message: "Package approved." };
  } catch (error) {
    const code = typed(error, `PACKAGE_${operation.toUpperCase()}_UNAVAILABLE`);
    return { ok: false, code, message: code };
  }
}

export async function validateRoomPackageAction(previous: FurnishingGovernanceState, formData: FormData) { return controlledPackageAction("validate", "room", previous, formData); }
export async function approveRoomPackageAction(previous: FurnishingGovernanceState, formData: FormData) { return controlledPackageAction("approve", "room", previous, formData); }
export async function validatePropertyPackageAction(previous: FurnishingGovernanceState, formData: FormData) { return controlledPackageAction("validate", "property", previous, formData); }
export async function approvePropertyPackageAction(previous: FurnishingGovernanceState, formData: FormData) { return controlledPackageAction("approve", "property", previous, formData); }

"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";
import { resolveFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";

export type FurnishingGovernanceState = Readonly<{
  ok?: boolean;
  code?: string;
  message?: string;
}>;

const typed = (error: unknown, fallback: string) =>
  String((error as { message?: unknown } | null)?.message ?? "").match(
    /(?:FURNISHING|CATALOG|OFFER|PACKAGE|FS008G)_[A-Z0-9_]+/,
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

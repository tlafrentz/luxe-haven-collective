"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/session";
import {
  approveFs008dPackageVersion,
  createFs008dProjectCatalogSnapshot,
} from "@/platform/commerce";
import { resolveFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approveFs008dPackage(
  input: Readonly<{ contextId: string; reason: string }>,
) {
  await requireRole(["admin"]);
  const context = await resolveFurnishingCommandContext(input.contextId, {
    commandType: "package.version.approve",
    targetType: "package_version",
  });
  const admin = createAdminClient(),
    { data: version } = await admin
      .from("furnishing_package_versions")
      .select("version_number")
      .eq("id", context.targetId)
      .single();
  if (!version) throw new Error("PACKAGE_VERSION_NOT_FOUND");
  const db = await createClient();
  return approveFs008dPackageVersion(db, {
    packageVersionId: context.targetId,
    expectedVersion: Number(version.version_number),
    reason: input.reason,
    correlationId: context.correlationId,
    idempotencyKey: context.idempotencyKey,
  });
}

export async function createFs008dProjectSnapshot(
  input: Readonly<{ contextId: string }>,
) {
  await requireUser();
  const context = await resolveFurnishingCommandContext(input.contextId, {
    commandType: "project.snapshot.create",
    targetType: "project",
  });
  const db = await createClient();
  return createFs008dProjectCatalogSnapshot(db, {
    projectId: context.targetId,
    correlationId: context.correlationId,
    idempotencyKey: context.idempotencyKey,
  });
}

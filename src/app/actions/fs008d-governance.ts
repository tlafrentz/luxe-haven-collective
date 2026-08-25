"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/session";
import { approveFs008dPackageVersion, createFs008dProjectCatalogSnapshot } from "@/platform/commerce";

export async function approveFs008dPackage(input: Readonly<{ packageVersionId: string; expectedVersion: number; reason: string; correlationId: string; idempotencyKey: string }>) {
  await requireRole(["admin"]);
  const db = await createClient();
  return approveFs008dPackageVersion(db, input);
}

export async function createFs008dProjectSnapshot(input: Readonly<{ projectId: string; packageVersionId: string; snapshot: Record<string, unknown>; contentHash: string; correlationId: string; idempotencyKey: string }>) {
  await requireUser();
  const db = await createClient();
  return createFs008dProjectCatalogSnapshot(db, input);
}

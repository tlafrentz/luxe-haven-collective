"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();

export async function createProcurementReadiness(data: FormData) {
  await requireRole(["admin"]);
  const handoff = text(data, "handoffId"),
    client = await createClient();
  const { data: result, error } = await client.rpc("fsux6_create_project", {
    handoff,
    idempotency: text(data, "idempotency") || `ui-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  const projectId = String(
    (result as { project_id?: string })?.project_id ?? "",
  );
  if (!projectId) throw new Error("PROCUREMENT_PROJECT_CREATE_FAILED");
  revalidatePath("/admin/furnishing/procurement");
  redirect(`/admin/furnishing/procurement/${projectId}`);
}

export async function validateProcurementReadiness(data: FormData) {
  await requireRole(["admin"]);
  const project = text(data, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux6_validate_readiness", {
    project,
    expected: Number(text(data, "expected")),
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/procurement/${project}`);
}

export async function updateProcurementDeliveryPlan(data: FormData) {
  await requireRole(["admin"]);
  const project = text(data, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux6_update_delivery_plan", {
    project,
    expected: Number(text(data, "expected")),
    plan: {
      address: text(data, "address"),
      receiving_contact: text(data, "receivingContact"),
    },
    idempotency: text(data, "idempotency") || `delivery-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/procurement/${project}`);
}

export async function submitProcurementReview(data: FormData) {
  await requireRole(["admin"]);
  const project = text(data, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux6_submit_review", {
    project,
    expected: Number(text(data, "expected")),
    idempotency: `submit-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/procurement/${project}`);
}

export async function reviewProcurementPlan(data: FormData) {
  await requireRole(["admin"]);
  const project = text(data, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux6_review", {
    project,
    expected: Number(text(data, "expected")),
    decision: text(data, "decision"),
    reason: text(data, "reason"),
    idempotency: `review-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/procurement/${project}`);
}

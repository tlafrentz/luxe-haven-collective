"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

export async function createTrackingProject(form: FormData) {
  await requireRole(["admin"]);
  const client = await createClient();
  const { data, error } = await client.rpc("fsux7_create_project", {
    snapshot: value(form, "snapshotId"),
    idempotency: value(form, "idempotency") || `tracking-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  const id = String(
    (data as { installation_project_id?: string })?.installation_project_id ??
      "",
  );
  if (!id) throw new Error("INSTALLATION_PROJECT_CREATE_FAILED");
  revalidatePath("/admin/furnishing/installations");
  redirect(`/admin/furnishing/installations/${id}`);
}

export async function recordOrderEvidence(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId");
  const client = await createClient();
  const input = {
    planned_line_id: value(form, "plannedLineId"),
    retailer_id: value(form, "retailerId"),
    external_order_number: value(form, "externalOrderNumber"),
    ordering_party: value(form, "orderingParty"),
    order_date: value(form, "orderDate"),
    quantity: value(form, "quantity"),
    currency: "USD",
    unit_price_minor: value(form, "unitPriceMinor"),
    order_total_minor: value(form, "orderTotalMinor"),
    evidence_class: value(form, "evidenceClass"),
    evidence_reference: value(form, "evidenceReference"),
  };
  const { error } = await client.rpc("fsux7_record_order", {
    i: projectId,
    expected: Number(value(form, "expected")),
    input,
    idempotency: value(form, "idempotency") || `order-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

export async function recordReceipt(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux7_record_receipt", {
    i: projectId,
    expected: Number(value(form, "expected")),
    input: {
      order_line_id: value(form, "orderLineId"),
      quantity: value(form, "quantity"),
      disposition: value(form, "disposition"),
      evidence_class: value(form, "evidenceClass"),
    },
    idempotency: value(form, "idempotency") || `receipt-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

export async function recordInstallation(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux7_record_installation", {
    i: projectId,
    expected: Number(value(form, "expected")),
    input: {
      planned_line_id: value(form, "plannedLineId"),
      quantity: value(form, "quantity"),
      evidence_class: value(form, "evidenceClass"),
      external_actor: value(form, "externalActor"),
    },
    idempotency: value(form, "idempotency") || `installation-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

export async function recordPropertyInspection(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux7_record_inspection", {
    i: projectId,
    expected: Number(value(form, "expected")),
    input: {
      inspection_type: value(form, "inspectionType") || "property",
      result: value(form, "result") || "passed",
      template_version: "fs-ux-007-v1",
      checks: {
        controlled_browser_review: true,
        tv_mount_applicable: false,
        tv_mount_verified: true,
      },
      evidence: { evidence_class: value(form, "evidenceClass") },
      external_inspector: value(form, "externalInspector"),
      planned_line_id: value(form, "plannedLineId"),
      quantity: value(form, "quantity"),
    },
    idempotency: value(form, "idempotency") || `inspection-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

export async function approveCompletion(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux7_approve_completion", {
    i: projectId,
    expected: Number(value(form, "expected")),
    idempotency: value(form, "idempotency") || `completion-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

export async function recordMaterialInstallationCorrection(form: FormData) {
  await requireRole(["admin"]);
  const projectId = value(form, "projectId"),
    client = await createClient();
  const { error } = await client.rpc("fsux7_correct_evidence", {
    i: projectId,
    expected: Number(value(form, "expected")),
    input: {
      source_type: "installation_event",
      source_id: value(form, "sourceId"),
      material: true,
      corrected_evidence: {
        external_actor: value(form, "externalActor"),
      },
      reason: value(form, "reason"),
    },
    idempotency: value(form, "idempotency") || `correction-${randomUUID()}`,
    correlation: randomUUID(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/installations/${projectId}`);
}

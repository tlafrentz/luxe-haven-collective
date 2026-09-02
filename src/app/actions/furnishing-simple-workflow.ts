"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const number = (form: FormData, key: string) => Number(value(form, key));
const refresh = (projectId: string) => {
  revalidatePath(`/admin/furnishing/workspaces/${projectId}`);
  revalidatePath(`/dashboard/furnishing/projects/${projectId}`);
};
const key = (form: FormData) => value(form, "idempotencyKey") || randomUUID();

async function rpc(name: string, input: Record<string, unknown>) {
  await requireUser();
  const client = await createClient();
  const result = await client.rpc(name as never, input as never);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createProcurementChecklistAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_create_procurement_checklist", {
    p_project: projectId,
    p_expected: number(form, "expected"),
    p_key: key(form),
  });
  refresh(projectId);
}

export async function updateProcurementChecklistLineAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_update_procurement_line", {
    p_project: projectId,
    p_line: value(form, "lineId"),
    p_expected: number(form, "expected"),
    p_status: value(form, "status"),
    p_notes: value(form, "notes"),
    p_key: key(form),
  });
  refresh(projectId);
}

export async function startSimpleInstallationAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_start_installation", {
    p_project: projectId,
    p_expected: number(form, "expected"),
    p_key: key(form),
  });
  refresh(projectId);
}

export async function updateSimpleInstallationLineAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_update_installation_line", {
    p_project: projectId,
    p_line: value(form, "lineId"),
    p_expected: number(form, "expected"),
    p_received: number(form, "receivedQuantity"),
    p_installed: number(form, "installedQuantity"),
    p_delivery: value(form, "deliveryStatus"),
    p_installation: value(form, "installationStatus"),
    p_issue: value(form, "issueNote"),
    p_attachment: value(form, "evidenceAttachment"),
    p_accept: form.get("exceptionAccepted") === "on",
    p_key: key(form),
  });
  refresh(projectId);
}

export async function completeSimpleFurnishingProjectAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_complete_project", {
    p_project: projectId,
    p_expected: number(form, "expected"),
    p_key: key(form),
  });
  refresh(projectId);
}

export async function cancelSimpleFurnishingProjectAction(form: FormData) {
  const projectId = value(form, "projectId");
  await rpc("fsux9_cancel_project", {
    p_project: projectId,
    p_expected: number(form, "expected"),
    p_key: key(form),
  });
  refresh(projectId);
}

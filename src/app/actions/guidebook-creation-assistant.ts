"use server";
import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ControlledGuidebookPropertyService,
  controlledProvisioningGate,
} from "@/features/property-capabilities";
import {
  cancelCreationJob,
  createCreationJob,
  reviewCreationFact,
  restoreCreationRevision,
  uploadCreationSource,
} from "@/features/guidebook-creation-assistant/application";
import {
  cleanupCreationResources,
  creationContextFromJob,
  creationDependencies,
  enqueueCreationWork,
  hasCreationEntitlement,
  readCreationCapability,
} from "@/features/guidebook-creation-assistant/runtime";
const base = "/admin/guidebooks/creation-assistant";
async function admin() {
  return requireRole(["admin"]);
}
async function context(workspaceId: string, propertyId: string) {
  const { user, profile } = await admin();
  return {
    actorId: user.id,
    actorRole: profile?.role ?? "admin",
    workspaceId,
    propertyId,
    permissions: new Set(["guidebooks.manage"]),
    entitled: await hasCreationEntitlement(workspaceId, propertyId),
    correlationId: crypto.randomUUID(),
  };
}
async function assertInternal(
  workspaceId: string,
  propertyId: string,
  actorId: string,
) {
  const capability = await readCreationCapability({
    workspaceId,
    propertyId,
    actorId,
  });
  if (!capability.internalAvailable)
    throw new Error("CREATION_ASSISTANT_NOT_READY");
}
const controlledPropertySchema = z.object({
  customerAccountId: z.string().uuid(),
  entitlementId: z.string().uuid(),
  internalName: z.string().trim().min(2),
  publicDisplayName: z.string().trim().min(2),
  propertyType: z.string().trim().min(2),
  city: z.string().trim().min(2),
  region: z.string().trim().min(2),
  timeZone: z.string().trim().min(2),
  reason: z.string().trim().min(8),
  idempotencyKey: z.string().trim().min(8),
  expectedCustomerStatus: z.literal("active"),
  expectedEntitlementRevision: z.coerce.number().int().positive(),
  verificationRunId: z.string().uuid(),
});
async function provisioningAdmin() {
  const auth = await admin();
  if (!controlledProvisioningGate(auth.user.id))
    throw new Error("CONTROLLED_PROPERTY_PROVISIONING_DISABLED");
  return auth;
}
export async function provisionControlledGuidebookPropertyAction(
  form: FormData,
) {
  await provisioningAdmin();
  const parsed = controlledPropertySchema.safeParse(
    Object.fromEntries(form.entries()),
  );
  if (!parsed.success) redirect(`${base}?provisionError=invalid`);
  let propertyId: string;
  try {
    const service = new ControlledGuidebookPropertyService(
        await createClient(),
      ),
      result = await service.provision({
        ...parsed.data,
        controlledVerification: true,
      });
    propertyId = result.propertyId;
  } catch (error) {
    redirect(
      `${base}?provisionError=${encodeURIComponent(error instanceof Error ? error.message : "failed")}`,
    );
  }
  redirect(
    `${base}?workspace=${String(form.get("workspaceId") ?? "")}&property=${propertyId!}&provisioned=1`,
  );
}
export async function cleanupControlledGuidebookPropertyAction(form: FormData) {
  const { user } = await provisioningAdmin(),
    propertyId = String(form.get("propertyId") ?? ""),
    workspaceId = String(form.get("workspaceId") ?? ""),
    reason = String(form.get("reason") ?? "").trim(),
    expectedAllocationRevision = Number(form.get("expectedAllocationRevision"));
  if (
    !propertyId ||
    !workspaceId ||
    reason.length < 8 ||
    !Number.isInteger(expectedAllocationRevision)
  )
    redirect(`${base}?cleanupError=invalid`);
  const db = createAdminClient(),
    { data: jobs, error } = await db
      .from("guidebook_creation_jobs")
      .select("id,state")
      .eq("workspace_id", workspaceId)
      .eq("property_id", propertyId);
  if (error) throw error;
  for (const job of jobs ?? [])
    await cleanupCreationResources({
      jobId: String(job.id),
      workspaceId,
      actorId: user.id,
      correlationId: crypto.randomUUID(),
    });
  try {
    await new ControlledGuidebookPropertyService(await createClient()).cleanup({
      propertyId,
      reason,
      expectedAllocationRevision,
    });
  } catch (error) {
    redirect(
      `${base}?workspace=${workspaceId}&property=${propertyId}&cleanupError=${encodeURIComponent(error instanceof Error ? error.message : "failed")}`,
    );
  }
  redirect(`${base}?cleaned=1`);
}
export async function getControlledProvisioningProjection() {
  const { user } = await admin();
  if (!controlledProvisioningGate(user.id))
    return {
      available: false as const,
      customers: [],
      runs: [],
      properties: [],
    };
  const db = createAdminClient(),
    now = new Date().toISOString(),
    [
      { data: accounts },
      { data: entitlements },
      { data: runs },
      { data: properties },
    ] = await Promise.all([
      db
        .from("customer_accounts")
        .select("id,tenant_id,display_name,status")
        .eq("status", "active")
        .order("display_name"),
      db
        .from("commercial_entitlements")
        .select(
          "id,tenant_id,customer_account_id,capability_code,status,effective_until,revision,resource_scope_type,resource_scope_id",
        )
        .in("capability_code", [
          "guidebook.create",
          "guidebook.property.create_standalone",
        ])
        .eq("status", "active")
        .or(`effective_until.is.null,effective_until.gt.${now}`),
      db
        .from("production_verification_runs")
        .select("id,status,correlation_id,created_at")
        .in("status", [
          "draft",
          "ready",
          "running",
          "paused",
          "blocked",
          "awaiting_review",
        ])
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("properties")
        .select(
          "id,owner_id,name,internal_name,controlled_entitlement_id,controlled_verification_run_id,property_entitlement_allocations(id,status,revision)",
        )
        .eq("controlled_verification", true)
        .order("created_at", { ascending: false }),
    ]);
  return {
    available: true as const,
    customers: (accounts ?? []).map((account) => ({
      ...account,
      entitlements: (entitlements ?? []).filter(
        (entitlement) =>
          entitlement.tenant_id === account.tenant_id &&
          entitlement.customer_account_id === account.id,
      ),
    })),
    runs: runs ?? [],
    properties: properties ?? [],
  };
}
export async function createAssistantJobAction(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? ""),
    propertyId = String(form.get("propertyId") ?? ""),
    templateVersionId = String(form.get("templateVersionId") ?? ""),
    ctx = await context(workspaceId, propertyId);
  await assertInternal(workspaceId, propertyId, ctx.actorId);
  const { job } = await createCreationJob(creationDependencies(), ctx, {
    idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
    templateVersionId,
  });
  redirect(
    `${base}?workspace=${workspaceId}&property=${propertyId}&job=${job.id}`,
  );
}
export async function uploadAssistantSourceAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    file = form.get("file");
  if (!(file instanceof File)) throw new Error("CREATION_SOURCE_REQUIRED");
  const ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  const bytes = new Uint8Array(await file.arrayBuffer()),
    digest = await crypto.subtle.digest("SHA-256", bytes),
    hash = Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
  await uploadCreationSource(creationDependencies(), ctx, {
    jobId,
    filename: file.name,
    mediaType: file.type,
    bytes,
    integritySha256: hash,
  });
  revalidatePath(base);
}
export async function enqueueAssistantExtractionAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  await enqueueCreationWork({
    jobId,
    workspaceId: ctx.workspaceId,
    stage: "extraction",
    idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
  });
  revalidatePath(base);
}
export async function reviewAssistantFactAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  await reviewCreationFact(creationDependencies(), ctx, {
    jobId,
    factId: String(form.get("factId") ?? ""),
    status:
      String(form.get("decision")) === "rejected" ? "rejected" : "confirmed",
    correctedValue: String(form.get("correctedValue") ?? "") || undefined,
    confirmHighRisk: form.get("confirmHighRisk") === "true",
  });
  revalidatePath(base);
}
export async function enqueueAssistantGenerationAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  await enqueueCreationWork({
    jobId,
    workspaceId: ctx.workspaceId,
    stage: "generation",
    idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
    payload: { title: String(form.get("title") ?? "Guest Guide") },
  });
  revalidatePath(base);
}
export async function enqueueAssistantRegenerationAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  await enqueueCreationWork({
    jobId,
    workspaceId: ctx.workspaceId,
    stage: "section_regeneration",
    idempotencyKey: String(form.get("idempotencyKey") ?? crypto.randomUUID()),
    payload: {
      sectionId: String(form.get("sectionId") ?? ""),
      expectedRevision: Number(form.get("expectedRevision")),
    },
  });
  revalidatePath(base);
}
export async function restoreAssistantRevisionAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await assertInternal(ctx.workspaceId, ctx.propertyId, ctx.actorId);
  await restoreCreationRevision(creationDependencies(), ctx, {
    jobId,
    sourceRevision: Number(form.get("sourceRevision")),
    expectedRevision: Number(form.get("expectedRevision")),
  });
  revalidatePath(base);
}
export async function cancelAssistantJobAction(form: FormData) {
  const jobId = String(form.get("jobId") ?? ""),
    ctx = await creationContextFromJob(jobId);
  await admin();
  await cancelCreationJob(creationDependencies(), ctx, jobId);
  revalidatePath(base);
}
export async function getAssistantInternalProjection(jobId: string) {
  await admin();
  const db = createAdminClient(),
    { data: job } = await db
      .from("guidebook_creation_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
  if (!job) return null;
  const [
    { data: sources },
    { data: facts },
    { data: work },
    { data: artifacts },
  ] = await Promise.all([
    db
      .from("guidebook_creation_sources")
      .select("id,original_filename,source_type,extraction_status,byte_size")
      .eq("job_id", jobId),
    db
      .from("guidebook_creation_facts")
      .select(
        "id,category,field_key,display_value,source_location,confidence,review_status,high_risk",
      )
      .eq("job_id", jobId),
    db
      .from("guidebook_creation_work_items")
      .select("id,stage,status,attempts,safe_failure_code")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
    db
      .from("guidebook_creation_artifacts")
      .select("id,draft_revision,artifact_type,section_id,based_on_revision")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    job,
    sources: sources ?? [],
    facts: facts ?? [],
    work: work ?? [],
    artifacts: artifacts ?? [],
  };
}

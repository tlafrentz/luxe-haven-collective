"use server";
import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session";
import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import {
  cancelCreationJob,
  createCreationJob,
  reviewCreationFact,
  reviewCreationNarrativeSection,
  uploadCreationSource,
  type CreationContext,
} from "@/features/guidebook-creation-assistant/application";
import {
  creationDependencies,
  enqueueCreationWork,
  hasCreationEntitlement,
  processOneCreationWork,
  readCustomerCreationCapability,
} from "@/features/guidebook-creation-assistant/runtime";

/**
 * Customer-facing counterpart to src/app/actions/guidebook-creation-assistant.ts.
 * Calls the exact same application.ts domain functions the admin tool uses —
 * only the authorization model differs: real workspace/property membership
 * (via team-access), not requireRole(["admin"]).
 */

const RATE_LIMITS = Object.freeze({
  jobsPerWorkspacePerDay: 5,
  extractionsPerWorkspacePerDay: 15,
  generationsPerWorkspacePerDay: 15,
});

async function authorized(
  workspaceId: string,
  propertyId: string,
  permission: "guidebooks.view" | "guidebooks.manage",
) {
  const { user } = await getSessionProfile();
  if (!user) throw Object.assign(new Error("unauthorized"), { code: "GUIDEBOOK_UNAUTHORIZED" });
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  if (!evaluateWorkspacePermission(access, permission) || !evaluatePropertyAccess(access, propertyId))
    throw Object.assign(new Error("unauthorized"), { code: "GUIDEBOOK_UNAUTHORIZED" });
  return { user, access };
}

async function buildContext(workspaceId: string, propertyId: string, permission: "guidebooks.view" | "guidebooks.manage"): Promise<CreationContext> {
  const { user, access } = await authorized(workspaceId, propertyId, permission);
  return {
    actorId: user.id,
    actorRole: access.role,
    workspaceId,
    propertyId,
    permissions: new Set(["guidebooks.manage"]),
    entitled: await hasCreationEntitlement(workspaceId, propertyId, user.id),
    correlationId: crypto.randomUUID(),
  };
}

async function assertAvailable(workspaceId: string, propertyId: string, actorId: string) {
  const capability = await readCustomerCreationCapability({ workspaceId, propertyId, actorId });
  if (!capability.available) throw new Error("CREATION_ASSISTANT_NOT_AVAILABLE");
}

/**
 * Vercel Hobby plan caps cron jobs at once/day, so the customer-facing path
 * cannot rely on cron-driven queue draining the way the admin/PV-009 path
 * assumed. Trigger the work item inline right after enqueueing it instead —
 * best-effort: on failure the once-daily safety-net cron will retry it.
 */
async function triggerInlineProcessing() {
  try {
    await processOneCreationWork(`inline:${crypto.randomUUID()}`);
  } catch {
    // Swallowed: the item stays queued for the safety-net cron to retry.
  }
}

async function assertRateLimit(workspaceId: string, table: "guidebook_creation_jobs" | "guidebook_creation_work_items", ceiling: number, stage?: "extraction" | "generation") {
  const db = createAdminClient(),
    since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let query = db.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", since);
  if (stage) query = query.eq("stage", stage);
  const { count, error } = await query;
  if (error) throw error;
  if ((count ?? 0) >= ceiling) throw new Error("CREATION_RATE_LIMIT_EXCEEDED");
}

export async function getCustomerCreationCapabilityAction(workspaceId: string, propertyId: string) {
  const { user } = await authorized(workspaceId, propertyId, "guidebooks.view");
  return readCustomerCreationCapability({ workspaceId, propertyId, actorId: user.id });
}

const createJobSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  templateVersionId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8),
});
export async function createCustomerCreationJobAction(input: z.infer<typeof createJobSchema>) {
  const parsed = createJobSchema.parse(input);
  const ctx = await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  await assertAvailable(parsed.workspaceId, parsed.propertyId, ctx.actorId);
  await assertRateLimit(parsed.workspaceId, "guidebook_creation_jobs", RATE_LIMITS.jobsPerWorkspacePerDay);
  const { job } = await createCreationJob(creationDependencies(), ctx, {
    idempotencyKey: parsed.idempotencyKey,
    templateVersionId: parsed.templateVersionId,
  });
  return { jobId: job.id };
}

export async function uploadCustomerCreationSourceAction(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? ""),
    propertyId = String(form.get("propertyId") ?? ""),
    jobId = String(form.get("jobId") ?? ""),
    file = form.get("file");
  if (!(file instanceof File)) throw new Error("CREATION_SOURCE_REQUIRED");
  const ctx = await buildContext(workspaceId, propertyId, "guidebooks.manage");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    digest = await crypto.subtle.digest("SHA-256", bytes),
    hash = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  const { source, duplicate } = await uploadCreationSource(creationDependencies(), ctx, {
    jobId,
    filename: file.name,
    mediaType: /\.(md|markdown)$/i.test(file.name) ? "text/plain" : file.type,
    bytes,
    integritySha256: hash,
  });
  return { sourceId: source.id, duplicate };
}

const prepareUploadSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().min(1).max(120),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024),
});
export async function prepareCustomerSourceUploadAction(input: z.infer<typeof prepareUploadSchema>) {
  const parsed = prepareUploadSchema.parse(input);
  await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  const path = `direct-uploads/${parsed.jobId}/${crypto.randomUUID()}`;
  const { data, error } = await createAdminClient().storage.from("guidebook-creation-sources").createSignedUploadUrl(path);
  if (error || !data) throw new Error("CREATION_SOURCE_UPLOAD_PREPARE_FAILED");
  return { path, token: data.token };
}

const completeUploadSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  path: z.string().trim().min(1).max(500),
  filename: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().min(1).max(120),
});
export async function completeCustomerSourceUploadAction(input: z.infer<typeof completeUploadSchema>) {
  const parsed = completeUploadSchema.parse(input);
  if (!parsed.path.startsWith(`direct-uploads/${parsed.jobId}/`)) throw new Error("CREATION_SOURCE_UPLOAD_PATH_INVALID");
  const ctx = await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  const storage = createAdminClient().storage.from("guidebook-creation-sources");
  const { data, error } = await storage.download(parsed.path);
  if (error || !data) throw new Error("CREATION_SOURCE_UPLOAD_MISSING");
  try {
    const bytes = new Uint8Array(await data.arrayBuffer()),
      digest = await crypto.subtle.digest("SHA-256", bytes),
      hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
    const { source, duplicate } = await uploadCreationSource(creationDependencies(), ctx, {
      jobId: parsed.jobId,
      filename: parsed.filename,
      mediaType: parsed.mediaType,
      bytes,
      integritySha256: hash,
    });
    return { sourceId: source.id, duplicate };
  } finally {
    await storage.remove([parsed.path]);
  }
}

const extractSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8),
});
export async function enqueueCustomerExtractionAction(input: z.infer<typeof extractSchema>) {
  const parsed = extractSchema.parse(input);
  await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  await assertRateLimit(parsed.workspaceId, "guidebook_creation_work_items", RATE_LIMITS.extractionsPerWorkspacePerDay, "extraction");
  await enqueueCreationWork({
    jobId: parsed.jobId,
    workspaceId: parsed.workspaceId,
    stage: "extraction",
    idempotencyKey: parsed.idempotencyKey,
  });
  await triggerInlineProcessing();
}

const reviewSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  factId: z.string().uuid(),
  status: z.enum(["confirmed", "rejected"]),
  correctedValue: z.string().optional(),
  confirmHighRisk: z.boolean(),
});
export async function reviewCustomerCreationFactAction(input: z.infer<typeof reviewSchema>) {
  const parsed = reviewSchema.parse(input);
  const ctx = await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  return reviewCreationFact(creationDependencies(), ctx, {
    jobId: parsed.jobId,
    factId: parsed.factId,
    status: parsed.status,
    correctedValue: parsed.correctedValue,
    confirmHighRisk: parsed.confirmHighRisk,
  });
}

const reviewSectionSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  sectionId: z.string().uuid(),
  status: z.enum(["confirmed", "rejected"]),
  correctedBody: z.string().optional(),
});
export async function reviewCustomerCreationSectionAction(input: z.infer<typeof reviewSectionSchema>) {
  const parsed = reviewSectionSchema.parse(input);
  const ctx = await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  return reviewCreationNarrativeSection(creationDependencies(), ctx, {
    jobId: parsed.jobId,
    sectionId: parsed.sectionId,
    status: parsed.status,
    correctedBody: parsed.correctedBody,
  });
}

const generateSchema = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  jobId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8),
  title: z.string().trim().min(1).max(140),
  toneOfVoice: z.string().trim().max(500).optional(),
  language: z.string().trim().max(12).optional(),
});
export async function enqueueCustomerGenerationAction(input: z.infer<typeof generateSchema>) {
  const parsed = generateSchema.parse(input);
  await buildContext(parsed.workspaceId, parsed.propertyId, "guidebooks.manage");
  await assertRateLimit(parsed.workspaceId, "guidebook_creation_work_items", RATE_LIMITS.generationsPerWorkspacePerDay, "generation");
  await enqueueCreationWork({
    jobId: parsed.jobId,
    workspaceId: parsed.workspaceId,
    stage: "generation",
    idempotencyKey: parsed.idempotencyKey,
    payload: {
      title: parsed.title,
      instructions: {
        ...(parsed.toneOfVoice ? { toneOfVoice: parsed.toneOfVoice } : {}),
        ...(parsed.language ? { language: parsed.language } : {}),
      },
    },
  });
  await triggerInlineProcessing();
}

export async function cancelCustomerCreationJobAction(input: { workspaceId: string; propertyId: string; jobId: string }) {
  const ctx = await buildContext(input.workspaceId, input.propertyId, "guidebooks.manage");
  await cancelCreationJob(creationDependencies(), ctx, input.jobId);
}

export async function getCustomerCreationProjectionAction(input: { workspaceId: string; propertyId: string; jobId: string }) {
  await authorized(input.workspaceId, input.propertyId, "guidebooks.view");
  const db = createAdminClient(),
    { data: job } = await db
      .from("guidebook_creation_jobs")
      .select("id,state,current_stage,guidebook_id,resulting_draft_revision,failure_class,safe_failure_message")
      .eq("id", input.jobId)
      .eq("workspace_id", input.workspaceId)
      .eq("property_id", input.propertyId)
      .maybeSingle();
  if (!job) return null;
  const [{ data: sources }, { data: facts }, { data: narrativeSections }, { data: work }] = await Promise.all([
    db
      .from("guidebook_creation_sources")
      .select("id,original_filename,source_type,extraction_status,byte_size")
      .eq("job_id", input.jobId)
      .eq("workspace_id", input.workspaceId),
    db
      .from("guidebook_creation_facts")
      .select("id,category,field_key,display_value,source_location,confidence,review_status,high_risk")
      .eq("job_id", input.jobId)
      .eq("workspace_id", input.workspaceId),
    db
      .from("guidebook_creation_narrative_sections")
      .select("id,title,body,edited_body,source_location,review_status")
      .eq("job_id", input.jobId)
      .eq("workspace_id", input.workspaceId),
    db
      .from("guidebook_creation_work_items")
      .select("id,stage,status,attempts,safe_failure_code")
      .eq("job_id", input.jobId)
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  return { job, sources: sources ?? [], facts: facts ?? [], narrativeSections: narrativeSections ?? [], work: work ?? [] };
}

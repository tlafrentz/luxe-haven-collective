import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreationProviderError,
  controlledVerificationProviderFromEnvironment,
  DeterministicCreationProvider,
  productionProviderFromEnvironment,
} from "./providers";
import {
  creationAssistantCapability,
  extractCreationSources,
  generateCreationDraft,
  regenerateCreationSection,
  type CreationContext,
  type CreationDependencies,
} from "./application";
import {
  SupabaseCanonicalDraftPort,
  SupabaseCreationAccess,
  SupabaseCreationCompatibility,
  SupabaseCreationRepository,
  SupabaseCreationSourceStorage,
} from "./supabase";
export { cleanupCreationResources } from "./cleanup";

const deterministicExtraction = {
  facts: [],
  missing: [
    { category: "arrival", field: "access_instructions", highRisk: true },
  ],
  warnings: [],
  mediaCandidates: [],
  unsupported: [],
};
const deterministicProposal = {
  title: "Generated Guest Guide",
  description: "Review and confirm this generated draft.",
  sections: [
    {
      stableKey: "welcome",
      name: "Welcome",
      blocks: [
        {
          type: "rich-text" as const,
          content: {
            text: "Welcome. Review this generated draft before publication.",
          },
        },
      ],
    },
  ],
  factIds: [],
  componentVersions: [],
};
export function creationProvider() {
  if (
    process.env.GUIDEBOOK_CREATION_ADAPTER === "deterministic" &&
    process.env.GUIDEBOOK_CREATION_INTERNAL_COHORT
  ) {
    return new DeterministicCreationProvider(
      deterministicExtraction,
      deterministicProposal,
    );
  }
  return productionProviderFromEnvironment();
}
export function creationDependencies(options:Readonly<{controlledVerification?:boolean;runScopedAuthorization?:boolean}>={}): CreationDependencies {
  const provider = options.controlledVerification?controlledVerificationProviderFromEnvironment(options.runScopedAuthorization):creationProvider();
  if (!provider) throw new Error("CREATION_PROVIDER_NOT_CONFIGURED");
  return {
    repository: new SupabaseCreationRepository(),
    storage: new SupabaseCreationSourceStorage(),
    drafts: new SupabaseCanonicalDraftPort(),
    compatibility: new SupabaseCreationCompatibility(),
    access: new SupabaseCreationAccess(),
    extraction: provider,
    generation: provider,
  };
}
export async function hasCreationEntitlement(
  workspaceId: string,
  propertyId: string,
  actorId?: string,
) {
  const db = createAdminClient(),
    now = new Date().toISOString(),
    [{ data, error }, { data: internalIdentity, error: identityError }] =
      await Promise.all([
        db
          .from("commercial_entitlements")
          .select("resource_scope_type,resource_scope_id")
          .eq("tenant_id", workspaceId)
          .eq("capability_code", "guidebook.create")
          .eq("status", "active")
          .lte("effective_from", now)
          .or(`effective_until.is.null,effective_until.gt.${now}`),
        actorId
          ? db
              .from("controlled_verification_identities")
              .select("id,allowed_scenario_codes")
              .eq("environment_code", "production")
              .eq("identity_type_code", "release_verifier")
              .eq("opaque_auth_subject_reference", actorId)
              .eq("status", "active")
              .or(`expires_at.is.null,expires_at.gt.${now}`)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
  if (error) throw new Error("CREATION_ENTITLEMENT_READ_FAILED");
  if (identityError) throw new Error("CREATION_INTERNAL_ACCESS_READ_FAILED");
  return Boolean(
    data?.some(
      (grant) =>
        grant.resource_scope_type === "customer_account" ||
        (grant.resource_scope_type === "workspace" &&
          grant.resource_scope_id === workspaceId) ||
        (grant.resource_scope_type === "property" &&
          grant.resource_scope_id === propertyId),
    ),
  ) || Boolean(internalIdentity?.allowed_scenario_codes?.includes("PV-009"));
}
export async function creationContextFromJob(
  jobId: string,
): Promise<CreationContext> {
  const db = createAdminClient(),
    { data: job, error } = await db
      .from("guidebook_creation_jobs")
      .select(
        "id,workspace_id,property_id,requested_by_profile_id,requested_by_role,correlation_id",
      )
      .eq("id", jobId)
      .single();
  if (error || !job) throw new Error("CREATION_JOB_NOT_FOUND");
  return {
    actorId: String(job.requested_by_profile_id),
    actorRole: String(job.requested_by_role),
    workspaceId: String(job.workspace_id),
    propertyId: String(job.property_id),
    permissions: new Set(["guidebooks.manage"]),
    entitled: await hasCreationEntitlement(
      String(job.workspace_id),
      String(job.property_id),
      String(job.requested_by_profile_id),
    ),
    correlationId: String(job.correlation_id),
  };
}
export async function enqueueCreationWork(
  input: Readonly<{
    jobId: string;
    workspaceId: string;
    stage: "extraction" | "generation" | "section_regeneration";
    idempotencyKey: string;
    payload?: Readonly<Record<string, unknown>>;
  }>,
) {
  const db = createAdminClient(),
    { data, error } = await db
      .from("guidebook_creation_work_items")
      .upsert(
        {
          job_id: input.jobId,
          workspace_id: input.workspaceId,
          stage: input.stage,
          idempotency_key: input.idempotencyKey,
          payload: input.payload ?? {},
        },
        { onConflict: "job_id,idempotency_key", ignoreDuplicates: true },
      )
      .select("id,status")
      .maybeSingle();
  if (error) throw error;
  return data;
}
export async function processOneCreationWork(workerId: string,options:Readonly<{controlledVerification?:boolean;runScopedAuthorization?:boolean;expectedJobId?:string;retryImmediately?:boolean}>={}) {
  const db = createAdminClient(),
    { data, error } = await db.rpc("claim_guidebook_creation_work", {
      p_worker_id: workerId,
      p_lease_seconds: 120,
    });
  if (error) throw error;
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return { processed: false };
  if(options.expectedJobId&&String(item.job_id)!==options.expectedJobId){await db.from("guidebook_creation_work_items").update({status:"queued",lease_owner:null,lease_expires_at:null}).eq("id",item.id).eq("lease_owner",workerId);throw new Error("CONTROLLED_WORK_ITEM_SCOPE_MISMATCH")}
  const attemptKey = `${String(item.idempotency_key)}:attempt:${Number(item.attempts)}`;
  try {
    const context = await creationContextFromJob(String(item.job_id)),
      deps = creationDependencies(options),
      payload = (item.payload ?? {}) as Record<string, unknown>;
    if (item.stage === "extraction")
      await extractCreationSources(deps, context, {
        jobId: String(item.job_id),
        idempotencyKey: attemptKey,
        ...(Array.isArray(payload.sourceIds)
          ? { sourceIds: payload.sourceIds.map(String) }
          : {}),
      });
    else if (item.stage === "generation")
      await generateCreationDraft(deps, context, {
        jobId: String(item.job_id),
        idempotencyKey: attemptKey,
        title: String(payload.title ?? "Guest Guide"),
        instructions: (payload.instructions ?? {}) as Record<
          string,
          string | boolean
        >,
      });
    else
      await regenerateCreationSection(deps, context, {
        jobId: String(item.job_id),
        sectionId: String(payload.sectionId),
        expectedRevision: Number(payload.expectedRevision),
        idempotencyKey: attemptKey,
        instructions: (payload.instructions ?? {}) as Record<
          string,
          string | boolean
        >,
      });
    await db
      .from("guidebook_creation_work_items")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        lease_expires_at: null,
      })
      .eq("id", item.id)
      .eq("lease_owner", workerId);
    return { processed: true, status: "completed", jobId: String(item.job_id) };
  } catch (error) {
    const retryable =
        (!(error instanceof CreationProviderError) || error.retryable) &&
        item.attempts < 3,
      status = retryable ? "retryable_failure" : "terminal_failure",
      delay = new Date(
        options.retryImmediately
          ? Date.now()
          : Date.now() + Math.min(60_000, 1000 * 2 ** Number(item.attempts)),
      ).toISOString();
    await db
      .from("guidebook_creation_work_items")
      .update({
        status,
        available_at: delay,
        lease_expires_at: null,
        safe_failure_code: safeCode(error),
      })
      .eq("id", item.id)
      .eq("lease_owner", workerId);
    return {
      processed: true,
      status,
      jobId: String(item.job_id),
      failureCode: safeCode(error),
    };
  }
}
function safeCode(error: unknown) {
  if (error instanceof CreationProviderError)
    return `PROVIDER_${error.kind.toUpperCase()}`;
  const structured =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (/^[A-Z][A-Z0-9_]{2,100}$/.test(structured)) return structured;
  const value = error instanceof Error ? error.message : "CREATION_WORK_FAILED";
  return /^[A-Z][A-Z0-9_]{2,100}$/.test(value) ? value : "CREATION_WORK_FAILED";
}

export async function readCreationCapability(
  input: Readonly<{ workspaceId: string; propertyId: string; actorId: string }>,
) {
  const db = createAdminClient(),
    provider = creationProvider(),
    cohort = (process.env.GUIDEBOOK_CREATION_INTERNAL_COHORT ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    relation =
      "artifact:guidebook_library_artifacts!guidebook_library_versions_artifact_id_fkey",
    [
      { data: migration },
      { data: bucket },
      { data: property },
      { data: template },
      { data: work },
      { data: controlledIdentity },
    ] = await Promise.all([
      db.from("guidebook_creation_jobs").select("id").limit(1),
      db.storage.getBucket("guidebook-creation-sources"),
      db
        .from("properties")
        .select("id")
        .eq("id", input.propertyId)
        .eq("owner_id", input.workspaceId)
        .maybeSingle(),
      db
        .from("guidebook_library_versions")
        .select(`id,${relation}!inner(artifact_type,status)`)
        .in("status", ["approved", "published"])
        .eq("artifact.artifact_type", "template")
        .eq("artifact.status", "published")
        .limit(1),
      db.from("guidebook_creation_work_items").select("id").limit(1),
      db
        .from("controlled_verification_identities")
        .select("id,allowed_scenario_codes")
        .eq("environment_code", "production")
        .eq("identity_type_code", "release_verifier")
        .eq("opaque_auth_subject_reference", input.actorId)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle(),
    ]),
    compatibility = new SupabaseCreationCompatibility(),
    templateId = template?.[0]?.id ? String(template[0].id) : "",
    components = await compatibility.allowedComponents(),
    entitled = await hasCreationEntitlement(
      input.workspaceId,
      input.propertyId,
      input.actorId,
    );
  return creationAssistantCapability({
    migrationApplied: Array.isArray(migration),
    storageValid: bucket?.public === false,
    extractionConfigured: !!provider,
    generationConfigured: !!provider,
    templateReady: !!templateId,
    componentsReady: components.size > 0,
    backgroundHealthy: Array.isArray(work),
    entitled,
    contextValid: !!property,
    globalEnabled: process.env.GUIDEBOOK_CREATION_ENABLED === "true",
    workspaceEnabled: process.env.GUIDEBOOK_CREATION_KILL_SWITCH !== "true",
    controlledCohort:
      cohort.includes(input.actorId) ||
      cohort.includes(input.workspaceId) ||
      Boolean(
        controlledIdentity?.allowed_scenario_codes?.includes("PV-009"),
      ),
    verticalSliceVerified:
      process.env.GUIDEBOOK_CREATION_VERTICAL_SLICE_VERIFIED === "true",
  });
}

/**
 * Customer-facing readiness gate. Unlike readCreationCapability()/customerVisible
 * (which additionally requires an internal env cohort allow-list — a staged
 * canary mechanism for the admin/PV-009 harness), this drops that allow-list
 * requirement and gates purely on real per-tenant entitlement plus infra
 * health plus the global enable/kill-switch flags, so it works for any
 * entitled customer without ops hand-adding workspace IDs to an env var.
 */
export async function readCustomerCreationCapability(
  input: Readonly<{ workspaceId: string; propertyId: string; actorId: string }>,
) {
  const capability = await readCreationCapability(input);
  return {
    available: capability.reasons.length === 0 && process.env.GUIDEBOOK_CREATION_ENABLED === "true",
    reasons: capability.reasons,
  };
}

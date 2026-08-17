import { createAdminClient } from "@/lib/supabase/admin";
import {
  builderComponentIsEligible,
  BUILDER_COMPONENTS,
} from "@/features/guidebook-builder/domain";
import {
  buildComponentVersion,
  EXPERIENCE_COMPONENT_V1,
} from "@/features/experience-components";
import {
  SupabaseGuidebookCreationRepository,
  SupabaseGuidebookDraftRepository,
} from "@/features/guidebook-studio/infrastructure/supabase-authoring-repositories";
import type { CreationJob, CreationSource, ExtractedFact } from "./domain";
import type {
  AccessPort,
  CanonicalDraftPort,
  CompatibilityPort,
  CreationContext,
  CreationRepository,
  SourceStorage,
} from "./application";

type Client = ReturnType<typeof createAdminClient>;
export class SupabaseCreationRepository implements CreationRepository {
  constructor(private readonly client: Client = createAdminClient()) {}
  async findJob(workspaceId: string, jobId: string) {
    const { data, error } = await this.client
      .from("guidebook_creation_jobs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    return data ? job(data) : null;
  }
  async findJobByIdempotency(workspaceId: string, key: string) {
    const { data, error } = await this.client
      .from("guidebook_creation_jobs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw error;
    return data ? job(data) : null;
  }
  async createJob(value: CreationJob) {
    const { error } = await this.client
      .from("guidebook_creation_jobs")
      .insert({
        id: value.id,
        workspace_id: value.workspaceId,
        property_id: value.propertyId,
        requested_by_profile_id: value.actorId,
        requested_by_role: value.actorRole,
        template_version_id: value.templateVersionId,
        state: value.state,
        current_stage: value.currentStage,
        idempotency_key: value.idempotencyKey,
        attempt_count: value.attemptCount,
        correlation_id: value.correlationId,
      });
    if (error) throw error;
  }
  async transition(
    jobId: string,
    expectedState: CreationJob["state"],
    patch: Partial<CreationJob>,
  ) {
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.state) values.state = patch.state;
    if (patch.currentStage) values.current_stage = patch.currentStage;
    if (patch.guidebookId) values.guidebook_id = patch.guidebookId;
    if (patch.resultingDraftRevision)
      values.resulting_draft_revision = patch.resultingDraftRevision;
    if (patch.expectedDraftRevision)
      values.expected_draft_revision = patch.expectedDraftRevision;
    if (patch.failureClass) values.failure_class = patch.failureClass;
    if (patch.state === "cancelled") {
      values.cancelled_at = new Date().toISOString();
      values.cancelled_by_profile_id = patch.actorId ?? null;
    }
    if (patch.state === "completed")
      values.completed_at = new Date().toISOString();
    const { data, error } = await this.client
      .from("guidebook_creation_jobs")
      .update(values)
      .eq("id", jobId)
      .eq("state", expectedState)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("CREATION_STATE_CONFLICT");
    return job(data);
  }
  async listSources(workspaceId: string, jobId: string) {
    const { data, error } = await this.client
      .from("guidebook_creation_sources")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("job_id", jobId)
      .neq("retention_state", "deleted")
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(source);
  }
  async saveSource(value: CreationSource) {
    const { data, error } = await this.client
      .from("guidebook_creation_sources")
      .insert({
        id: value.id,
        job_id: value.jobId,
        workspace_id: value.workspaceId,
        source_type: value.sourceType,
        original_filename: value.originalFilename,
        storage_path: value.storagePath,
        media_type: value.mediaType,
        byte_size: value.byteSize,
        integrity_sha256: value.integritySha256,
        upload_status: "ready",
        extraction_status: value.extractionStatus,
        created_by_profile_id: (
          await this.client
            .from("guidebook_creation_jobs")
            .select("requested_by_profile_id")
            .eq("id", value.jobId)
            .single()
        ).data?.requested_by_profile_id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return source(data);
  }
  async updateSource(sourceId: string, patch: Partial<CreationSource>) {
    const values: Record<string, unknown> = {};
    if (patch.extractionStatus)
      values.extraction_status = patch.extractionStatus;
    const { error } = await this.client
      .from("guidebook_creation_sources")
      .update(values)
      .eq("id", sourceId);
    if (error) throw error;
  }
  async listFacts(workspaceId: string, jobId: string) {
    const [{ data, error }, { data: confirmations, error: confirmationError }] =
      await Promise.all([
        this.client
          .from("guidebook_creation_facts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("job_id", jobId)
          .order("created_at"),
        this.client
          .from("guidebook_creation_confirmations")
          .select("fact_id")
          .eq("workspace_id", workspaceId)
          .eq("job_id", jobId)
          .is("revoked_at", null),
      ]);
    if (error) throw error;
    if (confirmationError) throw confirmationError;
    const confirmed = new Set(
      (confirmations ?? []).map((v) => String(v.fact_id)),
    );
    return (data ?? []).map((v) => fact(v, confirmed.has(String(v.id))));
  }
  async replaceFacts(
    jobId: string,
    workspaceId: string,
    facts: readonly ExtractedFact[],
  ) {
    const { error: deleteError } = await this.client
      .from("guidebook_creation_facts")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("job_id", jobId);
    if (deleteError) throw deleteError;
    if (!facts.length) return;
    const { error } = await this.client
      .from("guidebook_creation_facts")
      .insert(
        facts.map((v) => ({
          id: v.id,
          job_id: jobId,
          workspace_id: workspaceId,
          category: v.category,
          field_key: v.field,
          normalized_value: v.normalizedValue,
          display_value: v.displayValue,
          source_id: v.sourceId,
          source_location: v.sourceLocation,
          confidence: v.confidence,
          review_status: v.reviewStatus,
          conflict_group: v.conflictGroup,
          sensitivity: v.sensitivity,
          high_risk: v.highRisk,
          corrected_value: v.correctedValue,
        })),
      );
    if (error) throw error;
  }
  async reviewFact(input: Parameters<CreationRepository["reviewFact"]>[0]) {
    const { data: current, error: loadError } = await this.client
      .from("guidebook_creation_facts")
      .select("high_risk,sensitivity")
      .eq("workspace_id", input.workspaceId)
      .eq("job_id", input.jobId)
      .eq("id", input.factId)
      .single();
    if (loadError) throw loadError;
    if (current.sensitivity === "secret" && input.status === "confirmed")
      throw new Error("PROTECTED_GUEST_DATA_BOUNDARY_REQUIRED");
    if (
      current.high_risk &&
      input.status === "confirmed" &&
      !input.confirmHighRisk
    )
      throw new Error("HIGH_RISK_CONFIRMATION_REQUIRED");
    const now = new Date().toISOString(),
      { error } = await this.client
        .from("guidebook_creation_facts")
        .update({
          review_status: input.status,
          corrected_value: input.correctedValue,
          reviewed_by_profile_id: input.actorId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("job_id", input.jobId)
        .eq("id", input.factId);
    if (error) throw error;
    if (current.high_risk && input.status === "confirmed") {
      const { error: confirmError } = await this.client
        .from("guidebook_creation_confirmations")
        .insert({
          job_id: input.jobId,
          workspace_id: input.workspaceId,
          fact_id: input.factId,
          confirmed_by_profile_id: input.actorId,
        });
      if (confirmError && !confirmError.message.includes("duplicate"))
        throw confirmError;
    }
  }
  async beginAttempt(input: Parameters<CreationRepository["beginAttempt"]>[0]) {
    const existing = await this.client
      .from("guidebook_creation_attempts")
      .select("id")
      .eq("job_id", input.jobId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { id: String(existing.data.id), duplicate: true };
    const count = await this.client
        .from("guidebook_creation_attempts")
        .select("id", { count: "exact", head: true })
        .eq("job_id", input.jobId),
      attemptNumber = (count.count ?? 0) + 1,
      id = crypto.randomUUID(),
      { error } = await this.client
        .from("guidebook_creation_attempts")
        .insert({
          id,
          job_id: input.jobId,
          workspace_id: input.workspaceId,
          attempt_number: attemptNumber,
          stage: input.stage,
          status: "processing",
          provider_key: input.providerKey,
          idempotency_key: input.idempotencyKey,
          started_at: new Date().toISOString(),
        });
    if (error) {
      if (error.code === "23505") {
        const retry = await this.client
          .from("guidebook_creation_attempts")
          .select("id")
          .eq("job_id", input.jobId)
          .eq("idempotency_key", input.idempotencyKey)
          .single();
        if (retry.data) return { id: String(retry.data.id), duplicate: true };
      }
      throw error;
    }
    const { error: updateError } = await this.client
      .from("guidebook_creation_jobs")
      .update({
        attempt_count: attemptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.jobId)
      .eq("workspace_id", input.workspaceId);
    if (updateError) throw updateError;
    return { id, duplicate: false };
  }
  async completeAttempt(
    id: string,
    input: Parameters<CreationRepository["completeAttempt"]>[1],
  ) {
    const { error } = await this.client
      .from("guidebook_creation_attempts")
      .update({
        status: input.status,
        provider_request_id: input.requestId,
        usage_metadata: input.usage ?? {},
        safe_failure_code: input.failureCode,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
  async recordProviderEvidence(input: Parameters<CreationRepository["recordProviderEvidence"]>[0]) {
    const property = await this.client.from("guidebook_creation_jobs").select("property:properties!guidebook_creation_jobs_property_id_fkey(controlled_verification_run_id)").eq("id",input.jobId).eq("workspace_id",input.workspaceId).single();
    if(property.error)throw property.error;const controlled=(property.data?.property as unknown as {controlled_verification_run_id?:string|null}|null)?.controlled_verification_run_id??null,e=input.evidence;
    const {data,error}=await this.client.from("guidebook_creation_provider_evidence").insert({verification_run_id:controlled,job_id:input.jobId,attempt_id:input.attemptId,workspace_id:input.workspaceId,stage:input.stage,provider_key:input.providerKey,provider_request_id:e.providerRequestId,configured_model:e.configuredModel,resolved_snapshot:e.resolvedSnapshot,upstream_http_status:e.upstreamHttpStatus,response_status:e.responseStatus,incomplete_reason:e.incompleteReason,input_tokens:e.inputTokens,cached_input_tokens:e.cachedInputTokens,output_tokens:e.outputTokens,reasoning_tokens:e.reasoningTokens,calculated_cost_usd:e.calculatedCostUsd,latency_ms:e.latencyMs,safe_classification:e.safeClassification,correlation_id:e.correlationId,recorded_at:e.recordedAt}).select("id").single();if(error)throw error;return String(data.id)
  }
  async recordProviderEvidenceOutcome(input: Parameters<CreationRepository["recordProviderEvidenceOutcome"]>[0]) {
    const {error}=await this.client.from("guidebook_creation_provider_evidence_outcomes").insert({evidence_id:input.evidenceId,safe_classification:input.classification,schema_validation_paths:input.schemaValidationPaths,correlation_id:input.correlationId});if(error)throw error
  }
  async recordArtifact(
    input: Parameters<CreationRepository["recordArtifact"]>[0],
  ) {
    const { error } = await this.client
      .from("guidebook_creation_artifacts")
      .insert({
        job_id: input.jobId,
        workspace_id: input.workspaceId,
        attempt_id: input.attemptId,
        guidebook_id: input.guidebookId,
        draft_revision: input.draftRevision,
        artifact_type: input.type,
        section_id: input.sectionId,
        based_on_revision: input.basedOnRevision,
        template_version_id: input.templateVersionId,
        component_lineage: input.componentLineage,
        fact_lineage: input.factLineage,
        draft_snapshot: input.draftSnapshot,
      });
    if (error) throw error;
  }
  async findArtifact(
    workspaceId: string,
    jobId: string,
    draftRevision: number,
  ) {
    const { data, error } = await this.client
      .from("guidebook_creation_artifacts")
      .select("id,draft_snapshot")
      .eq("workspace_id", workspaceId)
      .eq("job_id", jobId)
      .eq("draft_revision", draftRevision)
      .maybeSingle();
    if (error) throw error;
    return data
      ? {
          id: String(data.id),
          draftSnapshot:
            data.draft_snapshot as unknown as import("@/features/guidebook-studio").GuidebookDraft,
        }
      : null;
  }
  async audit(input: Parameters<CreationRepository["audit"]>[0]) {
    const { error } = await this.client
      .from("guidebook_creation_events")
      .insert({
        job_id: input.jobId,
        workspace_id: input.workspaceId,
        actor_profile_id: input.actorId,
        event_type: input.event,
        correlation_id: input.correlationId,
        safe_metadata: input.metadata ?? {},
      });
    if (error) throw error;
  }
}

export class SupabaseCreationSourceStorage implements SourceStorage {
  constructor(private readonly client: Client = createAdminClient()) {}
  async put(input: Parameters<SourceStorage["put"]>[0]) {
    const { error } = await this.client.storage
      .from("guidebook-creation-sources")
      .upload(input.path, input.bytes, {
        contentType: input.mediaType,
        upsert: false,
      });
    if (error) throw error;
  }
  async readExact(path: string) {
    const { data, error } = await this.client.storage
      .from("guidebook-creation-sources")
      .download(path);
    if (error || !data) throw error ?? new Error("CREATION_SOURCE_NOT_FOUND");
    return new Uint8Array(await data.arrayBuffer());
  }
  async removeExact(paths: readonly string[]) {
    if (!paths.length) return;
    const { error } = await this.client.storage
      .from("guidebook-creation-sources")
      .remove([...paths]);
    if (error) throw error;
  }
}
export class SupabaseCanonicalDraftPort implements CanonicalDraftPort {
  constructor(
    private readonly creation = new SupabaseGuidebookCreationRepository(),
    private readonly drafts = new SupabaseGuidebookDraftRepository(),
  ) {}
  async create(input: Parameters<CanonicalDraftPort["create"]>[0]) {
    const result = await this.creation.create({
      context: {
        workspaceId: input.workspaceId,
        guidebookId: crypto.randomUUID(),
        actorId: input.actorId,
        expectedRevision: 0,
        commandId: input.commandId,
        correlationId: crypto.randomUUID(),
        enteredAt: new Date().toISOString(),
      },
      propertyId: input.propertyId,
      title: input.title,
      fingerprint: `assistant:${input.commandId}`,
    });
    return { guidebookId: result.guidebookId, revision: result.revision };
  }
  load(input: Parameters<CanonicalDraftPort["load"]>[0]) {
    return this.drafts.load(input);
  }
  save(input: Parameters<CanonicalDraftPort["save"]>[0]) {
    return this.drafts.save(input.context, input.draft);
  }
}
export class SupabaseCreationCompatibility implements CompatibilityPort {
  constructor(private readonly client: Client = createAdminClient()) {}
  async readyTemplate(versionId: string) {
    const relation =
      "artifact:guidebook_library_artifacts!guidebook_library_versions_artifact_id_fkey";
    const { data } = await this.client
      .from("guidebook_library_versions")
      .select(`id,status,artifact_id,${relation}!inner(artifact_type,status)`)
      .eq("id", versionId)
      .in("status", ["approved", "published"])
      .eq("artifact.artifact_type", "template")
      .eq("artifact.status", "published")
      .maybeSingle();
    return !!data;
  }
  async allowedComponents() {
    return new Map(
      BUILDER_COMPONENTS.filter((v) => builderComponentIsEligible(v.key)).map(
        (v) => {
          const seed = EXPERIENCE_COMPONENT_V1.find((s) => s.key === v.key)!;
          return [v.key, buildComponentVersion(seed).id];
        },
      ),
    );
  }
}
export class SupabaseCreationAccess implements AccessPort {
  constructor(private readonly client: Client = createAdminClient()) {}
  async stillAuthorized(context: CreationContext, job: CreationJob) {
    if (
      context.workspaceId !== job.workspaceId ||
      context.propertyId !== job.propertyId ||
      !context.entitled ||
      !context.permissions.has("guidebooks.manage")
    )
      return false;
    const { data } = await this.client
      .from("properties")
      .select("id,owner_id")
      .eq("id", job.propertyId)
      .eq("owner_id", job.workspaceId)
      .maybeSingle();
    return !!data;
  }
}

function job(v: Record<string, unknown>): CreationJob {
  return {
    id: String(v.id),
    workspaceId: String(v.workspace_id),
    propertyId: String(v.property_id),
    ...(v.guidebook_id ? { guidebookId: String(v.guidebook_id) } : {}),
    actorId: String(v.requested_by_profile_id),
    actorRole: String(v.requested_by_role),
    ...(v.template_version_id
      ? { templateVersionId: String(v.template_version_id) }
      : {}),
    state: v.state as CreationJob["state"],
    currentStage: String(v.current_stage),
    idempotencyKey: String(v.idempotency_key),
    attemptCount: Number(v.attempt_count),
    ...(v.expected_draft_revision
      ? { expectedDraftRevision: Number(v.expected_draft_revision) }
      : {}),
    ...(v.resulting_draft_revision
      ? { resultingDraftRevision: Number(v.resulting_draft_revision) }
      : {}),
    correlationId: String(v.correlation_id),
    ...(v.failure_class ? { failureClass: String(v.failure_class) } : {}),
  };
}
function source(v: Record<string, unknown>): CreationSource {
  return {
    id: String(v.id),
    jobId: String(v.job_id),
    workspaceId: String(v.workspace_id),
    sourceType: v.source_type as CreationSource["sourceType"],
    originalFilename: String(v.original_filename),
    storagePath: String(v.storage_path),
    mediaType: String(v.media_type),
    byteSize: Number(v.byte_size),
    integritySha256: String(v.integrity_sha256),
    extractionStatus: v.extraction_status as CreationSource["extractionStatus"],
  };
}
function fact(v: Record<string, unknown>, confirmed: boolean): ExtractedFact {
  return {
    id: String(v.id),
    jobId: String(v.job_id),
    category: String(v.category),
    field: String(v.field_key),
    normalizedValue: v.normalized_value,
    displayValue: v.display_value ? String(v.display_value) : undefined,
    sourceId: v.source_id ? String(v.source_id) : undefined,
    sourceLocation: v.source_location ? String(v.source_location) : undefined,
    confidence: v.confidence === null ? undefined : Number(v.confidence),
    reviewStatus: v.review_status as ExtractedFact["reviewStatus"],
    conflictGroup: v.conflict_group ? String(v.conflict_group) : undefined,
    sensitivity: v.sensitivity as ExtractedFact["sensitivity"],
    highRisk: Boolean(v.high_risk),
    correctedValue: v.corrected_value,
    confirmed,
  };
}

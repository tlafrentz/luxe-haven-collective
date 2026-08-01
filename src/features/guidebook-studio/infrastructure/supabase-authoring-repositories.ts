import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUIDEBOOK_BLOCK_SCHEMA,
  GUIDEBOOK_DRAFT_SCHEMA,
  validateDraft,
  type AuthoringBlock,
  type GuidebookDraft,
} from "../domain/authoring";
import type {
  AuthoringResult,
  CommandContext,
  GuidebookAnalyticsRepository,
  GuidebookAuthoringObserver,
  GuidebookCommandReceiptRepository,
  GuidebookCreationRepository,
  GuidebookDraftRepository,
  GuidebookLifecycleRepository,
  GuidebookPropertyProjectionRepository,
  PublishedGuidebookVersionRepository,
  Receipt,
} from "../application/authoring";

type Client = ReturnType<typeof createAdminClient>;
export class SupabaseGuidebookDraftRepository
  implements GuidebookDraftRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async load(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ) {
    const { data: guidebook, error } = await this.client
      .from("guidebooks")
      .select(
        "id,workspace_id,property_id,title,description,revision,published_version,status,updated_at",
      )
      .eq("id", scope.guidebookId)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw classified("DRAFT_PERSIST_FAILED");
    if (!guidebook) return null;
    if (guidebook.status === "archived") throw classified("GUIDEBOOK_ARCHIVED");
    const { data: stored, error: draftError } = await this.client
      .from("guidebook_drafts")
      .select(
        "schema_version,revision,composition,persisted_by_profile_id,persisted_at,base_publication_version",
      )
      .eq("guidebook_id", scope.guidebookId)
      .maybeSingle();
    if (draftError && !draftError.message.includes("guidebook_drafts"))
      throw classified("DRAFT_PERSIST_FAILED");
    if (stored) {
      const composition = stored.composition as Record<string, unknown>;
      return validateDraft({
        guidebookId: String(guidebook.id),
        workspaceId: String(guidebook.workspace_id),
        propertyId: String(guidebook.property_id),
        schemaVersion: String(
          stored.schema_version,
        ) as typeof GUIDEBOOK_DRAFT_SCHEMA,
        revision: Number(stored.revision),
        title: String(composition.title ?? guidebook.title),
        description: String(
          composition.description ?? guidebook.description ?? "",
        ),
        sections: (composition.sections ?? []) as GuidebookDraft["sections"],
        persistedAt: String(stored.persisted_at),
        persistedBy: String(stored.persisted_by_profile_id),
        ...(stored.base_publication_version
          ? { basePublicationVersion: Number(stored.base_publication_version) }
          : {}),
      });
    }
    const { data: sections, error: sectionError } = await this.client
      .from("guidebook_sections")
      .select(
        "id,title,position,visible,guidebook_blocks(id,block_type,position,content,guest_safe)",
      )
      .eq("guidebook_id", scope.guidebookId)
      .order("position");
    if (sectionError) throw classified("DRAFT_PERSIST_FAILED");
    return validateDraft({
      guidebookId: String(guidebook.id),
      workspaceId: String(guidebook.workspace_id),
      propertyId: String(guidebook.property_id),
      schemaVersion: GUIDEBOOK_DRAFT_SCHEMA,
      revision: Number(guidebook.revision),
      title: String(guidebook.title),
      description: String(guidebook.description ?? ""),
      sections: (sections ?? []).map((section) => ({
        id: String(section.id),
        name: String(section.title),
        position: Number(section.position),
        visible: Boolean(section.visible),
        blocks: (
          (section.guidebook_blocks as Record<string, unknown>[]) ?? []
        ).map(legacyBlock),
      })),
      persistedAt: String(guidebook.updated_at),
      persistedBy: scope.actorId,
      ...(guidebook.published_version
        ? { basePublicationVersion: Number(guidebook.published_version) }
        : {}),
    });
  }
  async save(scope: CommandContext, draft: GuidebookDraft) {
    const valid = validateDraft(draft);
    const composition = {
      title: valid.title,
      description: valid.description,
      sections: valid.sections,
    };
    const { error } = await this.client.rpc("persist_guidebook_draft", {
      p_guidebook_id: scope.guidebookId,
      p_workspace_id: scope.workspaceId,
      p_property_id: valid.propertyId,
      p_expected_revision: scope.expectedRevision,
      p_resulting_revision: valid.revision,
      p_actor_id: scope.actorId,
      p_composition: composition,
      p_persisted_at: valid.persistedAt,
    });
    if (error)
      throw classified(
        error.message.includes("draft_conflict")
          ? "DRAFT_CONFLICT"
          : "DRAFT_PERSIST_FAILED",
      );
    return valid;
  }
}
export class SupabaseGuidebookCommandReceiptRepository
  implements GuidebookCommandReceiptRepository
{
  constructor(
    private readonly actorId: string,
    private readonly client: Client = createAdminClient(),
  ) {}
  async find(workspaceId: string, commandId: string) {
    const { data, error } = await this.client
      .from("guidebook_command_receipts")
      .select(
        "workspace_id,guidebook_id,command_id,operation,fingerprint,outcome,result,created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("command_id", commandId)
      .maybeSingle();
    if (error) throw classified("DRAFT_PERSIST_FAILED");
    if (!data) return null;
    return {
      workspaceId: String(data.workspace_id),
      guidebookId: String(data.guidebook_id),
      commandId: String(data.command_id),
      operation: String(data.operation),
      fingerprint: String(data.fingerprint),
      state:
        data.outcome === "in-progress"
          ? "in-progress"
          : data.outcome === "completed"
            ? "completed"
            : "failed",
      ...(data.result && Object.keys(data.result as object).length
        ? { outcome: data.result as unknown as AuthoringResult<unknown> }
        : {}),
      createdAt: String(data.created_at),
    } as Receipt;
  }
  async begin(receipt: Receipt) {
    const { error } = await this.client
      .from("guidebook_command_receipts")
      .insert({
        workspace_id: receipt.workspaceId,
        guidebook_id: receipt.guidebookId,
        command_id: receipt.commandId,
        operation: receipt.operation,
        fingerprint: receipt.fingerprint,
        outcome: "in-progress",
        actor_profile_id: receipt.actorId ?? this.actorId,
        created_at: receipt.createdAt,
      });
    return error
      ? error.code === "23505"
        ? "exists"
        : Promise.reject(classified("DRAFT_PERSIST_FAILED"))
      : "started";
  }
  async complete(
    workspaceId: string,
    commandId: string,
    outcome: AuthoringResult<unknown>,
  ) {
    const { error } = await this.client
      .from("guidebook_command_receipts")
      .update({ outcome: outcome.ok ? "completed" : "failed", result: outcome })
      .eq("workspace_id", workspaceId)
      .eq("command_id", commandId);
    if (error) throw classified("DRAFT_PERSIST_FAILED");
  }
}
export class SupabaseGuidebookAnalyticsRepository
  implements GuidebookAnalyticsRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async summary(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ) {
    const { data: guidebook } = await this.client
      .from("guidebooks")
      .select("id")
      .eq("id", scope.guidebookId)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (!guidebook) throw classified("GUIDEBOOK_UNAUTHORIZED");
    const { data, error } = await this.client
      .from("guidebook_analytics")
      .select("event_type,section_key")
      .eq("guidebook_id", scope.guidebookId)
      .limit(5000);
    if (error) throw classified("ANALYTICS_UNAVAILABLE");
    if (!data?.length) return null;
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = `${row.event_type}:${row.section_key ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Object.freeze(
      [...counts].map(([key, count]) => {
        const [eventType, sectionId] = key.split(":");
        return Object.freeze({
          eventType: eventType!,
          ...(sectionId ? { sectionId } : {}),
          count,
        });
      }),
    );
  }
}
export class SupabaseGuidebookPropertyProjectionRepository
  implements GuidebookPropertyProjectionRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async load(
    scope: Readonly<{
      workspaceId: string;
      propertyId: string;
      actorId: string;
    }>,
  ) {
    const { data, error } = await this.client
      .from("properties")
      .select(
        "id,name,address,address_line_1,city,state,timezone,check_in_time,check_out_time,amenities,house_rules,featured_image,updated_at",
      )
      .eq("id", scope.propertyId)
      .eq("owner_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw classified("WORKSPACE_STATE_UNAVAILABLE");
    if (!data) return null;
    return Object.freeze({
      propertyId: String(data.id),
      name: String(data.name),
      address: String(data.address_line_1 ?? data.address ?? ""),
      city: String(data.city ?? ""),
      state: String(data.state ?? ""),
      timezone: String(data.timezone ?? ""),
      checkInTime: String(data.check_in_time ?? ""),
      checkoutTime: String(data.check_out_time ?? ""),
      amenities: Array.isArray(data.amenities)
        ? data.amenities.map(String)
        : [],
      houseRules: Array.isArray(data.house_rules)
        ? data.house_rules.map(String)
        : [],
      featuredImage: String(data.featured_image ?? ""),
      sourceUpdatedAt: String(data.updated_at),
      version: `property:${String(data.updated_at)}`,
    });
  }
}
export class SupabasePublishedGuidebookVersionRepository
  implements PublishedGuidebookVersionRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async publish(
    input: Parameters<PublishedGuidebookVersionRepository["publish"]>[0],
  ) {
    const { data, error } = await this.client.rpc(
      "publish_canonical_guidebook_draft",
      {
        p_guidebook_id: input.context.guidebookId,
        p_workspace_id: input.context.workspaceId,
        p_expected_revision: input.context.expectedRevision,
        p_actor_id: input.context.actorId,
        p_idempotency_key: input.context.commandId,
        p_snapshot: input.snapshot,
        p_published_at: new Date().toISOString(),
      },
    );
    if (error)
      throw classified(
        error.message.includes("conflict")
          ? "PUBLICATION_CONFLICT"
          : error.message.includes("not_ready")
            ? "PUBLICATION_NOT_READY"
            : "PUBLICATION_FAILED",
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw classified("PUBLICATION_FAILED");
    return Object.freeze({
      versionId: String(row.version_id),
      version: Number(row.version_number),
    });
  }
}
export class SupabaseGuidebookAuthoringObserver
  implements GuidebookAuthoringObserver
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async record(event: Parameters<GuidebookAuthoringObserver["record"]>[0]) {
    const { error } = await this.client
      .from("guidebook_activity")
      .insert({
        guidebook_id: event.guidebookId,
        event_type: event.name,
        safe_summary: `Guidebook command ${event.outcome}.`,
        metadata: {
          correlationId: event.correlationId,
          commandType: event.commandType,
          outcome: event.outcome,
          durationMs: event.durationMs,
          expectedRevision: event.expectedRevision,
          resultingRevision: event.resultingRevision,
          failureClass: event.failureClass,
        },
        occurred_at: new Date().toISOString(),
      });
    if (error) throw classified("OBSERVABILITY_UNAVAILABLE");
  }
}
export class SupabaseGuidebookLifecycleRepository
  implements GuidebookLifecycleRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async load(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ) {
    const { data, error } = await this.client
      .from("guidebooks")
      .select("property_id,status,revision")
      .eq("id", scope.guidebookId)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw classified("DRAFT_PERSIST_FAILED");
    return data
      ? {
          propertyId: String(data.property_id),
          status: String(data.status) as "draft" | "published" | "archived",
          revision: Number(data.revision),
        }
      : null;
  }
  async archive(context: CommandContext) {
    return this.mutate("archive_guidebook_canonical", context);
  }
  async restore(context: CommandContext) {
    return this.mutate("restore_guidebook_canonical", context);
  }
  async restoreVersion(context: CommandContext, versionId: string) {
    return this.mutate("restore_guidebook_version_canonical", context, {
      p_version_id: versionId,
    });
  }
  private async mutate(
    name: string,
    context: CommandContext,
    extra: Readonly<Record<string, unknown>> = {},
  ) {
    const { data, error } = await this.client.rpc(name, {
      p_guidebook_id: context.guidebookId,
      p_workspace_id: context.workspaceId,
      p_expected_revision: context.expectedRevision,
      p_actor_id: context.actorId,
      p_command_id: context.commandId,
      ...extra,
    });
    if (error)
      throw classified(
        error.message.includes("conflict")
          ? "DRAFT_CONFLICT"
          : "DRAFT_PERSIST_FAILED",
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw classified("DRAFT_PERSIST_FAILED");
    return {
      guidebookId: context.guidebookId,
      revision: Number(row.revision),
      status: String(row.status) as "draft" | "archived",
    };
  }
}
export class SupabaseGuidebookCreationRepository
  implements GuidebookCreationRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async create(input: Parameters<GuidebookCreationRepository["create"]>[0]) {
    const { data, error } = await this.client.rpc(
      "create_guidebook_with_receipt",
      {
        p_workspace_id: input.context.workspaceId,
        p_property_id: input.propertyId,
        p_title: input.title,
        p_actor_id: input.context.actorId,
        p_command_id: input.context.commandId,
        p_fingerprint: input.fingerprint,
      },
    );
    if (error)
      throw classified(
        error.message.includes("in_progress")
          ? "COMMAND_ALREADY_IN_PROGRESS"
          : error.message.includes("receipt_conflict")
            ? "COMMAND_RECEIPT_CONFLICT"
            : "DRAFT_PERSIST_FAILED",
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw classified("DRAFT_PERSIST_FAILED");
    return {
      guidebookId: String(row.guidebook_id),
      revision: Number(row.revision),
      status: "draft" as const,
    };
  }
}
function legacyBlock(row: Record<string, unknown>): AuthoringBlock {
  const type = String(row.block_type),
    content = (row.content ?? {}) as Record<string, unknown>,
    base = {
      id: String(row.id),
      schemaVersion: GUIDEBOOK_BLOCK_SCHEMA,
      position: Number(row.position),
      visible: row.guest_safe !== false,
    };
  switch (type) {
    case "heading":
      return {
        ...base,
        type,
        content: { text: String(content.text ?? ""), level: 2 },
      };
    case "rich-text":
      return {
        ...base,
        type,
        content: { text: String(content.markdown ?? content.text ?? "") },
      };
    case "image":
      return {
        ...base,
        type,
        content: {
          mediaRef: String(content.storagePath ?? content.url ?? ""),
          alt: String(content.alt ?? ""),
          ...(content.caption ? { caption: String(content.caption) } : {}),
        },
      };
    case "instruction":
      return {
        ...base,
        type,
        content: {
          ...(content.title ? { title: String(content.title) } : {}),
          steps: Array.isArray(content.steps)
            ? content.steps.map((value, index) =>
                typeof value === "object"
                  ? (value as { id: string; text: string })
                  : { id: `step-${index}`, text: String(value) },
              )
            : [],
          emphasis: content.emphasis === "important" ? "important" : "standard",
        },
      };
    case "contact":
      return {
        ...base,
        type,
        content: {
          name: String(content.name ?? ""),
          ...(content.role ? { role: String(content.role) } : {}),
          ...(content.phone
            ? { phone: String(content.phone), action: "phone" as const }
            : {}),
        },
      };
    case "location":
      return {
        ...base,
        type,
        content: {
          label: String(content.label ?? "Location"),
          destination: String(content.destination ?? content.text ?? ""),
          ...(content.url ? { mapUrl: String(content.url) } : {}),
        },
      };
    case "link":
      return {
        ...base,
        type,
        content: {
          label: String(content.label ?? "Open"),
          url: String(content.url ?? ""),
        },
      };
    case "callout":
      return {
        ...base,
        type,
        content: {
          kind: ["information", "reminder", "warning"].includes(
            String(content.kind),
          )
            ? (content.kind as "information" | "reminder" | "warning")
            : "information",
          body: String(content.body ?? content.text ?? ""),
        },
      };
    case "checklist":
      return {
        ...base,
        type,
        content: {
          items: (Array.isArray(content.items) ? content.items : []).map(
            (value, index) =>
              typeof value === "object"
                ? (value as { id: string; text: string })
                : { id: `item-${index}`, text: String(value) },
          ),
        },
      };
    default:
      throw classified("BLOCK_TYPE_UNSUPPORTED");
  }
}
function classified(code: string) {
  return Object.assign(
    new Error("The Guidebook operation could not be completed."),
    { code },
  );
}

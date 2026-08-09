"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateGuidebookPropertyInput } from "@/features/property-capabilities";
import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import {
  archiveGuidebook,
  createGuidebookWithReceipt,
  createGuidebookBlock,
  createGuidebookSection,
  deleteGuidebookBlock,
  deleteGuidebookSection,
  duplicateGuidebookBlock,
  duplicateGuidebookSection,
  loadGuidebookEngagementSummary,
  publishGuidebookVersion,
  restoreGuidebook,
  restoreHistoricalGuidebookContent,
  renameGuidebookSection,
  reorderGuidebookBlocks,
  reorderGuidebookSections,
  restoreGuidebookSections,
  setGuidebookBlockVisibility,
  setGuidebookSectionVisibility,
  updateGuidebookBlock,
  updateGuidebookBrand,
  withGuidebookOperationDeadline,
  SupabaseGuidebookAnalyticsRepository,
  SupabaseGuidebookAuthoringObserver,
  SupabaseGuidebookCommandReceiptRepository,
  SupabaseGuidebookCreationRepository,
  SupabaseGuidebookDraftRepository,
  SupabaseGuidebookLifecycleRepository,
  SupabaseGuidebookMediaRepository,
  SupabaseGuidebookSlugRepository,
  uploadGuidebookMedia,
  rotateGuidebookPublicSlug,
  SupabaseGuidebookPropertyProjectionRepository,
  SupabasePublishedGuidebookVersionRepository,
  type AuthoringBlock,
  type AuthoringBlockType,
  type AuthoringSection,
  type CommandContext,
  type GuidebookBrandIdentity,
} from "@/features/guidebook-studio";
import { getSessionProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getCommerceAccessWorkspace } from "./commerce-access";

type Command =
  | { type: "create-section"; name: string; afterSectionId?: string }
  | { type: "rename-section"; sectionId: string; name: string }
  | { type: "reorder-section"; sectionId: string; direction: "up" | "down" }
  | { type: "section-visibility"; sectionId: string; visible: boolean }
  | { type: "duplicate-section"; sectionId: string }
  | { type: "delete-section"; sectionId: string }
  | {
      type: "create-block";
      sectionId: string;
      blockType: AuthoringBlockType;
      componentKey?: string;
    }
  | { type: "update-block"; sectionId: string; block: AuthoringBlock }
  | {
      type: "reorder-block";
      sectionId: string;
      blockId: string;
      direction: "up" | "down";
    }
  | {
      type: "block-visibility";
      sectionId: string;
      blockId: string;
      visible: boolean;
    }
  | { type: "duplicate-block"; sectionId: string; blockId: string }
  | { type: "delete-block"; sectionId: string; blockId: string }
  | { type: "restore-sections"; sections: readonly AuthoringSection[] }
  | { type: "update-brand"; brand: GuidebookBrandIdentity };

export async function uploadGuidebookMediaAction(formData: FormData) {
  try {
    const guidebookId = String(formData.get("guidebookId") ?? ""),
      workspaceId = String(formData.get("workspaceId") ?? ""),
      commandId = String(formData.get("commandId") ?? crypto.randomUUID()),
      file = formData.get("file");
    if (!(file instanceof File))
      return { ok: false as const, code: "MEDIA_TYPE_UNSUPPORTED" };
    const { user, access } = await authorized(workspaceId, "guidebooks.manage"),
      draft = await withGuidebookOperationDeadline(
        () =>
          new SupabaseGuidebookDraftRepository().load({
            workspaceId: access.workspaceId,
            guidebookId,
            actorId: user.id,
          }),
        5000,
        "COMMAND_TIMEOUT",
      );
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId))
      return denied();
    return uploadGuidebookMedia(
      {
        media: new SupabaseGuidebookMediaRepository(),
        receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
      },
      {
        commandId,
        correlationId: crypto.randomUUID(),
        actorId: user.id,
        workspaceId: access.workspaceId,
        guidebookId,
        expectedRevision: draft.revision,
        enteredAt: new Date().toISOString(),
      },
      { mimeType: file.type, bytes: await file.arrayBuffer() },
    );
  } catch {
    return {
      ok: false as const,
      status: "persistence-failure" as const,
      code: "MEDIA_UPLOAD_FAILED",
      message: "The image could not be uploaded.",
    };
  }
}

export async function listGuidebookDraftMediaAction(input: {
  workspaceId: string;
  guidebookId: string;
}): Promise<
  { id: string; mimeType: string; url: string; width?: number; height?: number }[]
> {
  const { access } = await authorized(input.workspaceId, "guidebooks.manage");
  const media = await new SupabaseGuidebookMediaRepository().listReady({
    workspaceId: access.workspaceId,
    guidebookId: input.guidebookId,
  });
  return [...media];
}

export async function rotateGuidebookPublicSlugAction(formData: FormData) {
  try {
    const guidebookId = String(formData.get("guidebookId") ?? ""),
      workspaceId = String(formData.get("workspaceId") ?? ""),
      expectedRevision = Number(formData.get("revision")),
      commandId = String(formData.get("commandId") ?? crypto.randomUUID()),
      { user, access } = await authorized(workspaceId, "guidebooks.manage"),
      draft = await new SupabaseGuidebookDraftRepository().load({
        workspaceId: access.workspaceId,
        guidebookId,
        actorId: user.id,
      });
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId))
      return denied();
    const bytes = crypto.getRandomValues(new Uint8Array(18)),
      slug = Array.from(bytes, (value) => value.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 32),
      expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    return rotateGuidebookPublicSlug(
      {
        slugs: new SupabaseGuidebookSlugRepository(),
        receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
      },
      {
        commandId,
        correlationId: crypto.randomUUID(),
        actorId: user.id,
        workspaceId: access.workspaceId,
        guidebookId,
        expectedRevision,
        enteredAt: new Date().toISOString(),
      },
      { slug, expiresAt },
    );
  } catch {
    return {
      ok: false as const,
      code: "PUBLIC_SLUG_CONFLICT",
      status: "conflict" as const,
      message: "The public link could not be rotated.",
    };
  }
}

export async function createGuidebookAction(formData: FormData) {
  await createGuidebookResultAction(formData);
}

export async function createGuidebookPropertyAction(
  input: Readonly<{
    workspaceId: string;
    name: string;
    address?: string;
    city: string;
    state: string;
    postalCode?: string;
    country: string;
    propertyType: string;
    timezone: string;
    bedrooms?: number;
    bathrooms?: number;
    guestCapacity?: number;
    shortDescription?: string;
    createAnyway?: boolean;
    commandId: string;
  }>,
) {
  try {
    const { access } = await authorized(input.workspaceId, "guidebooks.manage");
    const validation = validateGuidebookPropertyInput({
      workspaceId: access.workspaceId,
      name: input.name,
      propertyType: input.propertyType,
      city: input.city,
      state: input.state,
      country: input.country,
      timezone: input.timezone,
      maxGuests: input.guestCapacity ?? 0,
      address: input.address,
      postalCode: input.postalCode,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
    });
    if (!validation.valid)
      return {
        ok: false as const,
        code: "PROPERTY_INVALID",
        fields: validation.fields,
        message: "Complete the required Guidebook property details.",
      };
    // This RPC intentionally derives the actor from auth.uid(). Use the
    // request-scoped client so the customer's JWT reaches the security-definer
    // function; the service-role client has no user identity.
    const client = await createClient();
    const { data, error } = await client.rpc("create_guidebook_flow_property", {
      p_workspace_id: access.workspaceId,
      p_name: input.name.trim(),
      p_address: input.address?.trim() ?? "",
      p_city: input.city.trim(),
      p_state: input.state.trim(),
      p_postal_code: input.postalCode?.trim() ?? "",
      p_country: input.country.trim(),
      p_property_type: input.propertyType,
      p_timezone: input.timezone,
      p_bedrooms: input.bedrooms ?? 0,
      p_bathrooms: input.bathrooms ?? 0,
      p_max_guests: input.guestCapacity,
      p_short_description: input.shortDescription ?? "",
      p_command_id: input.commandId,
      p_create_anyway: input.createAnyway ?? false,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.duplicate_property_id && !row?.property_id)
      return {
        ok: false as const,
        code: "DUPLICATE_PROPERTY",
        duplicatePropertyId: String(row.duplicate_property_id),
        message: "We found a property that may already match this address.",
      };
    if (!row?.property_id) throw new Error("property_not_created");
    return {
      ok: true as const,
      property: {
        id: String(row.property_id),
        name: input.name.trim(),
        location: [input.city, input.state].join(", "),
        image: null,
        capabilities: ["guidebook"] as const,
        hasActiveGuidebook: false,
      },
    };
  } catch {
    return {
      ok: false as const,
      code: "PROPERTY_CREATE_FAILED",
      message: "We couldn't save the property. Please try again.",
    };
  }
}

export async function listGuidebookPropertyOptionsAction(workspaceId: string) {
  const { access } = await authorized(workspaceId, "guidebooks.manage");
  const admin = createAdminClient();
  const { data: capabilityRows, error: capabilityError } = await admin
    .from("property_capability_enrollments")
    .select("property_id,capability,status")
    .eq("workspace_id", access.workspaceId)
    .in("capability", ["guidebook", "hpm"])
    .eq("status", "enabled");
  if (capabilityError) throw capabilityError;
  const capabilityMap = new Map<string, Set<string>>();
  for (const row of capabilityRows ?? []) {
    const id = String(row.property_id);
    const values = capabilityMap.get(id) ?? new Set<string>();
    values.add(String(row.capability));
    capabilityMap.set(id, values);
  }
  const accessibleIds = [...capabilityMap.keys()].filter((id) =>
    evaluatePropertyAccess(access, id),
  );
  if (!accessibleIds.length) return [];
  const [{ data: properties, error: propertyError }, { data: guidebooks, error: guidebookError }] =
    await Promise.all([
      admin
        .from("properties")
        .select("id,name,city,state,featured_image")
        .eq("owner_id", access.ownerId)
        .in("id", accessibleIds),
      admin
        .from("guidebooks")
        .select("property_id,status")
        .eq("workspace_id", access.workspaceId)
        .neq("status", "archived")
        .in("property_id", accessibleIds),
    ]);
  if (propertyError || guidebookError) throw propertyError ?? guidebookError;
  const active = new Set((guidebooks ?? []).map((row) => String(row.property_id)));
  return (properties ?? []).map((property) => ({
    id: String(property.id),
    name: String(property.name),
    location: [property.city, property.state].filter(Boolean).join(", "),
    image: property.featured_image ? String(property.featured_image) : null,
    capabilities: [...(capabilityMap.get(String(property.id)) ?? [])],
    hasActiveGuidebook: active.has(String(property.id)),
  }));
}
export async function createGuidebookResultAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? ""),
    propertyId = String(formData.get("propertyId") ?? ""),
    title = String(formData.get("title") ?? ""),
    commandId = String(formData.get("commandId") ?? `create:${propertyId}`);
  const { user, access } = await authorized(workspaceId, "guidebooks.manage");
  if (!evaluatePropertyAccess(access, propertyId)) return denied();
  const commerce = await withGuidebookOperationDeadline(
      () =>
        getCommerceAccessWorkspace({
          workspaceId: access.workspaceId,
          propertyId,
        }),
      5000,
      "COMMAND_TIMEOUT",
    ),
    canCreate =
      commerce?.entitlements.some(
        (item) =>
          item.key === "guidebooks.create" && item.status === "available",
      ) ?? false;
  if (!canCreate)
    return {
      ok: false as const,
      status: "unauthorized" as const,
      code: "GUIDEBOOK_UNAUTHORIZED" as const,
      message: "Guidebook creation is not permitted.",
    };
  const context: CommandContext = {
    commandId,
    correlationId: crypto.randomUUID(),
    actorId: user.id,
    workspaceId: access.workspaceId,
    guidebookId: propertyId,
    expectedRevision: 0,
    enteredAt: new Date().toISOString(),
  };
  const drafts = new SupabaseGuidebookDraftRepository();
  const result = await createGuidebookWithReceipt(
    {
      drafts,
      receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
      creation: new SupabaseGuidebookCreationRepository(),
      timeoutMs: 5000,
    },
    context,
    { propertyId, title },
  );
  if (result.ok) {
    // Selecting an existing HPM property adds Guidebook capability to the same
    // canonical identity. The upsert is safe when a retry resumes creation.
    const { error: capabilityError } = await createAdminClient()
      .from("property_capability_enrollments")
      .upsert(
        {
          workspace_id: access.workspaceId,
          property_id: propertyId,
          capability: "guidebook",
          status: "enabled",
          source: "studio",
          created_by: user.id,
          enabled_at: new Date().toISOString(),
          disabled_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "property_id,capability" },
      );
    if (capabilityError) throw capabilityError;
    const brand = {
      logoUrl: String(formData.get("brandLogoUrl") ?? ""),
      primaryColor: String(formData.get("brandPrimaryColor") ?? ""),
      accentColor: String(formData.get("brandAccentColor") ?? ""),
    };
    if (brand.logoUrl || brand.primaryColor || brand.accentColor) {
      const draft = await drafts.load({
        workspaceId: access.workspaceId,
        guidebookId: result.value.guidebookId,
        actorId: user.id,
      });
      if (draft) {
        const persistedAt = new Date().toISOString();
        await drafts.save(
          { ...context, guidebookId: result.value.guidebookId, expectedRevision: draft.revision },
          {
            ...draft,
            brand,
            revision: draft.revision + 1,
            persistedAt,
            persistedBy: user.id,
          },
        );
      }
    }
    redirect(`/dashboard/guidebooks/${result.value.guidebookId}/setup`);
  }
  return result;
}

export async function archiveGuidebookAction(formData: FormData) {
  await lifecycleAction(formData, "archive");
}
export async function restoreArchivedGuidebookAction(formData: FormData) {
  await lifecycleAction(formData, "restore");
}
export async function restoreGuidebookVersionAction(formData: FormData) {
  await lifecycleAction(formData, "restore-version");
}
export async function archiveGuidebookResultAction(formData: FormData) {
  return lifecycleAction(formData, "archive");
}
export async function restoreArchivedGuidebookResultAction(formData: FormData) {
  return lifecycleAction(formData, "restore");
}
export async function restoreGuidebookVersionResultAction(formData: FormData) {
  return lifecycleAction(formData, "restore-version");
}
async function lifecycleAction(
  formData: FormData,
  operation: "archive" | "restore" | "restore-version",
) {
  const guidebookId = String(formData.get("guidebookId") ?? ""),
    expectedRevision = Number(formData.get("revision")),
    commandId = String(
      formData.get("commandId") ??
        `${operation}:${guidebookId}:${expectedRevision}:${String(formData.get("versionId") ?? "")}`,
    );
  const repository = new SupabaseGuidebookLifecycleRepository(),
    session = await withGuidebookOperationDeadline(
      () => getSessionProfile(),
      5000,
      "COMMAND_TIMEOUT",
    );
  if (!session.user) return denied();
  const preliminary = await withGuidebookOperationDeadline(
    () =>
      repository.load({
        workspaceId: String(formData.get("workspaceId") ?? ""),
        guidebookId,
        actorId: session.user!.id,
      }),
    5000,
    "COMMAND_TIMEOUT",
  );
  if (!preliminary) return denied();
  const { user, access } = await authorized(
    String(formData.get("workspaceId") ?? ""),
    "guidebooks.manage",
  );
  if (!evaluatePropertyAccess(access, preliminary.propertyId)) return denied();
  const context: CommandContext = {
      commandId,
      correlationId: crypto.randomUUID(),
      actorId: user.id,
      workspaceId: access.workspaceId,
      guidebookId,
      expectedRevision,
      enteredAt: new Date().toISOString(),
    },
    deps = {
      drafts: new SupabaseGuidebookDraftRepository(),
      receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
      lifecycle: repository,
      observer: new SupabaseGuidebookAuthoringObserver(),
      timeoutMs: 5000,
    };
  return operation === "archive"
    ? archiveGuidebook(deps, context)
    : operation === "restore"
      ? restoreGuidebook(deps, context)
      : restoreHistoricalGuidebookContent(deps, context, {
          versionId: String(formData.get("versionId") ?? ""),
        });
}

export async function loadGuidebookAuthoringAction(
  input: Readonly<{ workspaceId: string; guidebookId: string }>,
) {
  try {
    const { user, access } = await authorized(
      input.workspaceId,
      "guidebooks.view",
    );
    const draft = await withGuidebookOperationDeadline(
      () =>
        new SupabaseGuidebookDraftRepository().load({
          workspaceId: access.workspaceId,
          guidebookId: input.guidebookId,
          actorId: user.id,
        }),
      5000,
      "DRAFT_PERSIST_TIMEOUT",
    );
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId))
      return denied();
    return {
      ok: true as const,
      draft,
      canEdit: evaluateWorkspacePermission(access, "guidebooks.manage"),
    };
  } catch (error) {
    if (errorCode(error) === "GUIDEBOOK_UNAUTHORIZED") return denied();
    return {
      ok: false as const,
      status: "timeout" as const,
      code: "DRAFT_PERSIST_TIMEOUT" as const,
      message: "The durable guidebook draft did not load in time.",
    };
  }
}

export async function publishCanonicalGuidebookAction(
  input: Readonly<{
    workspaceId: string;
    guidebookId: string;
    expectedRevision: number;
    commandId: string;
  }>,
) {
  try {
    const { user, access } = await authorized(
        input.workspaceId,
        "guidebooks.manage",
      ),
      drafts = new SupabaseGuidebookDraftRepository(),
      draft = await withGuidebookOperationDeadline(
        () =>
          drafts.load({
            workspaceId: access.workspaceId,
            guidebookId: input.guidebookId,
            actorId: user.id,
          }),
        5000,
        "PUBLICATION_TIMEOUT",
      );
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId))
      return denied();
    const commerce = await withGuidebookOperationDeadline(
        () =>
          getCommerceAccessWorkspace({
            workspaceId: access.workspaceId,
            propertyId: draft.propertyId,
          }),
        5000,
        "PUBLICATION_TIMEOUT",
      ),
      enabled = (key: string) =>
        commerce?.entitlements.some(
          (item) => item.key === key && item.status === "available",
        ) ?? false;
    if (!enabled("guidebooks.publish") || !enabled("guidebooks.host"))
      return denied();
    const context: CommandContext = {
      commandId: input.commandId,
      correlationId: crypto.randomUUID(),
      actorId: user.id,
      workspaceId: access.workspaceId,
      guidebookId: input.guidebookId,
      // The server-loaded canonical draft is authoritative. A concurrent change
      // after this load is still rejected by the publication repository.
      expectedRevision: draft.revision,
      enteredAt: new Date().toISOString(),
    };
    return publishGuidebookVersion(
      {
        drafts,
        receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
        properties: new SupabaseGuidebookPropertyProjectionRepository(),
        versions: new SupabasePublishedGuidebookVersionRepository(),
        media: new SupabaseGuidebookMediaRepository(),
        observer: new SupabaseGuidebookAuthoringObserver(),
        timeoutMs: 5000,
      },
      context,
    );
  } catch (error) {
    return timeoutOrDenied(
      error,
      "PUBLICATION_TIMEOUT",
      "Publishing did not complete in time. The active version remains unchanged.",
    );
  }
}

export async function loadGuidebookAnalyticsSummaryAction(
  input: Readonly<{ workspaceId?: string; guidebookId: string }>,
) {
  const correlationId = crypto.randomUUID();
  observeAnalyticsTransport(correlationId, "entered");
  try {
    const { user, access } = await authorized(
        input.workspaceId,
        "guidebooks.view",
      ),
      draft = await withGuidebookOperationDeadline(
        () =>
          new SupabaseGuidebookDraftRepository().load({
            workspaceId: access.workspaceId,
            guidebookId: input.guidebookId,
            actorId: user.id,
          }),
        5000,
        "ANALYTICS_UNAVAILABLE",
      );
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId)) {
      observeAnalyticsTransport(correlationId, "denied");
      return denied();
    }
    return loadGuidebookEngagementSummary(
      {
        drafts: new SupabaseGuidebookDraftRepository(),
        receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
        analytics: new SupabaseGuidebookAnalyticsRepository(),
        observer: new SupabaseGuidebookAuthoringObserver(),
        timeoutMs: 5000,
      },
      {
        workspaceId: access.workspaceId,
        guidebookId: input.guidebookId,
        actorId: user.id,
        correlationId,
      },
    );
  } catch (error) {
    observeAnalyticsTransport(
      correlationId,
      errorCode(error) === "GUIDEBOOK_UNAUTHORIZED"
        ? "denied"
        : errorCode(error) === "COMMAND_TIMEOUT"
          ? "timed-out"
          : "failed",
    );
    return timeoutOrDenied(
      error,
      "ANALYTICS_UNAVAILABLE",
      "Analytics are unavailable.",
    );
  }
}
function observeAnalyticsTransport(
  correlationId: string,
  outcome: "entered" | "denied" | "timed-out" | "failed",
) {
  console.warn("guidebook_analytics_load", { correlationId, outcome });
}

export async function guidebookAuthoringCommandAction(
  input: Readonly<{
    workspaceId: string;
    guidebookId: string;
    expectedRevision: number;
    commandId: string;
    command: Command;
  }>,
) {
  try {
    const { user, access } = await authorized(
        input.workspaceId,
        "guidebooks.manage",
      ),
      drafts = new SupabaseGuidebookDraftRepository(),
      draft = await withGuidebookOperationDeadline(
        () =>
          drafts.load({
            workspaceId: access.workspaceId,
            guidebookId: input.guidebookId,
            actorId: user.id,
          }),
        5000,
        "COMMAND_TIMEOUT",
      );
    if (!draft || !evaluatePropertyAccess(access, draft.propertyId))
      return denied();
    const deps = {
        drafts,
        receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
        observer: new SupabaseGuidebookAuthoringObserver(),
        timeoutMs: 5000,
      },
      context: CommandContext = {
        commandId: input.commandId,
        correlationId: crypto.randomUUID(),
        actorId: user.id,
        workspaceId: access.workspaceId,
        guidebookId: input.guidebookId,
        expectedRevision: input.expectedRevision,
        enteredAt: new Date().toISOString(),
      };
    switch (input.command.type) {
      case "create-section":
        return createGuidebookSection(deps, context, input.command);
      case "rename-section":
        return renameGuidebookSection(deps, context, input.command);
      case "reorder-section":
        return reorderGuidebookSections(deps, context, input.command);
      case "section-visibility":
        return setGuidebookSectionVisibility(deps, context, input.command);
      case "duplicate-section":
        return duplicateGuidebookSection(deps, context, input.command);
      case "delete-section":
        return deleteGuidebookSection(deps, context, input.command);
      case "create-block":
        return createGuidebookBlock(deps, context, {
          sectionId: input.command.sectionId,
          type: input.command.blockType,
          componentKey: input.command.componentKey,
        });
      case "update-block":
        return updateGuidebookBlock(deps, context, input.command);
      case "reorder-block":
        return reorderGuidebookBlocks(deps, context, input.command);
      case "block-visibility":
        return setGuidebookBlockVisibility(deps, context, input.command);
      case "duplicate-block":
        return duplicateGuidebookBlock(deps, context, input.command);
      case "delete-block":
        return deleteGuidebookBlock(deps, context, input.command);
      case "restore-sections":
        return restoreGuidebookSections(deps, context, input.command);
      case "update-brand":
        return updateGuidebookBrand(deps, context, input.command);
    }
  } catch (error) {
    if (errorCode(error) === "GUIDEBOOK_UNAUTHORIZED") return denied();
    return {
      ok: false as const,
      status: "timeout" as const,
      code: "COMMAND_TIMEOUT" as const,
      message: "The authoring command did not complete in time.",
    };
  }
}
function denied() {
  return {
    ok: false as const,
    status: "unauthorized" as const,
    code: "GUIDEBOOK_UNAUTHORIZED" as const,
    message: "Guidebook authoring is not permitted.",
  };
}
async function authorized(
  workspaceId: string | undefined,
  permission: "guidebooks.view" | "guidebooks.manage",
) {
  const session = await withGuidebookOperationDeadline(
    () => getSessionProfile(),
    5000,
    "COMMAND_TIMEOUT",
  );
  if (!session.user)
    throw Object.assign(new Error("unauthorized"), {
      code: "GUIDEBOOK_UNAUTHORIZED",
    });
  const access = await withGuidebookOperationDeadline(
    () =>
      resolveWorkspaceAccessContext(
        new SupabaseTeamAccessRepository(),
        session.user!.id,
        workspaceId,
      ),
    5000,
    "COMMAND_TIMEOUT",
  );
  if (!evaluateWorkspacePermission(access, permission))
    throw Object.assign(new Error("unauthorized"), {
      code: "GUIDEBOOK_UNAUTHORIZED",
    });
  return { user: session.user, access };
}
function timeoutOrDenied(
  error: unknown,
  timeoutCode: "PUBLICATION_TIMEOUT" | "ANALYTICS_UNAVAILABLE",
  message: string,
) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  return code === "GUIDEBOOK_UNAUTHORIZED"
    ? denied()
    : {
        ok: false as const,
        status: "timeout" as const,
        code: timeoutCode,
        message,
      };
}
function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
}

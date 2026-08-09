"use server";

import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canTransitionLibraryStatus,
  contentPayload,
  libraryArtifactTypes,
  libraryStatuses,
  type LibraryArtifactType,
  type LibraryStatus,
  validateMediaBytes,
} from "@/features/guidebook-libraries";
import {
  SupabaseGuidebookDraftRepository,
  type GuidebookBrandIdentity,
} from "@/features/guidebook-studio";

type Row = Record<string, unknown>;
const routes: Record<LibraryArtifactType, string> = {
  content: "/admin/guidebooks/content",
  component: "/admin/guidebooks/components",
  template: "/admin/guidebooks/templates",
  media: "/admin/guidebooks/media",
};

async function adminContext() {
  const { user, profile } = await requireRole(["admin"]);
  return {
    db: createAdminClient(),
    user,
    role: profile?.role ?? "admin",
    correlationId: crypto.randomUUID(),
  };
}

async function audit(
  db: ReturnType<typeof createAdminClient>,
  input: {
    actorId: string;
    role: string;
    action: string;
    targetId?: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await db.from("admin_audit_events").insert({
    actor_id: input.actorId,
    actor_role: input.role,
    action: input.action,
    category: "guidebook_libraries",
    target_type: "guidebook_library_artifact",
    target_id: input.targetId ?? null,
    result: "succeeded",
    correlation_id: input.correlationId,
    source: "server_action",
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error("library_audit_failed");
}

export async function getGuidebookLibraries(
  input: {
    type?: LibraryArtifactType;
    q?: string;
    category?: string;
    status?: string;
    tag?: string;
  } = {},
) {
  await requireRole(["admin"]);
  const db = createAdminClient();
  let query = db
    .from("guidebook_library_artifacts")
    .select(
      "*,guidebook_library_versions!guidebook_library_versions_artifact_id_fkey(id,version_number,status,payload,change_summary,created_at,published_at)",
    )
    .order("updated_at", { ascending: false });
  if (input.type) query = query.eq("artifact_type", input.type);
  if (input.q) query = query.ilike("name", `%${input.q.slice(0, 100)}%`);
  if (input.category) query = query.eq("category", input.category);
  if (input.status) query = query.eq("status", input.status);
  if (input.tag) query = query.contains("tags", [input.tag]);
  const [
    { data: artifactRows, error },
    { data: collections },
    { data: mediaFiles },
    { data: recentActivity },
    { count: furnishingPackages },
  ] = await Promise.all([
    query.limit(250),
    db.from("guidebook_media_collections").select("*").order("name"),
    db
      .from("guidebook_library_media_files")
      .select("*,guidebook_library_versions!inner(artifact_id)")
      .order("uploaded_at", { ascending: false }),
    db
      .from("admin_audit_events")
      .select("id,action,target_id,occurred_at,metadata")
      .eq("category", "guidebook_libraries")
      .order("occurred_at", { ascending: false })
      .limit(12),
    db.from("furnishing_packages").select("id", { count: "exact", head: true }),
  ]);
  if (error)
    return {
      ok: false as const,
      error: error.message,
      artifacts: [],
      collections: [],
      mediaFiles: [],
      recentActivity: [],
      furnishingPackages: 0,
    };
  const versionIds = (artifactRows ?? []).flatMap((artifact) =>
    ((artifact.guidebook_library_versions as Row[]) ?? []).map((version) =>
      String(version.id),
    ),
  );
  const { data: usageRows } = versionIds.length
    ? await db
        .from("guidebook_library_usage")
        .select("source_version_id")
        .in("source_version_id", versionIds)
    : { data: [] };
  const usageByVersion = new Map<string, number>();
  for (const usage of usageRows ?? []) {
    const id = String(usage.source_version_id);
    usageByVersion.set(id, (usageByVersion.get(id) ?? 0) + 1);
  }
  const artifacts = (artifactRows ?? []).map((artifact) => ({
    ...artifact,
    usage_count: ((artifact.guidebook_library_versions as Row[]) ?? []).reduce(
      (total, version) => total + (usageByVersion.get(String(version.id)) ?? 0),
      0,
    ),
  }));
  return {
    ok: true as const,
    artifacts,
    collections: collections ?? [],
    mediaFiles: mediaFiles ?? [],
    recentActivity: recentActivity ?? [],
    furnishingPackages: furnishingPackages ?? 0,
  };
}

export async function getGuidebookLibraryArtifact(id: string) {
  await requireRole(["admin"]);
  const db = createAdminClient();
  const { data: artifact, error } = await db
    .from("guidebook_library_artifacts")
    .select(
      "*,guidebook_library_versions!guidebook_library_versions_artifact_id_fkey(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !artifact) return null;
  const versions = ((artifact.guidebook_library_versions as Row[]) ?? []).sort(
    (a, b) => Number(b.version_number) - Number(a.version_number),
  );
  const versionIds = versions.map((version) => String(version.id));
  const [{ data: usages }, { data: mediaFile }] = await Promise.all([
    versionIds.length
      ? db
          .from("guidebook_library_usage")
          .select("*")
          .in("source_version_id", versionIds)
          .order("accepted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    versionIds.length
      ? db
          .from("guidebook_library_media_files")
          .select("*,guidebook_media_collections(name)")
          .in("version_id", versionIds)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    artifact: { ...artifact, guidebook_library_versions: versions },
    usages: usages ?? [],
    mediaFile,
  };
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function typeFrom(value: FormDataEntryValue | null): LibraryArtifactType {
  const type = String(value ?? "");
  if (!libraryArtifactTypes.includes(type as LibraryArtifactType))
    throw new Error("invalid_artifact_type");
  return type as LibraryArtifactType;
}

export async function createLibraryArtifactAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const type = typeFrom(formData.get("artifactType"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("artifact_name_required");
  const canonicalKey = slug(String(formData.get("canonicalKey") ?? name));
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "general");
  const body = String(formData.get("body") ?? description);
  const payload =
    type === "content"
      ? {
          ...contentPayload(
            body,
            String(formData.get("requiredVariables") ?? "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
          recordType: String(formData.get("recordType") ?? "rich_text"),
          fields: parseStructuredFields(formData.get("typedFieldsJson")),
        }
      : { variant: "minimal", settings: {}, sections: [] };
  const { data: artifact, error } = await db
    .from("guidebook_library_artifacts")
    .insert({
      artifact_type: type,
      canonical_key: canonicalKey,
      name,
      description,
      category,
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      status: "draft",
      ...(type === "content"
        ? { content_record_type: String(formData.get("recordType") ?? "rich_text") }
        : {}),
      current_version_number: 1,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: versionError } = await db
    .from("guidebook_library_versions")
    .insert({
      artifact_id: artifact.id,
      version_number: 1,
      status: "draft",
      payload,
      change_summary: "Initial draft",
      created_by: user.id,
    });
  if (versionError) throw new Error(versionError.message);
  await audit(db, {
    actorId: user.id,
    role,
    action: `${type}_created`,
    targetId: artifact.id,
    correlationId,
    metadata: { artifactType: type, version: 1 },
  });
  revalidatePath(routes[type]);
  redirect(`${routes[type]}/${artifact.id}`);
}

export async function saveLibraryArtifactAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const id = String(formData.get("artifactId") ?? "");
  const { data: artifact } = await db
    .from("guidebook_library_artifacts")
    .select("*")
    .eq("id", id)
    .single();
  if (!artifact) throw new Error("artifact_not_found");
  const type = artifact.artifact_type as LibraryArtifactType;
  const { data: current } = await db
    .from("guidebook_library_versions")
    .select("*")
    .eq("artifact_id", id)
    .eq("version_number", artifact.current_version_number)
    .single();
  if (!current) throw new Error("artifact_version_not_found");
  const name = String(formData.get("name") ?? artifact.name).trim();
  const description = String(
    formData.get("description") ?? artifact.description,
  ).trim();
  const body = String(formData.get("body") ?? "");
  const payload =
    type === "content"
      ? {
          ...contentPayload(
            body,
            String(formData.get("requiredVariables") ?? "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          ),
          recordType: String(formData.get("recordType") ?? artifact.content_record_type ?? "rich_text"),
          fields: parseStructuredFields(formData.get("typedFieldsJson")),
        }
      : JSON.parse(
          String(
            formData.get("payload") ?? JSON.stringify(current.payload ?? {}),
          ),
        );
  let version = Number(artifact.current_version_number);
  if (["published", "approved"].includes(String(current.status))) {
    version += 1;
    const { error } = await db.from("guidebook_library_versions").insert({
      artifact_id: id,
      version_number: version,
      status: "draft",
      payload,
      change_summary: String(
        formData.get("changeSummary") ?? "Draft successor",
      ),
      supersedes_version_id: current.id,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("guidebook_library_versions")
      .update({
        payload,
        change_summary: String(
          formData.get("changeSummary") ??
            current.change_summary ??
            "Draft updated",
        ),
      })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
  }
  const { error } = await db
    .from("guidebook_library_artifacts")
    .update({
      name,
      description,
      category: String(formData.get("category") ?? artifact.category),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      current_version_number: version,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit(db, {
    actorId: user.id,
    role,
    action: `${type}_revision_created`,
    targetId: id,
    correlationId,
    metadata: { artifactType: type, version },
  });
  revalidatePath(`${routes[type]}/${id}`);
}

function parseStructuredFields(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("content_fields_invalid");
  return parsed as Record<string, unknown>;
}

export async function transitionLibraryArtifactAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const id = String(formData.get("artifactId") ?? "");
  const next = String(formData.get("status") ?? "") as LibraryStatus;
  if (!libraryStatuses.includes(next))
    throw new Error("invalid_library_status");
  const { data: artifact } = await db
    .from("guidebook_library_artifacts")
    .select("*")
    .eq("id", id)
    .single();
  if (!artifact) throw new Error("artifact_not_found");
  const { data: version } = await db
    .from("guidebook_library_versions")
    .select("*")
    .eq("artifact_id", id)
    .eq("version_number", artifact.current_version_number)
    .single();
  if (
    !version ||
    !canTransitionLibraryStatus(String(version.status) as LibraryStatus, next)
  )
    throw new Error("invalid_library_transition");
  if (
    (next === "published" || next === "approved") &&
    artifact.artifact_type === "media"
  ) {
    const { data: file } = await db
      .from("guidebook_library_media_files")
      .select("alt_text,processing_state,scan_status,collection_id")
      .eq("version_id", version.id)
      .single();
    if (!file?.alt_text || !file.collection_id || file.scan_status !== "clean")
      throw new Error("media_approval_requirements_incomplete");
  }
  const published = next === "published" || next === "approved";
  const { error } = await db
    .from("guidebook_library_versions")
    .update({
      status: next,
      ...(published
        ? { published_at: new Date().toISOString(), published_by: user.id }
        : {}),
    })
    .eq("id", version.id);
  if (error) throw new Error(error.message);
  await db
    .from("guidebook_library_artifacts")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  await audit(db, {
    actorId: user.id,
    role,
    action: `${artifact.artifact_type}_${next}`,
    targetId: id,
    correlationId,
    metadata: {
      artifactType: artifact.artifact_type,
      version: version.version_number,
      status: next,
    },
  });
  revalidatePath(
    `${routes[artifact.artifact_type as LibraryArtifactType]}/${id}`,
  );
}

export async function uploadLibraryMediaAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("media_file_required");
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "video/mp4",
    "application/pdf",
  ];
  if (!allowed.includes(file.type) || file.size > 52_428_800)
    throw new Error("media_validation_failed");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateMediaBytes(file.type, bytes);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { data: duplicate } = await db
    .from("guidebook_library_media_files")
    .select("version_id")
    .eq("checksum_sha256", checksum)
    .maybeSingle();
  if (duplicate) throw new Error("media_duplicate_detected");
  const name = String(formData.get("name") ?? file.name).trim();
  const key = `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: artifact, error } = await db
    .from("guidebook_library_artifacts")
    .insert({
      artifact_type: "media",
      canonical_key: key,
      name,
      description: String(formData.get("altText") ?? ""),
      category: "media",
      status: "processing",
      current_version_number: 1,
      created_by: user.id,
      metadata: {
        assetType: file.type.startsWith("image/")
          ? "image"
          : file.type === "video/mp4"
            ? "video"
            : "document",
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: versionError } = await db
    .from("guidebook_library_versions")
    .insert({
      artifact_id: artifact.id,
      version_number: 1,
      status: "processing",
      payload: {},
      change_summary: "Initial upload",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);
  const extension =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || "bin";
  const path = `canonical/${artifact.id}/v1/${checksum.slice(0, 16)}.${extension}`;
  const { error: uploadError } = await db.storage
    .from("guidebook-library-media")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { error: fileError } = await db
    .from("guidebook_library_media_files")
    .insert({
      version_id: version.id,
      collection_id: String(formData.get("collectionId") ?? "") || null,
      storage_path: path,
      original_file_name: file.name,
      mime_type: file.type,
      byte_size: file.size,
      checksum_sha256: checksum,
      alt_text: String(formData.get("altText") ?? "") || null,
      processing_state: "needs_review",
      scan_status: "clean",
      uploaded_by: user.id,
    });
  if (fileError) throw new Error(fileError.message);
  await Promise.all([
    db
      .from("guidebook_library_versions")
      .update({ status: "needs_review" })
      .eq("id", version.id),
    db
      .from("guidebook_library_artifacts")
      .update({ status: "needs_review", updated_at: new Date().toISOString() })
      .eq("id", artifact.id),
  ]);
  await audit(db, {
    actorId: user.id,
    role,
    action: "media_processing_completed",
    targetId: artifact.id,
    correlationId,
    metadata: {
      artifactType: "media",
      version: 1,
      mimeType: file.type,
      byteSize: file.size,
    },
  });
  revalidatePath(routes.media);
  redirect(`${routes.media}/${artifact.id}`);
}

export async function createGuidebookFromTemplateAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const templateId = String(formData.get("artifactId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  const supplied = JSON.parse(
    String(formData.get("variables") ?? "{}"),
  ) as Record<string, unknown>;
  const [{ data: template }, { data: property }] = await Promise.all([
    db
      .from("guidebook_library_artifacts")
      .select(
        "*,guidebook_library_versions!guidebook_library_versions_artifact_id_fkey(*)",
      )
      .eq("id", templateId)
      .eq("artifact_type", "template")
      .single(),
    db
      .from("properties")
      .select("id,owner_id,name,check_in_time,check_out_time")
      .eq("id", propertyId)
      .single(),
  ]);
  if (!template || !property) throw new Error("template_target_invalid");
  const templateVersion = (
    (template.guidebook_library_versions as Row[]) ?? []
  ).find(
    (row) =>
      Number(row.version_number) === Number(template.current_version_number),
  );
  if (!templateVersion || templateVersion.status !== "published")
    throw new Error("template_version_not_published");
  const payload = templateVersion.payload as Row;
  const sections = Array.isArray(payload.sections)
    ? (payload.sections as Row[])
    : [];
  const componentKeys = [
    ...new Set(
      sections.flatMap((section) =>
        Array.isArray(section.components)
          ? (section.components as unknown[]).map(String)
          : [],
      ),
    ),
  ];
  const { data: components } = componentKeys.length
    ? await db
        .from("guidebook_library_artifacts")
        .select(
          "*,guidebook_library_versions!guidebook_library_versions_artifact_id_fkey(*)",
        )
        .eq("artifact_type", "component")
        .in("canonical_key", componentKeys)
    : { data: [] };
  const contentKeys = [
    ...new Set(
      (components ?? [])
        .map((component) => {
          const version = (
            (component.guidebook_library_versions as Row[]) ?? []
          ).find(
            (row) =>
              Number(row.version_number) ===
              Number(component.current_version_number),
          );
          return String(
            (version?.payload as Row | undefined)?.contentKey ?? "",
          );
        })
        .filter(Boolean),
    ),
  ];
  const { data: contents } = contentKeys.length
    ? await db
        .from("guidebook_library_artifacts")
        .select(
          "*,guidebook_library_versions!guidebook_library_versions_artifact_id_fkey(*)",
        )
        .eq("artifact_type", "content")
        .in("canonical_key", contentKeys)
    : { data: [] };
  const variables: Record<string, unknown> = {
    property_name: property.name,
    check_in_time: property.check_in_time,
    check_out_time: property.check_out_time,
    ...supplied,
  };
  const required = new Set<string>();
  for (const content of contents ?? []) {
    const version = ((content.guidebook_library_versions as Row[]) ?? []).find(
      (row) =>
        Number(row.version_number) === Number(content.current_version_number),
    );
    for (const variable of ((version?.payload as Row | undefined)
      ?.requiredVariables as string[] | undefined) ?? [])
      required.add(variable);
  }
  const unresolved = [...required].filter(
    (variable) =>
      variables[variable] === undefined ||
      variables[variable] === null ||
      String(variables[variable]).trim() === "",
  );
  if (unresolved.length)
    throw new Error(`template_variables_unresolved:${unresolved.join(",")}`);
  const commandId = `template:${templateVersion.id}:property:${property.id}`;
  const { data: created, error } = await db.rpc(
    "create_guidebook_with_receipt",
    {
      p_workspace_id: property.owner_id,
      p_property_id: property.id,
      p_title: `${property.name} Guest Guide`,
      p_actor_id: user.id,
      p_command_id: commandId,
      p_fingerprint: createHash("sha256").update(commandId).digest("hex"),
    },
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(created) ? created[0] : created;
  const guidebookId = String(row.guidebook_id);
  const design = (payload.design as Row | undefined) ?? {};
  const designColors = (design.colors as Row | undefined) ?? {};
  const designTypography = (design.typography as Row | undefined) ?? {};
  const headingFamily = String(designTypography.headingFamily ?? "").trim();
  const brand: GuidebookBrandIdentity = {
    ...(typeof designColors.primary === "string"
      ? { primaryColor: designColors.primary }
      : {}),
    ...(typeof designColors.accent === "string"
      ? { accentColor: designColors.accent }
      : {}),
    ...(typeof designColors.background === "string"
      ? { backgroundColor: designColors.background }
      : {}),
    ...(typeof designColors.text === "string"
      ? { textColor: designColors.text }
      : {}),
    ...(headingFamily
      ? { headingFontFamily: headingFamily === "Satoshi" ? "Inter" : headingFamily }
      : {}),
    ...(typeof designTypography.bodyFamily === "string"
      ? { bodyFontFamily: designTypography.bodyFamily }
      : {}),
  };
  if (Object.keys(brand).length) {
    const drafts = new SupabaseGuidebookDraftRepository(db);
    const draft = await drafts.load({
      workspaceId: property.owner_id,
      guidebookId,
      actorId: user.id,
    });
    if (draft) {
      const persistedAt = new Date().toISOString();
      await drafts.save(
        {
          commandId: `template-brand:${guidebookId}`,
          correlationId,
          actorId: user.id,
          workspaceId: property.owner_id,
          guidebookId,
          expectedRevision: draft.revision,
          enteredAt: persistedAt,
        },
        {
          ...draft,
          brand: { ...draft.brand, ...brand },
          revision: draft.revision + 1,
          persistedAt,
          persistedBy: user.id,
        },
      );
    }
  }
  await db.from("guidebook_library_usage").upsert(
    {
      source_version_id: templateVersion.id,
      consumer_type: "guidebook",
      consumer_id: guidebookId,
      consumer_version: String(row.revision),
      workspace_id: property.owner_id,
      property_id: property.id,
      accepted_by: user.id,
    },
    {
      onConflict:
        "source_version_id,consumer_type,consumer_id,consumer_version",
    },
  );
  const lineageVersions = [
    templateVersion.id,
    ...(components ?? []).flatMap((artifact) =>
      ((artifact.guidebook_library_versions as Row[]) ?? [])
        .filter(
          (version) =>
            Number(version.version_number) ===
            Number(artifact.current_version_number),
        )
        .map((version) => version.id),
    ),
    ...(contents ?? []).flatMap((artifact) =>
      ((artifact.guidebook_library_versions as Row[]) ?? [])
        .filter(
          (version) =>
            Number(version.version_number) ===
            Number(artifact.current_version_number),
        )
        .map((version) => version.id),
    ),
  ];
  await db.from("guidebook_library_usage").upsert(
    lineageVersions.slice(1).map((versionId) => ({
      source_version_id: versionId,
      consumer_type: "guidebook",
      consumer_id: guidebookId,
      consumer_version: String(row.revision),
      workspace_id: property.owner_id,
      property_id: property.id,
      accepted_by: user.id,
    })),
    {
      onConflict:
        "source_version_id,consumer_type,consumer_id,consumer_version",
    },
  );
  await audit(db, {
    actorId: user.id,
    role,
    action: "template_applied",
    targetId: templateId,
    correlationId,
    metadata: {
      artifactType: "template",
      version: templateVersion.version_number,
      guidebookId,
      workspaceId: property.owner_id,
      propertyId: property.id,
    },
  });
  revalidatePath("/admin/guidebooks/list");
  redirect(`/admin/guidebooks/${guidebookId}`);
}

export async function importLibraryContentAction(formData: FormData) {
  const { db, user, role, correlationId } = await adminContext();
  const parsed = JSON.parse(
    String(formData.get("contentJson") ?? "[]"),
  ) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) {
    throw new Error("content_import_invalid");
  }
  let imported = 0;
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object")
      throw new Error("content_import_invalid");
    const row = candidate as Row;
    const name = String(row.name ?? "").trim();
    const canonicalKey = String(row.canonicalKey ?? "")
      .trim()
      .toLowerCase();
    if (!name || !/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/.test(canonicalKey)) {
      throw new Error("content_import_invalid");
    }
    const body = String(row.body ?? "");
    const payload = contentPayload(
      body,
      Array.isArray(row.requiredVariables)
        ? row.requiredVariables.map(String)
        : [],
    );
    const { data: existing } = await db
      .from("guidebook_library_artifacts")
      .select("id")
      .eq("artifact_type", "content")
      .eq("ownership_scope", "luxe_haven")
      .eq("canonical_key", canonicalKey)
      .maybeSingle();
    if (existing) throw new Error(`content_import_duplicate:${canonicalKey}`);
    const { data: artifact, error: artifactError } = await db
      .from("guidebook_library_artifacts")
      .insert({
        artifact_type: "content",
        ownership_scope: "luxe_haven",
        workspace_id: null,
        property_id: null,
        canonical_key: canonicalKey,
        name,
        description: String(row.description ?? ""),
        category: String(row.category ?? "custom"),
        language: String(row.language ?? "en"),
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        status: "draft",
        owner_id: user.id,
        updated_by: user.id,
      })
      .select("id,current_version_number")
      .single();
    if (artifactError || !artifact) throw new Error("content_import_failed");
    const { error: versionError } = await db
      .from("guidebook_library_versions")
      .insert({
        artifact_id: artifact.id,
        version_number: 1,
        status: "draft",
        payload,
        change_summary: "Imported content",
        created_by: user.id,
      });
    if (versionError) throw new Error("content_import_failed");
    imported += 1;
  }
  await audit(db, {
    actorId: user.id,
    role,
    action: "content_imported",
    correlationId,
    metadata: { artifactType: "content", imported },
  });
  revalidatePath(routes.content);
  redirect(`${routes.content}?imported=${imported}`);
}

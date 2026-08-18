"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublishedGuidebookTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
};

export async function getPublishedGuidebookTemplates(
  category?: string,
): Promise<PublishedGuidebookTemplate[]> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const db = createAdminClient();
  let query = db
    .from("guidebook_library_artifacts")
    .select("id,name,description,category,tags")
    .eq("artifact_type", "template")
    .eq("status", "published")
    .order("name", { ascending: true });
  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: String(row.category ?? "general"),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  }));
}

export type PublishedGuidebookTemplateVersion = {
  versionId: string;
  name: string;
  versionNumber: number;
};

/** Approved template *versions* (not artifacts) — the id the AI creation-assistant job engine requires. */
export async function getPublishedGuidebookTemplateVersions(): Promise<
  PublishedGuidebookTemplateVersion[]
> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const db = createAdminClient();
  const relation =
    "artifact:guidebook_library_artifacts!guidebook_library_versions_artifact_id_fkey";
  const { data, error } = await db
    .from("guidebook_library_versions")
    .select(`id,version_number,${relation}!inner(name,artifact_type,status)`)
    .in("status", ["approved", "published"])
    .eq("artifact.artifact_type", "template")
    .eq("artifact.status", "published");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    versionId: String(row.id),
    name: String((row.artifact as unknown as { name: string }).name),
    versionNumber: Number(row.version_number),
  }));
}

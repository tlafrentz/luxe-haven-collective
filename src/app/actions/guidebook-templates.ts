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

import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function csv(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireRole(["admin"]);
  const { data, error } = await createAdminClient()
    .from("guidebook_library_artifacts")
    .select(
      "canonical_key,name,description,category,language,tags,status,current_version_number,updated_at",
    )
    .eq("artifact_type", "content")
    .order("name");
  if (error) return new Response("Content export failed", { status: 500 });
  const columns = [
    "canonical_key",
    "name",
    "description",
    "category",
    "language",
    "tags",
    "status",
    "current_version_number",
    "updated_at",
  ] as const;
  const output = [
    columns.join(","),
    ...(data ?? []).map((row) =>
      columns.map((column) => csv(row[column])).join(","),
    ),
  ].join("\n");
  return new Response(output, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="guidebook-content-library.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}

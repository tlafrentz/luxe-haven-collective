import { redirect } from "next/navigation";

export default async function LegacyAdminVersionEditorAlias({
  params,
}: {
  params: Promise<{ guidebookId: string; versionId: string }>;
}) {
  const { guidebookId } = await params;
  redirect(`/admin/guidebooks/${guidebookId}/edit`);
}

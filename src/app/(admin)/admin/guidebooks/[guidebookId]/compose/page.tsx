import { redirect } from "next/navigation";

export default async function AdminGuidebookComposeAlias({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  redirect(`/admin/guidebooks/${guidebookId}/edit`);
}

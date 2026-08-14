import { redirect } from "next/navigation";

export default async function GuidebookBuilderEntry({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  redirect(`/dashboard/guidebooks/${guidebookId}/edit`);
}

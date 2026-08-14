import { CanonicalGuidebookBuilderPage } from "@/components/guidebooks/canonical-guidebook-builder-page";

export const dynamic = "force-dynamic";
export default async function AdminGuidebookBuilderPage({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  return <CanonicalGuidebookBuilderPage guidebookId={guidebookId} surface="admin" />;
}

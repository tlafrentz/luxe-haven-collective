import { CanonicalGuidebookBuilderPage } from "@/components/guidebooks/canonical-guidebook-builder-page";

export default async function GuidebookBuilderPage({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  return <CanonicalGuidebookBuilderPage guidebookId={guidebookId} surface="dashboard" />;
}

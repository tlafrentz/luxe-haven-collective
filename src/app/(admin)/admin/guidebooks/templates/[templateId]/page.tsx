import { CanonicalLibraryEditor } from "@/components/guidebooks/canonical-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  return (
    <CanonicalLibraryEditor type="template" id={(await params).templateId} />
  );
}

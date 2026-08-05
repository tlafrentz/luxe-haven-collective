import { CanonicalLibraryEditor } from "@/components/guidebooks/canonical-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ componentId: string }>;
}) {
  return (
    <CanonicalLibraryEditor type="component" id={(await params).componentId} />
  );
}

import { CanonicalLibraryEditor } from "@/components/guidebooks/canonical-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  return <CanonicalLibraryEditor type="media" id={(await params).assetId} />;
}

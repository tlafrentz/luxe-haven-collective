import { CanonicalLibraryEditor } from "@/components/guidebooks/canonical-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  return (
    <CanonicalLibraryEditor type="content" id={(await params).contentId} />
  );
}

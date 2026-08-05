import { CanonicalLibraryBrowser } from "@/components/guidebooks/canonical-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    tag?: string;
  }>;
}) {
  return (
    <CanonicalLibraryBrowser type="template" filters={await searchParams} />
  );
}

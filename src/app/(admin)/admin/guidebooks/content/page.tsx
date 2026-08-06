import { ContentLibraryWorkspace } from "@/components/guidebooks/content-library-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    tag?: string;
    type?: string;
    scope?: string;
    view?: string;
  }>;
}) {
  return (
    <ContentLibraryWorkspace filters={await searchParams} />
  );
}

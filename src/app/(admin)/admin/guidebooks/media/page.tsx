import { MediaLibraryWorkspace } from "@/components/guidebooks/media-library-workspace";
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
    orientation?: string;
    view?: string;
  }>;
}) {
  return <MediaLibraryWorkspace filters={await searchParams} />;
}

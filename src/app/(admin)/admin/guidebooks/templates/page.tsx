import { TemplateLibraryWorkspace } from "@/components/guidebooks/template-library-workspace";
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
  return <TemplateLibraryWorkspace filters={await searchParams} />;
}

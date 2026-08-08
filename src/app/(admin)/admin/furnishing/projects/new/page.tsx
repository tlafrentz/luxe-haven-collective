import { NewProjectWorkspace } from "@/components/furnishing/project-workspace-v1";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  return (
    <NewProjectWorkspace selectedPropertyId={(await searchParams).property} />
  );
}

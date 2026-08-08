import { NewProjectWorkspace } from "@/components/furnishing/project-workspace-v1";
import { FurnishingSetupWelcome } from "@/components/furnishing/furnishing-setup-welcome";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; step?: string; package?: string }>;
}) {
  const params = await searchParams;
  if (params.step !== "setup" && !params.property) {
    return <FurnishingSetupWelcome packageName={params.package} />;
  }
  return (
    <NewProjectWorkspace customer selectedPropertyId={params.property} />
  );
}

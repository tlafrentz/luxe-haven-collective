import { SimplifiedProjectWorkspace } from "@/components/furnishing/simplified-project-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <SimplifiedProjectWorkspace id={projectId} customer />;
}

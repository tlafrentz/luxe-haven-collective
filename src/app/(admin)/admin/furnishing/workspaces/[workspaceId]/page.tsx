import { SimplifiedProjectWorkspace } from "@/components/furnishing/simplified-project-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return <SimplifiedProjectWorkspace id={(await params).workspaceId} />;
}

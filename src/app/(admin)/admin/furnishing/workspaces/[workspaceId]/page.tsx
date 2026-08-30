import { ProjectWorkspace } from "@/components/furnishing/project-workspace-v1";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ workspaceId: string }> }) { return <ProjectWorkspace projectId={(await params).workspaceId} customer={false} />; }

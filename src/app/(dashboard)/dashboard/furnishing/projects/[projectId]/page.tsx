import { ProjectWorkspace } from "@/components/furnishing/project-workspace-v1";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  return (
    <ProjectWorkspace projectId={projectId} roomId={query.room} customer />
  );
}

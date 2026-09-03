import { SimplifiedProjectWorkspace } from "@/components/furnishing/simplified-project-workspace";
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
    <SimplifiedProjectWorkspace
      id={projectId}
      customer
      roomId={query.room}
    />
  );
}
